/**
 * Edge Function — send-upsell-trigger-email
 *
 * Envoi de l'email d'upsell (R1-R10) via Brevo Transactional API.
 *
 * Modes :
 *  - POST { suggestionId: 'uuid', dryRun?: boolean }   → envoi unique
 *  - POST { batch: true, limit?: number }              → envoi en lot (suggestions pending)
 *
 * Auth :
 *  - service_role JWT (Authorization: Bearer <service_role_key>)
 *  - OU x-cron-secret header (CRON_SECRET env)
 *
 * Cf. CLAUDE.md §5 + apps/web/src/lib/upsell/upsell-content.ts pour mapping target_code → template.
 */

// @ts-expect-error — Deno remote import, type-checked at deploy time.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// Deno globals are unknown to Node's tsc — declare minimally for typecheck.
declare const Deno: {
  env: { get(key: string): string | undefined }
  serve(handler: (req: Request) => Promise<Response>): void
}

interface SuggestionRow {
  id: string
  organization_id: string
  user_id: string | null
  trigger_code: string
  target_code: string
  current_plan_code: string | null
  signal_value: Record<string, unknown> | null
  status: string
  email_sent_at: string | null
}

interface ProfileRow {
  id: string
  email: string
  full_name: string | null
  email_marketing_consent: boolean
}

interface TriggerEmailMapping {
  triggerCode: string
  targetCode: string
  templateSlug: string
  brevoTemplateId?: number
  subject: string
  ctaPath: string
  productLine: 'annuaire' | 'logiciel' | 'bundle' | 'addon'
  senderName: string
}

const TRIGGER_EMAIL_MAPPING: TriggerEmailMapping[] = [
  {
    triggerCode: 'R1',
    targetCode: 'logiciel_active',
    templateSlug: 'upsell-r1-plan-upgrade',
    subject: 'Vous économisez {{ params.savings_eur }}€/mois en passant à {{ params.target_plan }}',
    ctaPath: '/dashboard/upgrade/logiciel',
    productLine: 'logiciel',
    senderName: 'KOVAS 360',
  },
  {
    triggerCode: 'R2',
    targetCode: 'annuaire_pro',
    templateSlug: 'upsell-r2-annuaire-discovery',
    subject: 'Activez votre fiche Annuaire Pro et captez vos premiers leads',
    ctaPath: '/dashboard/upgrade/annuaire',
    productLine: 'annuaire',
    senderName: 'KOVAS',
  },
  {
    triggerCode: 'R3',
    targetCode: 'logiciel_starter',
    templateSlug: 'upsell-r3-logiciel-discovery',
    subject: 'Vos leads méritent un logiciel métier — découvrez KOVAS 360 Starter',
    ctaPath: '/dashboard/upgrade/logiciel',
    productLine: 'logiciel',
    senderName: 'KOVAS 360',
  },
  {
    triggerCode: 'R4',
    targetCode: 'bundle_active_pro',
    templateSlug: 'upsell-r4-bundle-savings',
    subject: 'Économisez {{ params.savings_eur }}€/mois en passant au Bundle KOVAS',
    ctaPath: '/dashboard/upgrade/bundle',
    productLine: 'bundle',
    senderName: 'KOVAS',
  },
  {
    triggerCode: 'R5',
    targetCode: 'annuaire_sponsored',
    templateSlug: 'upsell-r5-sponsored-slot',
    subject: 'Slot sponsorisé disponible sur {{ params.city }} — priorité garantie',
    ctaPath: '/dashboard/upgrade/sponsored',
    productLine: 'annuaire',
    senderName: 'KOVAS',
  },
  {
    triggerCode: 'R6',
    targetCode: 'addon_signatures_eidas',
    templateSlug: 'upsell-r6-signatures-eidas',
    subject: "Signez vos devis en un clic avec l'add-on eIDAS",
    ctaPath: '/dashboard/upgrade/addons',
    productLine: 'addon',
    senderName: 'KOVAS 360',
  },
  {
    triggerCode: 'R7',
    targetCode: 'addon_pennylane_sync',
    templateSlug: 'upsell-r7-pennylane-sync',
    subject: 'Synchronisez votre facturation avec Pennylane (9 €/mois)',
    ctaPath: '/dashboard/upgrade/addons',
    productLine: 'addon',
    senderName: 'KOVAS 360',
  },
  {
    triggerCode: 'R8',
    targetCode: 'addon_sms_reminders',
    templateSlug: 'upsell-r8-sms-reminders',
    subject: 'Réduisez vos no-shows avec les SMS rappels J-1',
    ctaPath: '/dashboard/upgrade/addons',
    productLine: 'addon',
    senderName: 'KOVAS 360',
  },
  {
    triggerCode: 'R9',
    targetCode: 'addon_community_pro',
    templateSlug: 'upsell-r9-community-pro',
    subject: 'Rejoignez la Communauté Pro KOVAS (9 €/mois)',
    ctaPath: '/dashboard/upgrade/addons',
    productLine: 'addon',
    senderName: 'KOVAS 360',
  },
  {
    triggerCode: 'R10',
    targetCode: 'logiciel_starter',
    templateSlug: 'upsell-r10-reactivation',
    subject: 'Votre compte KOVAS vous attend — réactivation en 1 clic',
    ctaPath: '/dashboard/upgrade/reactivation',
    productLine: 'logiciel',
    senderName: 'KOVAS 360',
  },
]

