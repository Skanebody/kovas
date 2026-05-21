/**
 * KOVAS — Edge Function : anonymisation d'un cas communauté.
 *
 * Endpoint POST /functions/v1/community-anonymize
 *
 * Body : { case_id: string }
 *
 * Auth :
 *   - JWT user (auteur du cas OU admin) accepté
 *   - OU Authorization: Bearer ${INTERNAL_API_SECRET} pour appels trigger DB.
 *
 * Workflow :
 *   1. Charge community_cases (full row)
 *   2. Pré-traitement regex (1re passe rapide, sans IA) :
 *        - Adresses précises (n° + voie) → "[adresse]"
 *        - Téléphones FR / E.164 → "[contact]"
 *        - Emails → "[contact]"
 *        - SIRET (14 chiffres) → "[code]"
 *        - Codes postaux (5 chiffres) → "[code postal]"
 *   3. Anonymisation IA Claude Haiku 4.5 (2e passe, NER finer-grained sur noms propres
 *      personnes physiques + adresses partielles non détectées par regex)
 *   4. UPDATE community_cases SET context_description, question, decision_made,
 *      justification, status (= 'pending' ou 'flagged' si IA détecte un résiduel)
 *   5. INSERT admin_audit_log (RGPD : qui, quand, quoi anonymisé)
 *   6. Log AI usage
 *
 * Couverture :
 *   - REGEX 1re passe : adresses standard, téléphones FR, emails, SIRET, codes postaux
 *   - IA 2e passe : noms propres personnes physiques, surnoms, adresses partielles
 *     ("rue de l'église"), références indirectes
 *   - Résiduel possible : nom de société rare, abréviations métier ambiguës
 *     → flag 'flagged' pour modération humaine si l'IA n'est pas sûre.
 *
 * Authority : CLAUDE.md §10 RGPD + community_cases anonymisation Edge Function attendue.
 */

// @ts-nocheck — Deno-only Edge Function.

import Anthropic from 'npm:@anthropic-ai/sdk@0.96.0'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL_ANONYMIZE') ?? 'claude-haiku-4-5'

interface RequestBody {
  case_id: string
}

interface CommunityCaseRow {
  id: string
  author_user_id: string | null
  context_description: string
  question: string
  decision_made: string | null
  justification: string | null
  status: string
}

interface AnonymizedFields {
  context_description: string
  question: string
  decision_made: string | null
  justification: string | null
  flagged: boolean
  flag_reason: string | null
}

