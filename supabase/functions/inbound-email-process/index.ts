/**
 * KOVAS — Edge Function : webhook Brevo Inbound Email (réception de demandes
 * de devis par mail).
 *
 * Endpoint POST /functions/v1/inbound-email-process
 *
 * Auth :
 *   - Header X-Brevo-Webhook-Signature OU query ?secret=...
 *   - Comparé en temps constant à BREVO_INBOUND_WEBHOOK_SECRET.
 *
 * Payload Brevo (résumé) :
 *   {
 *     items: [
 *       {
 *         To: [{ Address: 'devis-<org_id>@kovas.fr', Name: '...' }],
 *         From: { Address: 'client@..', Name: '...' },
 *         Subject: '...',
 *         ExtractedMarkdownMessage: '...', // ou RawTextBody
 *         MessageId: '...',
 *         Date: '...'
 *       }
 *     ]
 *   }
 *
 * Workflow :
 *   1. Vérifie signature.
 *   2. Pour chaque item :
 *      a. Parse l'adresse destinataire → organization_id (préfixe devis-<uuid>@kovas.fr)
 *      b. Extraction IA Claude Haiku 4.5 (tool use `extract_quote_request`)
 *      c. INSERT auto_quotes (trigger_source='inbound_email', status='pending')
 *      d. Lit user_preferences.inbound_email_manual_validation du owner de l'org
 *      e. Si validation manuelle : ping Telegram + email récap diagnostiqueur
 *         Sinon : appel auto-quote-generate (mode interne via INTERNAL_API_SECRET)
 *
 * TODO config externe (admin) :
 *   - Brevo : créer un domaine inbound dans la console Brevo (Settings →
 *     Inbound Parsing) et configurer les MX records sur kovas.fr :
 *       MX 10 in1-mxa.bind.brevo.com
 *       MX 20 in2-mxb.bind.brevo.com
 *   - Brevo : ajouter une rule "Forward to webhook" pointant vers cet endpoint
 *     avec header X-Brevo-Webhook-Signature contenant BREVO_INBOUND_WEBHOOK_SECRET.
 *   - DNS provider (Cloudflare) : créer une entrée wildcard `devis-*@kovas.fr`
 *     ou catch-all sur le domaine kovas.fr.
 *
 * Authority : CLAUDE.md §3 #6 (upload documents propriétaire) + module 5 auto_quotes.
 */

// @ts-nocheck — Deno-only Edge Function.

import Anthropic from 'npm:@anthropic-ai/sdk@0.96.0'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL_INBOUND') ?? 'claude-haiku-4-5'
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot'

interface BrevoInboundItem {
  To?: Array<{ Address?: string; Name?: string }>
  From?: { Address?: string; Name?: string }
  Subject?: string
  ExtractedMarkdownMessage?: string
  RawTextBody?: string
  RawHtmlBody?: string
  MessageId?: string
  Date?: string
}

interface BrevoInboundPayload {
  items?: BrevoInboundItem[]
}

interface ExtractedQuote {
  extracted_address: string | null
  extracted_diagnostic_types: string[]
  extracted_surface: number | null
  extracted_client_name: string | null
  extracted_client_phone: string | null
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Extrait l'organization_id d'une adresse type devis-<uuid>@kovas.fr ou
 * devis+<uuid>@kovas.fr (alias gmail-style).
 */
function parseOrgFromAddress(address: string): string | null {
  const local = address.split('@')[0]?.toLowerCase() ?? ''
  const match = local.match(
    /^devis[-+]([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/,
  )
  return match?.[1] ?? null
}

const EXTRACT_TOOL = {
  name: 'extract_quote_request',
  description:
    "Extrait les informations clés d'une demande de devis email pour un diagnostic immobilier (DPE, amiante, plomb, gaz, électricité, termites, Carrez/Boutin, ERP).",
  input_schema: {
    type: 'object' as const,
    properties: {
      extracted_address: {
        type: ['string', 'null'],
        description: 'Adresse postale du bien (n°, rue, code postal, ville). null si absent.',
      },
      extracted_diagnostic_types: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'dpe_vente',
            'dpe_location',
            'amiante_vente',
            'amiante_avant_travaux',
            'plomb_crep',
            'gaz',
            'electricite',
            'termites',
            'carrez_boutin',
            'erp',
          ],
        },
        description: 'Liste des types de diagnostic demandés (codes normalisés).',
      },
      extracted_surface: {
        type: ['number', 'null'],
        description: 'Surface en m² si mentionnée explicitement. null sinon.',
      },
      extracted_client_name: {
        type: ['string', 'null'],
        description: 'Nom du client si déductible de la signature ou du corps. null sinon.',
      },
      extracted_client_phone: {
        type: ['string', 'null'],
        description: "Numéro de téléphone format français (+33...). null sinon.",
      },
    },
    required: [
      'extracted_address',
      'extracted_diagnostic_types',
      'extracted_surface',
      'extracted_client_name',
      'extracted_client_phone',
    ],
  },
}