function getEnv(key: string, fallback: string): string {
  return Deno.env.get(key) ?? fallback
}

function authorize(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    const headerSecret = req.headers.get('x-cron-secret')
    if (headerSecret && headerSecret === cronSecret) return true
  }
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const auth = req.headers.get('Authorization')
  if (serviceRoleKey && auth === `Bearer ${serviceRoleKey}`) return true
  return false
}

function mappingFor(triggerCode: string): TriggerEmailMapping | undefined {
  return TRIGGER_EMAIL_MAPPING.find((m) => m.triggerCode === triggerCode)
}

function fillTemplate(tpl: string, params: Record<string, string | number>): string {
  return tpl.replace(/\{\{\s*params\.(\w+)\s*\}\}/g, (_, key) => {
    const v = params[key]
    return v === undefined ? '' : String(v)
  })
}

function buildLegalFooter(): string {
  // Mentions NEXUS 1993 — synchronisées avec apps/web/src/lib/legal/company-identity.ts
  return [
    '<hr style="border:none;border-top:1px solid #E5DECB;margin:24px 0;" />',
    '<p style="font-size:11px;color:#7E8AA4;line-height:1.5;">',
    'NEXUS 1993 — SASU au capital de 500,00 €<br/>',
    '66 Avenue des Champs Élysées, 75008 Paris, France<br/>',
    'SIREN 982 786 154 — RCS Paris — TVA FR18982786154',
    '</p>',
  ].join('')
}

