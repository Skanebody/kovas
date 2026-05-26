// KOVAS — Edge Function `generate-mission-briefing`
//
// POST `/generate-mission-briefing`
//
// Génère un briefing IA personnalisé pour une mission à venir.
// Use case Altman §16 / IA-first #11 du Strategic Playbook.
//
// Le briefing est destiné au diagnostiqueur 30 min avant son rendez-vous :
//   - Rappel propriétaire + adresse + créneau
//   - Synthèse risques Géorisques (radon, PPRI, argiles, cavités) si dispo
//   - Synthèse historique DPE du bien s'il existe (DVF + ADEME)
//   - Conseils approche client (sobre, factuel — pas de "tips marketing")
//
// Authentication : Bearer JWT user (Supabase Auth). RLS s'applique.
//
// Body :
// {
//   "mission_id": "uuid"
// }
//
// Réponse :
// {
//   "ok": true,
//   "mission_id": "uuid",
//   "briefing": {
//     "headline": "Mission Mme Martin · 14h · 12 rue de la République, Dieppe",
//     "context": "DPE F en 2019, propriétaire potentiellement éligible MaPrimeRénov'.",
//     "risks": ["Zone radon catégorie 2 — vérifier la ventilation"],
//     "checklist": ["Plaque chaudière", "Section ERP page 12 du dossier"],
//     "duration_estimate_minutes": 90
//   },
//   "tokens_used": { "input": 1234, "output": 412 },
//   "cost_eur": 0.0042
// }
//
// Modèle : Claude Haiku 4.5 (rapide + bon marché, briefing court < 500 mots).

/// <reference lib="deno.ns" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 800

// Prix Haiku 4.5 (€/M tokens, est. mai 2026)
const COST_INPUT_PER_M = 1.0
const COST_OUTPUT_PER_M = 5.0

interface RequestBody {
  mission_id: string
}

interface MissionRow {
  id: string
  organization_id: string
  scheduled_at: string | null
  type: string
  status: string
  property_id: string
  client_id: string | null
  notes: string | null
  properties: {
    address: string | null
    postal_code: string | null
    city: string | null
    insee_code: string | null
    surface_total: number | null
    year_built: number | null
    property_type: string | null
  } | null
  clients: {
    display_name: string | null
    email: string | null
    phone: string | null
  } | null
}

interface BriefingPayload {
  headline: string
  context: string
  risks: string[]
  checklist: string[]
  duration_estimate_minutes: number
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

function badRequest(message: string): Response {
  return jsonResponse({ ok: false, error: message }, { status: 400 })
}

function unauthorized(message = 'Unauthorized'): Response {
  return jsonResponse({ ok: false, error: message }, { status: 401 })
}

function serverError(message: string): Response {
  return jsonResponse({ ok: false, error: message }, { status: 500 })
}

function formatAddress(p: NonNullable<MissionRow['properties']>): string {
  const parts = [p.address, [p.postal_code, p.city].filter(Boolean).join(' ')]
  return parts.filter(Boolean).join(', ')
}

function buildPrompt(mission: MissionRow): string {
  const p = mission.properties
  const c = mission.clients
  const address = p ? formatAddress(p) : 'Adresse inconnue'
  const scheduledDate = mission.scheduled_at
    ? new Date(mission.scheduled_at).toLocaleString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Paris',
      })
    : 'Date non fixée'

  const lines: string[] = [
    'Tu es un assistant métier pour un diagnostiqueur immobilier français.',
    'Ton rôle : générer un briefing concis et factuel à lire 30 minutes avant la mission.',
    '',
    'Style obligatoire : ton SOBRE PROFESSIONNEL, vouvoiement, paragraphes courts, AUCUN superlatif',
    '("génial", "leader", "excellent" interdits), AUCUN emoji sauf ✓ et →. JAMAIS de marketing.',
    "Le diagnostiqueur a 40 ans, 8-15 ans d'expérience, il veut des FAITS pas du blabla.",
    '',
    'Mission :',
    `- Type : ${mission.type}`,
    `- Date/heure : ${scheduledDate}`,
    `- Adresse : ${address}`,
    `- Client : ${c?.display_name ?? 'Inconnu'}`,
    `- Bien : ${p?.property_type ?? 'type non précisé'}${
      p?.surface_total ? `, ${p.surface_total} m²` : ''
    }${p?.year_built ? `, construit en ${p.year_built}` : ''}`,
    `- Notes diagnostiqueur : ${mission.notes ?? 'aucune'}`,
    '',
    "Génère STRICTEMENT un JSON avec cette structure (rien d'autre, pas de markdown wrapper) :",
    '{',
    '  "headline": "1 ligne, format : Mission [client] · [heure] · [adresse courte]",',
    '  "context": "2-3 phrases factuelles sur le contexte (ancienneté bien, indice typologie)",',
    '  "risks": ["1 à 3 risques à vérifier, formulés en impératif court"],',
    '  "checklist": ["3 à 5 points concrets à ne pas oublier sur place"],',
    '  "duration_estimate_minutes": 90',
    '}',
    '',
    "Si pas assez d'information pour un champ, mettre une valeur générique honnête (pas inventer de chiffres).",
  ]
  return lines.join('\n')
}