async function extractQuoteFromEmail(
  anthropic: Anthropic,
  subject: string,
  body: string,
  fromAddress: string,
): Promise<{ extracted: ExtractedQuote; usage: { input: number; output: number } } | null> {
  const resp = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 512,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'extract_quote_request' },
    system:
      "Tu extrais les informations d'une demande de devis email pour un diagnostiqueur immobilier français. Réponds UNIQUEMENT via l'outil extract_quote_request. Ne devine pas : mets null si l'information est absente du message. Vocabulaire métier français autorisé.",
    messages: [
      {
        role: 'user',
        content: `EMAIL REÇU :\n\nDe : ${fromAddress}\nSujet : ${subject}\n\nCorps :\n${body.slice(0, 6000)}`,
      },
    ],
  })

  for (const block of resp.content) {
    if (block.type === 'tool_use' && block.name === 'extract_quote_request') {
      const input = block.input as Partial<ExtractedQuote>
      return {
        extracted: {
          extracted_address: input.extracted_address ?? null,
          extracted_diagnostic_types: input.extracted_diagnostic_types ?? [],
          extracted_surface: input.extracted_surface ?? null,
          extracted_client_name: input.extracted_client_name ?? null,
          extracted_client_phone: input.extracted_client_phone ?? null,
        },
        usage: {
          input: resp.usage.input_tokens,
          output: resp.usage.output_tokens,
        },
      }
    }
  }
  return null
}