function buildInlineHtml(
  mapping: TriggerEmailMapping,
  params: Record<string, string | number>,
): string {
  const ctaUrl = String(params.cta_url ?? '')
  const firstName = String(params.first_name ?? '')
  const currentPlan = String(params.current_plan ?? '')
  const targetPlan = String(params.target_plan ?? '')
  const savings = String(params.savings_eur ?? '')
  const signatureName = mapping.senderName === 'KOVAS' ? "L'équipe KOVAS" : "L'équipe KOVAS 360"

  // Body adapté par règle — corps minimal sobre + footer NEXUS 1993
  const introByRule: Record<string, string> = {
    R1: `Nous avons remarqué que votre activité dépasse régulièrement le plafond de votre forfait <strong>${currentPlan}</strong>. Passer à <strong>${targetPlan}</strong> vous fait économiser environ ${savings} €/an.`,
    R2: `Votre cabinet n'apparaît pas encore sur KOVAS Annuaire. Activer la fiche Annuaire Pro vous donne une visibilité immédiate auprès des particuliers de votre zone.`,
    R3: `Vous recevez régulièrement des leads via l'Annuaire. KOVAS 360 Starter vous accompagne sur la production des diagnostics (saisie vocale, exports, conformité).`,
    R4: `Vous êtes abonné aux deux produits séparément. Un bundle vous fait économiser ${savings} €/mois pour les mêmes fonctionnalités.`,
    R5: 'Votre ville présente une densité de demandes suffisante pour un slot sponsorisé. Cela vous garantit la visibilité prioritaire.',
    R6: `Vous émettez régulièrement des devis. L'add-on signatures eIDAS rend ce cycle conforme et plus rapide.`,
    R7: 'Vous émettez régulièrement des factures. La synchronisation Pennylane vous fait gagner du temps comptable chaque mois.',
    R8: 'Vous gérez un volume de RDV important. Les SMS rappel J-1 réduisent les no-shows de 35 %.',
    R9: 'Vous utilisez KOVAS depuis plus de six mois. Rejoindre la Communauté Pro vous donne accès au forum et aux masterclass mensuelles.',
    R10: 'Votre compte est en pause depuis trente jours. Vos missions et clients sont conservés — la réactivation prend une minute.',
  }
  const intro = introByRule[mapping.triggerCode] ?? ''

  return [
    `<div style="font-family:sans-serif;color:#0F1E3D;max-width:560px;">`,
    `<p>Bonjour ${firstName},</p>`,
    `<p>${intro}</p>`,
    `<p style="margin:24px 0;">`,
    `<a href="${ctaUrl}" style="background:#0F1E3D;color:#F8F5EE;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">→ ${mapping.subject.includes('{{') ? "Voir l'offre" : "Voir l'offre"}</a>`,
    '</p>',
    `<p>Cordialement,<br/>${signatureName}</p>`,
    buildLegalFooter(),
    '</div>',
  ].join('')
}

interface SendResult {
  ok: boolean
  suggestionId: string
  messageId?: string
  error?: string
}