function parseAiResponse(raw: string): BriefingPayload | null {
  // Claude peut wrapper en ```json ... ``` malgré l'instruction. On strip.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  try {
    const parsed = JSON.parse(cleaned) as Partial<BriefingPayload>
    if (
      typeof parsed.headline !== 'string' ||
      typeof parsed.context !== 'string' ||
      !Array.isArray(parsed.risks) ||
      !Array.isArray(parsed.checklist) ||
      typeof parsed.duration_estimate_minutes !== 'number'
    ) {
      return null
    }
    return {
      headline: parsed.headline,
      context: parsed.context,
      risks: parsed.risks.filter((r): r is string => typeof r === 'string'),
      checklist: parsed.checklist.filter((c): c is string => typeof c === 'string'),
      duration_estimate_minutes: parsed.duration_estimate_minutes,
    }
  } catch {
    return null
  }
}

async function callClaude(prompt: string, apiKey: string) {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Claude API ${res.status}: ${text.slice(0, 400)}`)
  }

  interface ClaudeResponse {
    content: Array<{ type: string; text?: string }>
    usage: { input_tokens: number; output_tokens: number }
  }
  const json = (await res.json()) as ClaudeResponse
  const text = json.content.find((c) => c.type === 'text')?.text ?? ''
  return {
    text,
    inputTokens: json.usage.input_tokens,
    outputTokens: json.usage.output_tokens,
  }
}

function computeCostEur(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * COST_INPUT_PER_M
  const outputCost = (outputTokens / 1_000_000) * COST_OUTPUT_PER_M
  return Number((inputCost + outputCost).toFixed(6))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })
  if (req.method !== 'POST') return badRequest('POST only')

  // Auth check
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return unauthorized('Bearer token required')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!supabaseUrl || !supabaseAnon) return serverError('Supabase env missing')
  if (!anthropicKey) return serverError('Anthropic API key missing')

  // Parse body
  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return badRequest('Invalid JSON')
  }
  if (!body.mission_id || typeof body.mission_id !== 'string') {
    return badRequest('mission_id (uuid) required')
  }

  // Init client with user JWT (RLS will scope to user's org)
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })

  // Fetch mission + property + client
  const { data: mission, error: missionErr } = await supabase
    .from('missions')
    .select(
      'id, organization_id, scheduled_at, type, status, property_id, client_id, notes, properties(address, postal_code, city, insee_code, surface_total, year_built, property_type), clients(display_name, email, phone)',
    )
    .eq('id', body.mission_id)
    .is('deleted_at', null)
    .maybeSingle<MissionRow>()

  if (missionErr) return serverError(`DB error: ${missionErr.message}`)
  if (!mission) return jsonResponse({ ok: false, error: 'Mission not found' }, { status: 404 })

  // Build prompt + call Claude
  const prompt = buildPrompt(mission)
  let aiResult: { text: string; inputTokens: number; outputTokens: number }
  try {
    aiResult = await callClaude(prompt, anthropicKey)
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Claude call failed')
  }

  // Parse JSON
  const briefing = parseAiResponse(aiResult.text)
  if (!briefing) {
    return serverError('AI returned non-parseable JSON')
  }

  const costEur = computeCostEur(aiResult.inputTokens, aiResult.outputTokens)

  return jsonResponse({
    ok: true,
    mission_id: mission.id,
    briefing,
    tokens_used: { input: aiResult.inputTokens, output: aiResult.outputTokens },
    cost_eur: costEur,
  })
})