async function notifyTelegram(
  botToken: string,
  chatId: string,
  text: string,
): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API_BASE}${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  } catch {
    // best-effort
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  const inboundSecret = Deno.env.get('BREVO_INBOUND_WEBHOOK_SECRET')
  const internalSecret = Deno.env.get('INTERNAL_API_SECRET')
  const telegramBot = Deno.env.get('TELEGRAM_BOT_TOKEN')

  if (!supabaseUrl || !serviceRole || !anthropicKey || !inboundSecret) {
    return jsonResponse({ error: 'missing_environment' }, 500)
  }

  // 1. Vérification signature
  const headerSig = req.headers.get('x-brevo-webhook-signature')
  const url = new URL(req.url)
  const querySig = url.searchParams.get('secret')
  const providedSig = headerSig ?? querySig ?? ''
  if (!constantTimeEqual(providedSig, inboundSecret)) {
    return jsonResponse({ error: 'invalid_signature' }, 401)
  }

  let payload: BrevoInboundPayload
  try {
    payload = (await req.json()) as BrevoInboundPayload
  } catch {
    return jsonResponse({ error: 'invalid_body' }, 400)
  }
  const items = payload.items ?? []
  if (items.length === 0) return jsonResponse({ processed: 0 })

  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const anthropic = new Anthropic({ apiKey: anthropicKey })

  const results: Array<{ status: string; auto_quote_id?: string; error?: string }> = []

  for (const item of items) {
    try {
      // 2a. Adresse destinataire → org
      const toAddr = item.To?.[0]?.Address ?? ''
      const orgId = parseOrgFromAddress(toAddr)
      if (!orgId) {
        results.push({ status: 'skipped_no_org', error: `unknown recipient: ${toAddr}` })
        continue
      }

      // Vérifie que l'org existe
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('id', orgId)
        .maybeSingle<{ id: string }>()
      if (!org) {
        results.push({ status: 'skipped_org_not_found', error: orgId })
        continue
      }

      // Trouve l'owner (1er membership 'owner')
      const { data: ownerMembership } = await supabaseAdmin
        .from('memberships')
        .select('user_id')
        .eq('organization_id', orgId)
        .eq('role', 'owner')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle<{ user_id: string }>()
      const ownerUserId = ownerMembership?.user_id ?? null

      const subject = item.Subject ?? '(sans sujet)'
      const body =
        item.ExtractedMarkdownMessage ?? item.RawTextBody ?? item.RawHtmlBody ?? ''
      const fromAddress = item.From?.Address ?? '(inconnu)'

      // 2b. Extraction IA
      const extraction = await extractQuoteFromEmail(anthropic, subject, body, fromAddress)
      if (!extraction) {
        results.push({ status: 'skipped_extraction_failed' })
        continue
      }

      // Création contact si email lead inconnu
      let contactId: string | null = null
      if (item.From?.Address) {
        const { data: existing } = await supabaseAdmin
          .from('contacts')
          .select('id')
          .eq('organization_id', orgId)
          .eq('email', item.From.Address)
          .maybeSingle<{ id: string }>()
        if (existing) contactId = existing.id
        else {
          const { data: newContact } = await supabaseAdmin
            .from('contacts')
            .insert({
              organization_id: orgId,
              kind: 'client',
              display_name:
                item.From.Name ?? extraction.extracted.extracted_client_name ?? item.From.Address,
              email: item.From.Address,
              phone: extraction.extracted.extracted_client_phone,
            })
            .select('id')
            .single<{ id: string }>()
          contactId = newContact?.id ?? null
        }
      }

      // 2c. INSERT auto_quotes
      const propertySnapshot = {
        extracted_address: extraction.extracted.extracted_address,
        extracted_surface: extraction.extracted.extracted_surface,
        extracted_client_name: extraction.extracted.extracted_client_name,
        extracted_client_phone: extraction.extracted.extracted_client_phone,
        extracted_client_email: item.From?.Address ?? null,
        email_subject: subject,
        email_message_id: item.MessageId ?? null,
        email_received_at: item.Date ?? new Date().toISOString(),
      }
      const { data: aq, error: aqErr } = await supabaseAdmin
        .from('auto_quotes')
        .insert({
          organization_id: orgId,
          user_id: ownerUserId,
          contact_id: contactId,
          trigger_source: 'inbound_email',
          status: 'pending',
          property_snapshot: propertySnapshot,
          diagnostics_requested: extraction.extracted.extracted_diagnostic_types,
        })
        .select('id')
        .single<{ id: string }>()
      if (aqErr || !aq) {
        results.push({ status: 'insert_failed', error: aqErr?.message })
        continue
      }

      // Log AI usage
      // Modèle attendu : Haiku 4.5 (cf. MODEL_FOR_FEATURE.auto_quote_extraction='haiku'
      // dans apps/web/src/lib/ai/anthropic-config.ts). Pricing Haiku 4.5 :
      // 1$/Mtok input · 5$/Mtok output (snapshot 2026-05).
      const inputTokens = extraction.usage.input
      const outputTokens = extraction.usage.output
      const usd = (inputTokens / 1_000_000) * 1 + (outputTokens / 1_000_000) * 5
      const costEur = Math.round(usd * 0.92 * 1_000_000) / 1_000_000
      if (ownerUserId) {
        await supabaseAdmin.from('ai_usage_log').insert({
          user_id: ownerUserId,
          operation: 'inbound_email_extract',
          ai_model: ANTHROPIC_MODEL,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_eur: costEur,
          duration_ms: 0,
          success: true,
        })
        // Cost-tracker centralisé (ai-usage-tracker Edge Function, vague suivante).
        // Best-effort.
        try {
          await fetch(`${supabaseUrl}/functions/v1/ai-usage-tracker`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              Authorization: `Bearer ${serviceRole}`,
            },
            body: JSON.stringify({
              organizationId: orgId,
              userId: ownerUserId,
              feature: 'auto_quote_extraction',
              provider: 'anthropic',
              modelUsed: ANTHROPIC_MODEL,
              inputTokens,
              outputTokens,
              cachedInputTokens: 0,
              cacheWriteTokens: 0,
              estimatedCostEur: costEur,
              latencyMs: 0,
            }),
          })
        } catch {
          // silent
        }
      }

      // 2d. Validation manuelle ?
      let manualValidation = false
      let telegramChatId: string | null = null
      if (ownerUserId) {
        const { data: prefs } = await supabaseAdmin
          .from('user_preferences')
          .select('inbound_email_manual_validation, telegram_chat_id')
          .eq('user_id', ownerUserId)
          .maybeSingle<{
            inbound_email_manual_validation: boolean | null
            telegram_chat_id: string | null
          }>()
        manualValidation = prefs?.inbound_email_manual_validation ?? true
        telegramChatId = prefs?.telegram_chat_id ?? null
      }

      if (manualValidation) {
        if (telegramBot && telegramChatId) {
          await notifyTelegram(
            telegramBot,
            telegramChatId,
            `*Nouvelle demande de devis email*\nDe : ${fromAddress}\nSujet : ${subject}\nDiagnostics : ${extraction.extracted.extracted_diagnostic_types.join(', ') || '(non précisés)'}\n\n[Valider →](${Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://kovas.fr'}/devis/auto/${aq.id})`,
          )
        }
        results.push({ status: 'pending_validation', auto_quote_id: aq.id })
      } else if (internalSecret) {
        // 2e. Auto-generation via auto-quote-generate
        const genResp = await fetch(
          `${supabaseUrl}/functions/v1/auto-quote-generate`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              Authorization: `Bearer ${internalSecret}`,
            },
            body: JSON.stringify({ auto_quote_id: aq.id }),
          },
        )
        if (genResp.ok) {
          results.push({ status: 'auto_generated', auto_quote_id: aq.id })
        } else {
          results.push({
            status: 'auto_generation_failed',
            auto_quote_id: aq.id,
            error: await genResp.text(),
          })
        }
      } else {
        results.push({ status: 'pending_no_internal_secret', auto_quote_id: aq.id })
      }
    } catch (err) {
      results.push({
        status: 'item_error',
        error: err instanceof Error ? err.message : 'unknown',
      })
    }
  }

  return jsonResponse({ processed: items.length, results })
})