async function sendOne(
  supabase: ReturnType<typeof createClient>,
  suggestion: SuggestionRow,
  brevoApiKey: string,
  brevoFromEmail: string,
  brevoReplyTo: string,
  baseUrl: string,
  dryRun: boolean,
): Promise<SendResult> {
  const mapping = mappingFor(suggestion.trigger_code)
  if (!mapping) {
    return {
      ok: false,
      suggestionId: suggestion.id,
      error: `no-mapping-for-${suggestion.trigger_code}`,
    }
  }

  // Profil destinataire
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, email_marketing_consent')
    .eq('id', suggestion.user_id ?? '')
    .maybeSingle<ProfileRow>()

  if (!profile?.email) {
    return { ok: false, suggestionId: suggestion.id, error: 'no-profile-email' }
  }
  if (profile.email_marketing_consent === false) {
    return { ok: false, suggestionId: suggestion.id, error: 'opt-out' }
  }

  const signal = suggestion.signal_value ?? {}
  const params: Record<string, string | number> = {
    first_name: profile.full_name?.split(' ')[0] ?? 'cher diagnostiqueur',
    current_plan: suggestion.current_plan_code ?? '',
    target_plan: suggestion.target_code,
    cta_url: `${baseUrl}${mapping.ctaPath}?ref=upsell-${mapping.triggerCode.toLowerCase()}&sid=${suggestion.id}`,
    savings_eur: typeof signal.savings_eur === 'number' ? signal.savings_eur : 0,
    usage_avg_3mo: typeof signal.usage_avg_3mo === 'number' ? signal.usage_avg_3mo : 0,
    cap_threshold: typeof signal.cap_threshold === 'number' ? signal.cap_threshold : 0,
    city: typeof signal.city === 'string' ? signal.city : '',
  }

  const subject = fillTemplate(mapping.subject, params)
  const htmlContent = buildInlineHtml(mapping, params)

  const body: Record<string, unknown> = {
    sender: { name: mapping.senderName, email: brevoFromEmail },
    to: [{ email: profile.email, name: profile.full_name ?? profile.email }],
    replyTo: { email: brevoReplyTo, name: 'Support KOVAS' },
    subject,
    htmlContent,
    tags: ['upsell', mapping.triggerCode.toLowerCase()],
  }
  if (mapping.brevoTemplateId) {
    body.templateId = mapping.brevoTemplateId
    body.params = params
    body.htmlContent = undefined
  }

  if (dryRun) {
    return { ok: true, suggestionId: suggestion.id, messageId: 'dry-run' }
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': brevoApiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => `HTTP ${response.status}`)
    return { ok: false, suggestionId: suggestion.id, error: errText.slice(0, 400) }
  }

  const data = (await response.json().catch(() => ({}))) as { messageId?: string }
  const messageId = data.messageId ?? null

  // Update suggestion tracking
  await supabase
    .from('upsell_suggestions')
    .update({
      email_sent_at: new Date().toISOString(),
      email_template_slug: mapping.templateSlug,
      brevo_message_id: messageId,
    })
    .eq('id', suggestion.id)

  // Insert event
  await supabase.from('upsell_events').insert({
    suggestion_id: suggestion.id,
    organization_id: suggestion.organization_id,
    user_id: suggestion.user_id,
    action: 'email_sent',
    metadata: { template_slug: mapping.templateSlug, brevo_message_id: messageId },
  })

  return { ok: true, suggestionId: suggestion.id, messageId: messageId ?? undefined }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const startedAt = Date.now()
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'method-not-allowed' }), { status: 405 })
  }
  if (!authorize(req)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 })
  }

  const brevoApiKey = Deno.env.get('BREVO_API_KEY')
  if (!brevoApiKey) {
    return new Response(JSON.stringify({ ok: false, error: 'BREVO_API_KEY missing' }), {
      status: 500,
    })
  }
  const brevoFromEmail = getEnv('BREVO_FROM_EMAIL', 'contact@kovas.fr')
  const brevoReplyTo = getEnv('BREVO_REPLY_TO', 'contact@kovas.fr')
  const baseUrl = getEnv('KOVAS_BASE_URL', 'https://kovas.fr')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: 'supabase env missing' }), {
      status: 500,
    })
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  let payload: { suggestionId?: string; batch?: boolean; limit?: number; dryRun?: boolean } = {}
  try {
    payload = await req.json()
  } catch {
    payload = {}
  }
  const dryRun = payload.dryRun === true

  let rows: SuggestionRow[] = []
  if (payload.suggestionId) {
    const { data, error } = await supabase
      .from('upsell_suggestions')
      .select(
        'id, organization_id, user_id, trigger_code, target_code, current_plan_code, signal_value, status, email_sent_at',
      )
      .eq('id', payload.suggestionId)
      .limit(1)
    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 })
    }
    rows = (data ?? []) as SuggestionRow[]
  } else if (payload.batch) {
    const limit = Math.min(payload.limit ?? 50, 200)
    const { data, error } = await supabase
      .from('upsell_suggestions')
      .select(
        'id, organization_id, user_id, trigger_code, target_code, current_plan_code, signal_value, status, email_sent_at',
      )
      .eq('status', 'pending')
      .is('email_sent_at', null)
      .order('created_at', { ascending: true })
      .limit(limit)
    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 })
    }
    rows = (data ?? []) as SuggestionRow[]
  } else {
    return new Response(
      JSON.stringify({ ok: false, error: 'missing suggestionId or batch flag' }),
      { status: 400 },
    )
  }

  let sent = 0
  let failed = 0
  const failures: Array<{ suggestionId: string; error?: string }> = []

  for (const row of rows) {
    const result = await sendOne(
      supabase,
      row,
      brevoApiKey,
      brevoFromEmail,
      brevoReplyTo,
      baseUrl,
      dryRun,
    )
    if (result.ok) sent += 1
    else {
      failed += 1
      failures.push({ suggestionId: result.suggestionId, error: result.error })
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed: rows.length,
      sent,
      failed,
      failures: failures.slice(0, 10),
      durationMs: Date.now() - startedAt,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
})