interface DetectionReport {
  context_description: AnonymizedFields['context_description']
  question: AnonymizedFields['question']
  decision_made: AnonymizedFields['decision_made']
  justification: AnonymizedFields['justification']
  flagged: boolean
  flag_reason: string | null
  patterns_detected: {
    addresses: number
    phones: number
    emails: number
    sirets: number
    postcodes: number
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// ============================================
// Passe 1 : Regex (rapide, déterministe)
// ============================================
const RE_PHONE = /\b(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}\b/g
const RE_EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const RE_SIRET = /\b\d{14}\b/g
// Postcode FR : 5 chiffres, mais on n'efface que quand entouré d'un nom de ville
// (sinon trop de faux positifs sur les surfaces, années, etc.).
const RE_POSTCODE_CITY = /\b(\d{5})\s+([A-Z][A-Za-zÀ-ÿ-]+(?:\s[A-Z][A-Za-zÀ-ÿ-]+)?)\b/g
// Adresse : n° + (rue|avenue|boulevard|impasse|route|allée|place|chemin|quai) + nom
const RE_ADDRESS =
  /\b\d{1,4}(?:\s?(?:bis|ter|quater))?\s+(?:rue|avenue|av\.|boulevard|bd|impasse|imp\.|route|rte|allée|allee|place|chemin|ch\.|quai)\s+(?:[a-zà-ÿ'-]+\s?){1,5}/gi

function regexFirstPass(input: string): {
  text: string
  counts: DetectionReport['patterns_detected']
} {
  let text = input
  const counts = { addresses: 0, phones: 0, emails: 0, sirets: 0, postcodes: 0 }

  text = text.replace(RE_EMAIL, () => {
    counts.emails++
    return '[contact]'
  })
  text = text.replace(RE_PHONE, () => {
    counts.phones++
    return '[contact]'
  })
  text = text.replace(RE_SIRET, () => {
    counts.sirets++
    return '[code]'
  })
  text = text.replace(RE_ADDRESS, () => {
    counts.addresses++
    return '[adresse]'
  })
  text = text.replace(RE_POSTCODE_CITY, () => {
    counts.postcodes++
    return '[code postal]'
  })

  return { text, counts }
}

// ============================================
// Passe 2 : Claude Haiku 4.5 (NER tool use)
// ============================================
const ANON_TOOL = {
  name: 'anonymize_case',
  description:
    "Réécrit les champs d'un cas communauté en supprimant TOUTE information personnelle identifiante (PII).",
  input_schema: {
    type: 'object' as const,
    properties: {
      context_description: {
        type: 'string',
        description:
          'Description anonymisée. Remplace noms propres personnes physiques par [client], adresses précises par [adresse], codes postaux par [code postal]. Conserve type de bâtiment, époque (par tranche de 10 ans), région globale.',
      },
      question: { type: 'string', description: 'Question anonymisée selon les mêmes règles.' },
      decision_made: {
        type: ['string', 'null'],
        description: 'Décision anonymisée ou null si vide.',
      },
      justification: {
        type: ['string', 'null'],
        description: 'Justification anonymisée ou null si vide.',
      },
      flagged: {
        type: 'boolean',
        description:
          "true SI tu détectes une PII que tu ne peux pas anonymiser proprement (référence indirecte, contexte trop spécifique). Sinon false.",
      },
      flag_reason: {
        type: ['string', 'null'],
        description: "Raison du flag (1 phrase). null si flagged=false.",
      },
    },
    required: [
      'context_description',
      'question',
      'decision_made',
      'justification',
      'flagged',
      'flag_reason',
    ],
  },
}

async function aiAnonymize(
  anthropic: Anthropic,
  pre: {
    context_description: string
    question: string
    decision_made: string | null
    justification: string | null
  },
): Promise<{ result: Omit<AnonymizedFields, never>; usage: { input: number; output: number } } | null> {
  const resp = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1500,
    tools: [ANON_TOOL],
    tool_choice: { type: 'tool', name: 'anonymize_case' },
    system:
      "Tu es un anonymiseur RGPD spécialisé dans les cas métier de diagnostiqueurs immobiliers français. Ta tâche : supprimer TOUTE information personnelle identifiante (noms propres de personnes physiques, adresses précises, numéros de téléphone, emails, SIRET, codes postaux combinés à une ville). CONSERVE : type de bâtiment, époque par tranche de 10 ans, région globale (ex: 'Hauts-de-France'). Réponds UNIQUEMENT via l'outil anonymize_case. Si tu ne peux pas anonymiser un passage proprement, flag=true.",
    messages: [
      {
        role: 'user',
        content: `Anonymise ces 4 champs :

[CONTEXTE]
${pre.context_description}

[QUESTION]
${pre.question}

[DÉCISION]
${pre.decision_made ?? '(vide)'}

[JUSTIFICATION]
${pre.justification ?? '(vide)'}`,
      },
    ],
  })

  for (const block of resp.content) {
    if (block.type === 'tool_use' && block.name === 'anonymize_case') {
      const inp = block.input as {
        context_description?: string
        question?: string
        decision_made?: string | null
        justification?: string | null
        flagged?: boolean
        flag_reason?: string | null
      }
      return {
        result: {
          context_description: inp.context_description ?? pre.context_description,
          question: inp.question ?? pre.question,
          decision_made:
            inp.decision_made === undefined ? pre.decision_made : inp.decision_made,
          justification:
            inp.justification === undefined ? pre.justification : inp.justification,
          flagged: inp.flagged ?? false,
          flag_reason: inp.flag_reason ?? null,
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

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  const internalSecret = Deno.env.get('INTERNAL_API_SECRET')
  if (!supabaseUrl || !anonKey || !serviceRole || !anthropicKey) {
    return jsonResponse({ error: 'missing_environment' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'unauthorized' }, 401)
  const bearer = authHeader.slice(7)
  const isInternal = internalSecret !== undefined && bearer === internalSecret

  let actingUserId: string | null = null
  if (!isInternal) {
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: u, error: uErr } = await supabaseUser.auth.getUser(bearer)
    if (uErr || !u.user) return jsonResponse({ error: 'unauthorized' }, 401)
    actingUserId = u.user.id
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: 'invalid_body' }, 400)
  }
  if (typeof body.case_id !== 'string') return jsonResponse({ error: 'case_id_required' }, 400)

  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const t0 = Date.now()

  // 1. Charge le cas
  const { data: row, error: rowErr } = await supabaseAdmin
    .from('community_cases')
    .select(
      'id, author_user_id, context_description, question, decision_made, justification, status',
    )
    .eq('id', body.case_id)
    .maybeSingle<CommunityCaseRow>()
  if (rowErr || !row) return jsonResponse({ error: 'case_not_found' }, 404)

  // Vérif autorisation : auteur du cas OU admin OU appel interne
  if (!isInternal) {
    if (row.author_user_id !== actingUserId) {
      // check admin
      const { data: isAdmin } = await supabaseAdmin.rpc('is_admin', { p_user: actingUserId })
      if (!isAdmin) return jsonResponse({ error: 'forbidden' }, 403)
    }
  }

  // 2. Passe 1 : regex sur les 4 champs
  const fields = {
    context_description: regexFirstPass(row.context_description),
    question: regexFirstPass(row.question),
    decision_made: row.decision_made ? regexFirstPass(row.decision_made) : null,
    justification: row.justification ? regexFirstPass(row.justification) : null,
  }
  const aggregateCounts = {
    addresses:
      fields.context_description.counts.addresses +
      fields.question.counts.addresses +
      (fields.decision_made?.counts.addresses ?? 0) +
      (fields.justification?.counts.addresses ?? 0),
    phones:
      fields.context_description.counts.phones +
      fields.question.counts.phones +
      (fields.decision_made?.counts.phones ?? 0) +
      (fields.justification?.counts.phones ?? 0),
    emails:
      fields.context_description.counts.emails +
      fields.question.counts.emails +
      (fields.decision_made?.counts.emails ?? 0) +
      (fields.justification?.counts.emails ?? 0),
    sirets:
      fields.context_description.counts.sirets +
      fields.question.counts.sirets +
      (fields.decision_made?.counts.sirets ?? 0) +
      (fields.justification?.counts.sirets ?? 0),
    postcodes:
      fields.context_description.counts.postcodes +
      fields.question.counts.postcodes +
      (fields.decision_made?.counts.postcodes ?? 0) +
      (fields.justification?.counts.postcodes ?? 0),
  }

  // 3. Passe 2 : IA
  const anthropic = new Anthropic({ apiKey: anthropicKey })
  const aiOutcome = await aiAnonymize(anthropic, {
    context_description: fields.context_description.text,
    question: fields.question.text,
    decision_made: fields.decision_made?.text ?? null,
    justification: fields.justification?.text ?? null,
  })

  const finalFields: AnonymizedFields = aiOutcome
    ? aiOutcome.result
    : {
        // Fallback : si l'IA échoue, on garde la passe regex uniquement et on flag.
        context_description: fields.context_description.text,
        question: fields.question.text,
        decision_made: fields.decision_made?.text ?? null,
        justification: fields.justification?.text ?? null,
        flagged: true,
        flag_reason: 'AI anonymization failed (fallback regex only)',
      }

  const newStatus = finalFields.flagged ? 'flagged' : 'pending'

  // 4. UPDATE community_cases
  const { error: updErr } = await supabaseAdmin
    .from('community_cases')
    .update({
      context_description: finalFields.context_description,
      question: finalFields.question,
      decision_made: finalFields.decision_made,
      justification: finalFields.justification,
      status: newStatus,
      moderation_notes: finalFields.flag_reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
  if (updErr) return jsonResponse({ error: 'update_failed', details: updErr.message }, 500)

  // 5. Audit log RGPD
  if (actingUserId || isInternal) {
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_user_id: actingUserId,
      action_type: 'community_case_anonymize',
      target_type: 'community_cases',
      target_id: row.id,
      succeeded: !updErr,
      details: {
        flagged: finalFields.flagged,
        flag_reason: finalFields.flag_reason,
        patterns_detected: aggregateCounts,
        ai_model: ANTHROPIC_MODEL,
        previous_status: row.status,
        new_status: newStatus,
      },
    })
  }

  // 6. AI usage log
  // Modèle attendu : Haiku 4.5 (cf. MODEL_FOR_FEATURE.community_anonymize='haiku'
  // dans apps/web/src/lib/ai/anthropic-config.ts). Pricing Haiku 4.5 :
  // 1$/Mtok input · 5$/Mtok output (snapshot 2026-05).
  if (aiOutcome && actingUserId) {
    const usd =
      (aiOutcome.usage.input / 1_000_000) * 1 + (aiOutcome.usage.output / 1_000_000) * 5
    const costEur = Math.round(usd * 0.92 * 1_000_000) / 1_000_000
    const durationMs = Date.now() - t0
    await supabaseAdmin.from('ai_usage_log').insert({
      user_id: actingUserId,
      operation: 'community_anonymize',
      ai_model: ANTHROPIC_MODEL,
      input_tokens: aiOutcome.usage.input,
      output_tokens: aiOutcome.usage.output,
      cost_eur: costEur,
      duration_ms: durationMs,
      success: true,
    })
    // Cost-tracker centralisé (ai-usage-tracker Edge Function, vague suivante).
    // Best-effort, ne bloque pas la requête utilisateur si indisponible.
    try {
      await fetch(`${supabaseUrl}/functions/v1/ai-usage-tracker`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${serviceRole}`,
        },
        body: JSON.stringify({
          userId: actingUserId,
          feature: 'community_anonymize',
          provider: 'anthropic',
          modelUsed: ANTHROPIC_MODEL,
          inputTokens: aiOutcome.usage.input,
          outputTokens: aiOutcome.usage.output,
          cachedInputTokens: 0,
          cacheWriteTokens: 0,
          estimatedCostEur: costEur,
          latencyMs: durationMs,
        }),
      })
    } catch {
      // silent — tracker is best-effort
    }
  }

  const report: DetectionReport = {
    context_description: finalFields.context_description,
    question: finalFields.question,
    decision_made: finalFields.decision_made,
    justification: finalFields.justification,
    flagged: finalFields.flagged,
    flag_reason: finalFields.flag_reason,
    patterns_detected: aggregateCounts,
  }

  return jsonResponse({
    case_id: row.id,
    status: newStatus,
    anonymized: true,
    report,
  })
})
