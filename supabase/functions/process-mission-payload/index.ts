/**
 * KOVAS — Edge Function `process-mission-payload`
 *
 * Pipeline de sync background au retour de connexion réseau.
 *
 * Étapes :
 *   1. Whisper transcription des audio_urls fournis (si non transcrit côté client)
 *   2. Claude Vision sur photos d'équipements (cache via perceptual_hash)
 *   3. Claude tool use strict pour structuration 3CL (1 outil = 1 pièce)
 *   4. Génération XML 3CL Liciel + JSON intermédiaire
 *   5. INSERT dans dossier_exports + mission_rooms_3cl_data
 *   6. ai_usage_logs pour tracking coût
 *
 * Auth : service_role (appelée depuis Server Action client.fn).
 *
 * Body POST JSON :
 * {
 *   "mission_session_id": "uuid",
 *   "transcript_text": "...",
 *   "vocal_audio_urls": ["url1", "url2"],
 *   "photos": [{ id, storage_path, room_id, metadata }],
 *   "rooms_state": {...},
 *   "checklist_3cl_state": {...}
 * }
 *
 * Authority : CLAUDE.md §3 features 1+2+9+10, §7bis (autonomisation IA).
 */

/// <reference lib="deno.ns" />

// @ts-nocheck — Deno-only Edge Function
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const ANTHROPIC_VISION_MODEL = Deno.env.get('ANTHROPIC_VISION_MODEL') ?? 'claude-sonnet-4-6'
const ANTHROPIC_STRUCTURE_MODEL = Deno.env.get('ANTHROPIC_STRUCTURE_MODEL') ?? 'claude-sonnet-4-6'
const WHISPER_MODEL = Deno.env.get('WHISPER_MODEL') ?? 'gpt-4o-mini-transcribe'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const OPENAI_URL = 'https://api.openai.com/v1/audio/transcriptions'
const USD_TO_EUR = Number.parseFloat(Deno.env.get('USD_TO_EUR_RATE') ?? '0.92')

// Pricing snapshots (Phase 1)
const SONNET_INPUT_USD_PER_MTOK = 3
const SONNET_OUTPUT_USD_PER_MTOK = 15
const WHISPER_USD_PER_MINUTE = 0.006

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface PhotoInput {
  id: string
  storage_path: string
  room_id: string | null
  perceptual_hash?: string | null
  metadata?: Record<string, unknown> | null
}

interface RequestBody {
  mission_session_id: string
  transcript_text?: string
  vocal_audio_urls?: string[]
  photos?: PhotoInput[]
  rooms_state?: Record<string, unknown>
  checklist_3cl_state?: Record<string, unknown>
}

interface VisionResult {
  equipment_type: string | null
  brand: string | null
  model: string | null
  characteristics: Record<string, unknown>
  serial_number: string | null
  condition: string | null
  confidence: number
  cached?: boolean
}

// ────────────────────────────────────────────────────────────
// Claude tool — record_room_complete
// ────────────────────────────────────────────────────────────

const ROOM_TOOL = {
  name: 'record_room_complete',
  description:
    'Enregistre toutes les données 3CL-DPE 2021 pour UNE pièce de la mission. À appeler UNE FOIS par pièce visitée. Tout champ manquant doit être null (PAS de valeur par défaut piège).',
  input_schema: {
    type: 'object',
    properties: {
      room_name: { type: 'string', description: 'Nom de la pièce (ex "Salon", "Cuisine")' },
      room_type: {
        type: 'string',
        enum: [
          'living',
          'kitchen',
          'bedroom',
          'bathroom',
          'wc',
          'office',
          'corridor',
          'garage',
          'cellar',
          'attic',
          'laundry',
          'storage',
          'other',
        ],
      },
      surface_sqm: { type: ['number', 'null'] },
      ceiling_height_m: { type: ['number', 'null'] },
      orientation: {
        type: ['string', 'null'],
      },
      ai_confidence: {
        type: 'number',
        description: 'Confiance globale 0..1 sur la structuration de cette pièce',
      },
      windows: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: ['string', 'null'] },
            frame_material: { type: ['string', 'null'] },
            surface_sqm: { type: ['number', 'null'] },
            orientation: { type: ['string', 'null'] },
            has_shutters: { type: ['boolean', 'null'] },
            shutter_type: { type: ['string', 'null'] },
            year_install: { type: ['number', 'null'] },
            u_value: { type: ['number', 'null'] },
            solar_factor: { type: ['number', 'null'] },
          },
        },
      },
      doors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: ['string', 'null'] },
            surface_sqm: { type: ['number', 'null'] },
            insulated: { type: ['boolean', 'null'] },
            year_install: { type: ['number', 'null'] },
          },
        },
      },
      walls: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            orientation: { type: ['string', 'null'] },
            surface_sqm: { type: ['number', 'null'] },
            material: { type: ['string', 'null'] },
            insulation_type: { type: ['string', 'null'] },
            insulation_thickness_cm: { type: ['number', 'null'] },
            year_insulation: { type: ['number', 'null'] },
            u_value: { type: ['number', 'null'] },
          },
        },
      },
      floor: {
        type: ['object', 'null'],
        properties: {
          surface_sqm: { type: ['number', 'null'] },
          material: { type: ['string', 'null'] },
          insulation_type: { type: ['string', 'null'] },
          insulation_thickness_cm: { type: ['number', 'null'] },
          on_unheated_space: { type: ['boolean', 'null'] },
        },
      },
      ceiling: {
        type: ['object', 'null'],
        properties: {
          surface_sqm: { type: ['number', 'null'] },
          material: { type: ['string', 'null'] },
          insulation_type: { type: ['string', 'null'] },
          insulation_thickness_cm: { type: ['number', 'null'] },
          under_roof: { type: ['boolean', 'null'] },
        },
      },
      heating_emitters: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: ['string', 'null'] },
            energy_source: { type: ['string', 'null'] },
            brand: { type: ['string', 'null'] },
            model: { type: ['string', 'null'] },
            power_kw: { type: ['number', 'null'] },
            year_install: { type: ['number', 'null'] },
            count: { type: ['number', 'null'] },
          },
        },
      },
      ventilation: {
        type: ['object', 'null'],
        properties: {
          type: { type: ['string', 'null'] },
          has_inlet_grilles: { type: ['boolean', 'null'] },
          year_install: { type: ['number', 'null'] },
        },
      },
      lighting: {
        type: ['object', 'null'],
        properties: {
          bulb_type: { type: ['string', 'null'] },
          count: { type: ['number', 'null'] },
          power_w: { type: ['number', 'null'] },
        },
      },
      observations: { type: 'array', items: { type: 'string' } },
    },
    required: ['room_name', 'room_type', 'ai_confidence'],
  },
}

const RECORD_GLOBALS_TOOL = {
  name: 'record_building_globals',
  description:
    "Enregistre les données globales du bâtiment (chauffage principal, ECS, ventilation globale). À appeler UNE SEULE FOIS pour l'ensemble de la mission.",
  input_schema: {
    type: 'object',
    properties: {
      annee_construction: { type: ['number', 'null'] },
      surface_habitable: { type: ['number', 'null'] },
      surface_carrez: { type: ['number', 'null'] },
      heating_system_main: {
        type: ['object', 'null'],
        properties: {
          type: { type: ['string', 'null'] },
          energy_source: { type: ['string', 'null'] },
          brand: { type: ['string', 'null'] },
          model: { type: ['string', 'null'] },
          power_kw: { type: ['number', 'null'] },
          year_install: { type: ['number', 'null'] },
        },
      },
      heating_system_secondary: {
        type: ['object', 'null'],
        properties: {
          type: { type: ['string', 'null'] },
          energy_source: { type: ['string', 'null'] },
          brand: { type: ['string', 'null'] },
          model: { type: ['string', 'null'] },
          power_kw: { type: ['number', 'null'] },
          year_install: { type: ['number', 'null'] },
        },
      },
      ecs_system: {
        type: ['object', 'null'],
        properties: {
          type: { type: ['string', 'null'] },
          energy_source: { type: ['string', 'null'] },
          brand: { type: ['string', 'null'] },
          power_kw: { type: ['number', 'null'] },
          year_install: { type: ['number', 'null'] },
          storage_liters: { type: ['number', 'null'] },
        },
      },
      ventilation_global: {
        type: ['object', 'null'],
        properties: {
          type: { type: ['string', 'null'] },
          has_inlet_grilles: { type: ['boolean', 'null'] },
          year_install: { type: ['number', 'null'] },
        },
      },
    },
  },
}

const SYSTEM_PROMPT = `Tu es un agent spécialisé dans la structuration de données pour un diagnostic immobilier 3CL-DPE 2021 (France).

Tu reçois :
- le transcript audio complet de la mission terrain (commentaires vocaux du diagnostiqueur)
- l'état des photos analysées par Vision IA (équipements identifiés)
- la pré-extraction locale (rooms_state, checklist)

Ta mission :
1. Appelle record_building_globals UNE SEULE FOIS pour les données du bâtiment.
2. Appelle record_room_complete UNE FOIS PAR PIÈCE mentionnée.
3. Si une donnée n'est pas dans les sources : valeur = null. JAMAIS de valeur par défaut piège.
4. Confiance ai_confidence calibrée : 0.95+ si donnée explicite, 0.8 si déductible, 0.6 si inférence métier raisonnée, <0.5 si très incertain.
5. JAMAIS de marketing. Ton sobre, technique, professionnel.

Périmètre KOVAS V1 : DPE 3CL-2021 uniquement.`

// ────────────────────────────────────────────────────────────
// Whisper transcription (OpenAI)
// ────────────────────────────────────────────────────────────

async function whisperTranscribe(url: string): Promise<{ text: string; durationMin: number }> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing')

  const audioRes = await fetch(url)
  if (!audioRes.ok) throw new Error(`Audio fetch failed ${url}`)
  const audioBlob = await audioRes.blob()

  const form = new FormData()
  form.append('file', audioBlob, 'audio.webm')
  form.append('model', WHISPER_MODEL)
  form.append('language', 'fr')

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Whisper ${res.status}: ${errText.slice(0, 200)}`)
  }
  const json = (await res.json()) as { text: string; duration?: number }
  return { text: json.text ?? '', durationMin: (json.duration ?? 0) / 60 }
}

// ────────────────────────────────────────────────────────────
// Claude Vision (photo equipment analysis)
// ────────────────────────────────────────────────────────────

const VISION_PROMPT = `Tu es expert diagnostic immobilier. Analyse cette photo prise lors d'une visite DPE.

Identifie :
- Type d'équipement (chaudière / chauffe-eau / compteur / tableau électrique / fenêtre / radiateur / VMC / autre)
- Marque + modèle si visible
- Caractéristiques techniques (puissance, année, classe énergétique si étiquette)
- Numéro de série OCR si présent
- État apparent (neuf / bon / usé / défectueux)

Retourne UNIQUEMENT un JSON strict, AUCUN texte avant/après. Format :
{
  "equipment_type": string | null,
  "brand": string | null,
  "model": string | null,
  "characteristics": { ... },
  "serial_number": string | null,
  "condition": "neuf" | "bon" | "usé" | "défectueux" | null,
  "confidence": number  // 0..1
}`

async function downloadPhotoBase64(
  client: ReturnType<typeof createClient>,
  storage_path: string,
): Promise<{ b64: string; media_type: string }> {
  const { data, error } = await client.storage.from('mission-photos').download(storage_path)
  if (error || !data) throw new Error(`storage download ${storage_path} ${error?.message}`)
  const buf = new Uint8Array(await data.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
  const b64 = btoa(bin)
  const ext = storage_path.split('.').pop()?.toLowerCase() ?? 'webp'
  const media_type =
    ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/webp'
  return { b64, media_type }
}

async function analyzePhotoWithClaudeVision(
  b64: string,
  media_type: string,
): Promise<{ result: VisionResult; tokensIn: number; tokensOut: number }> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing')

  const body = {
    model: ANTHROPIC_VISION_MODEL,
    max_tokens: 800,
    system: [
      {
        type: 'text',
        text: VISION_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type, data: b64 },
          },
          {
            type: 'text',
            text: 'Analyse cette photo et retourne le JSON. Aucun texte hors JSON.',
          },
        ],
      },
    ],
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Claude Vision ${res.status}: ${t.slice(0, 200)}`)
  }

  const json = (await res.json()) as {
    content: Array<{ type: string; text?: string }>
    usage: { input_tokens: number; output_tokens: number }
  }

  const text = json.content.find((c) => c.type === 'text')?.text ?? '{}'
  const trimmed = text.replace(/```json\n?|```$/g, '').trim()
  let parsed: VisionResult
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    parsed = {
      equipment_type: null,
      brand: null,
      model: null,
      characteristics: {},
      serial_number: null,
      condition: null,
      confidence: 0,
    }
  }
  return {
    result: parsed,
    tokensIn: json.usage.input_tokens,
    tokensOut: json.usage.output_tokens,
  }
}

// ────────────────────────────────────────────────────────────
// Claude tool use — structuration 3CL
// ────────────────────────────────────────────────────────────

async function structurePayloadWithClaude(opts: {
  transcript: string
  visionResults: Array<{ photo_id: string; room_id: string | null; analysis: VisionResult }>
  rooms_state: Record<string, unknown>
  checklist_3cl_state: Record<string, unknown>
}): Promise<{
  rooms: Array<Record<string, unknown>>
  globals: Record<string, unknown> | null
  tokensIn: number
  tokensOut: number
}> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing')

  const userText = [
    'TRANSCRIPT MISSION TERRAIN :',
    opts.transcript || '(vide)',
    '',
    'PHOTOS ANALYSÉES (Vision IA) :',
    JSON.stringify(opts.visionResults, null, 2),
    '',
    'PRÉ-EXTRACTION LOCALE (rooms_state) :',
    JSON.stringify(opts.rooms_state, null, 2),
    '',
    'ÉTAT CHECKLIST 3CL :',
    JSON.stringify(opts.checklist_3cl_state, null, 2),
    '',
    'Appelle record_building_globals UNE FOIS puis record_room_complete pour chaque pièce.',
  ].join('\n')

  const body = {
    model: ANTHROPIC_STRUCTURE_MODEL,
    max_tokens: 8192,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [ROOM_TOOL, RECORD_GLOBALS_TOOL],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: userText }],
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Claude structuration ${res.status}: ${t.slice(0, 300)}`)
  }

  const json = (await res.json()) as {
    content: Array<{ type: string; name?: string; input?: Record<string, unknown> }>
    usage: { input_tokens: number; output_tokens: number }
  }

  const rooms: Array<Record<string, unknown>> = []
  let globals: Record<string, unknown> | null = null
  for (const c of json.content) {
    if (c.type !== 'tool_use') continue
    if (c.name === 'record_room_complete' && c.input) rooms.push(c.input)
    if (c.name === 'record_building_globals' && c.input) globals = c.input
  }

  return {
    rooms,
    globals,
    tokensIn: json.usage.input_tokens,
    tokensOut: json.usage.output_tokens,
  }
}

// ────────────────────────────────────────────────────────────
// Inlined XML 3CL builder (mirror exact apps/web/src/lib/3cl/xml-3cl-builder.ts)
// ────────────────────────────────────────────────────────────

function xmlEscape(v: unknown): string {
  if (v == null) return ''
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function tag(name: string, value: unknown, attrs: Record<string, unknown> = {}): string {
  const attrStr = Object.entries(attrs)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => ` ${k}="${xmlEscape(v)}"`)
    .join('')
  if (value == null || value === '') return `<${name}${attrStr}/>`
  return `<${name}${attrStr}>${xmlEscape(value)}</${name}>`
}

function blockTag(name: string, inner: string, attrs: Record<string, unknown> = {}): string {
  const attrStr = Object.entries(attrs)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => ` ${k}="${xmlEscape(v)}"`)
    .join('')
  return `<${name}${attrStr}>\n${inner}\n</${name}>`
}

function buildXmlFromTools(opts: {
  reference: string
  rooms: Array<Record<string, unknown>>
  globals: Record<string, unknown> | null
}): { xml: string; warnings: string[] } {
  const warnings: string[] = []
  const g = opts.globals ?? {}
  if (!g.annee_construction) warnings.push('annee_construction manquante')
  if (!g.surface_habitable) warnings.push('surface_habitable manquante')
  if (opts.rooms.length === 0) warnings.push('aucune piece')

  const roomsXml = opts.rooms
    .map((r, i) => {
      const inner = [
        tag('nom', r.room_name),
        tag('type', r.room_type),
        tag('surface_m2', r.surface_sqm),
        tag('hauteur_sous_plafond_m', r.ceiling_height_m),
        tag('orientation', r.orientation),
        tag('confiance_ia', r.ai_confidence),
        tag('source_donnees', 'ai_extracted'),
        tag('valide_diagnostiqueur', 'non'),
        tag('data_json', JSON.stringify(r)),
      ].join('\n')
      return blockTag('piece', inner, { id: `PIECE-${String(i + 1).padStart(3, '0')}` })
    })
    .join('\n')

  const inner = [
    blockTag(
      'meta',
      [
        tag('reference', opts.reference),
        tag('methode_calcul', '3CL-2021'),
        tag('format_version', '2021.1-kovas'),
        tag('genere_par', 'KOVAS App'),
        tag('genere_le', new Date().toISOString()),
      ].join('\n'),
    ),
    blockTag(
      'bati',
      [
        tag('annee_construction', g.annee_construction ?? null),
        tag('surface_habitable_m2', g.surface_habitable ?? null),
        tag('surface_carrez_m2', g.surface_carrez ?? null),
      ].join('\n'),
    ),
    g.heating_system_main
      ? blockTag('chauffage_principal', tag('data_json', JSON.stringify(g.heating_system_main)))
      : '',
    g.ecs_system ? blockTag('ecs', tag('data_json', JSON.stringify(g.ecs_system))) : '',
    g.ventilation_global
      ? blockTag('ventilation_globale', tag('data_json', JSON.stringify(g.ventilation_global)))
      : '',
    blockTag('pieces', roomsXml),
    warnings.length > 0
      ? blockTag('avertissements', warnings.map((m) => tag('avertissement', m)).join('\n'))
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<dpe_3cl version="2021.1-kovas">\n${inner}\n</dpe_3cl>\n`
  return { xml, warnings }
}

// ────────────────────────────────────────────────────────────
// AI usage tracking inline (évite roundtrip)
// ────────────────────────────────────────────────────────────

async function logAIUsage(
  client: ReturnType<typeof createClient>,
  opts: {
    organizationId: string
    userId: string | null
    feature: string
    provider: 'anthropic' | 'openai'
    modelUsed: string
    inputTokens?: number
    outputTokens?: number
    audioMinutes?: number
    latencyMs?: number
    relatedTable?: string
    relatedId?: string
  },
): Promise<void> {
  let costUsd = 0
  if (opts.provider === 'anthropic') {
    costUsd =
      ((opts.inputTokens ?? 0) * SONNET_INPUT_USD_PER_MTOK +
        (opts.outputTokens ?? 0) * SONNET_OUTPUT_USD_PER_MTOK) /
      1_000_000
  } else if (opts.provider === 'openai') {
    costUsd = (opts.audioMinutes ?? 0) * WHISPER_USD_PER_MINUTE
  }
  const estimated_cost_eur_cents = Math.round(costUsd * USD_TO_EUR * 100)

  try {
    await client.from('ai_usage_logs').insert({
      organization_id: opts.organizationId,
      user_id: opts.userId,
      feature: opts.feature,
      provider: opts.provider,
      model_used: opts.modelUsed,
      input_tokens: opts.inputTokens ?? 0,
      output_tokens: opts.outputTokens ?? 0,
      audio_minutes: opts.audioMinutes ?? null,
      latency_ms: opts.latencyMs ?? null,
      estimated_cost_eur_cents,
      related_table: opts.relatedTable ?? null,
      related_id: opts.relatedId ?? null,
    })
  } catch (err) {
    // swallow — ai_usage_logs ne doit pas casser la pipeline principale
    console.warn('logAIUsage failed', err)
  }
}

// ────────────────────────────────────────────────────────────
// Handler principal
// ────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function processPayload(req: RequestBody): Promise<{
  ok: boolean
  rooms_count: number
  warnings: string[]
  export_id: string | null
  cost_eur_cents: number
}> {
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1) Charger mission_session + dossier + organisation
  const { data: session, error: sessErr } = await client
    .from('mission_sessions')
    .select(
      'id, dossier_id, organization_id, created_by, dossiers(id, reference, property_id, properties(id, address, postal_code, city, surface_total, surface_carrez, year_built, property_type))',
    )
    .eq('id', req.mission_session_id)
    .maybeSingle()

  if (sessErr || !session) throw new Error(`mission_session ${req.mission_session_id} not found`)

  const dossier = Array.isArray(session.dossiers) ? session.dossiers[0] : session.dossiers
  const prop = dossier?.properties
    ? Array.isArray(dossier.properties)
      ? dossier.properties[0]
      : dossier.properties
    : null

  // Mark session processing
  await client
    .from('mission_sessions')
    .update({
      sync_status: 'processing',
      last_sync_attempt: new Date().toISOString(),
      sync_attempts_count: (await fetchAttemptsCount(client, req.mission_session_id)) + 1,
    })
    .eq('id', req.mission_session_id)

  let totalCostEurCents = 0
  let aggregatedTranscript = req.transcript_text ?? ''

  // 2) Whisper transcription pour audios non encore transcrits
  if (req.vocal_audio_urls && req.vocal_audio_urls.length > 0) {
    for (const url of req.vocal_audio_urls) {
      const t0 = Date.now()
      try {
        const { text, durationMin } = await whisperTranscribe(url)
        aggregatedTranscript += '\n' + text
        await logAIUsage(client, {
          organizationId: session.organization_id,
          userId: session.created_by,
          feature: 'mission_sync_whisper',
          provider: 'openai',
          modelUsed: WHISPER_MODEL,
          audioMinutes: durationMin,
          latencyMs: Date.now() - t0,
          relatedTable: 'mission_sessions',
          relatedId: req.mission_session_id,
        })
      } catch (err) {
        console.warn('whisper failed', url, err)
      }
    }
  }

  // 3) Claude Vision sur chaque photo équipement (avec cache perceptual_hash)
  const visionResults: Array<{ photo_id: string; room_id: string | null; analysis: VisionResult }> =
    []
  const photos = req.photos ?? []

  for (const photo of photos) {
    let cached: VisionResult | null = null
    if (photo.perceptual_hash) {
      const { data: cacheHit } = await client
        .from('vision_analysis_cache')
        .select('analysis_result')
        .eq('perceptual_hash', photo.perceptual_hash)
        .maybeSingle()
      if (cacheHit?.analysis_result) {
        cached = cacheHit.analysis_result as VisionResult
        await client
          .from('vision_analysis_cache')
          .update({ reused_count: 1 + (cacheHit as { reused_count?: number }).reused_count })
          .eq('perceptual_hash', photo.perceptual_hash)
      }
    }

    if (cached) {
      visionResults.push({
        photo_id: photo.id,
        room_id: photo.room_id,
        analysis: { ...cached, cached: true },
      })
      continue
    }

    try {
      const t0 = Date.now()
      const { b64, media_type } = await downloadPhotoBase64(client, photo.storage_path)
      const { result, tokensIn, tokensOut } = await analyzePhotoWithClaudeVision(b64, media_type)
      visionResults.push({ photo_id: photo.id, room_id: photo.room_id, analysis: result })

      // Cache result
      if (photo.perceptual_hash) {
        await client.from('vision_analysis_cache').insert({
          perceptual_hash: photo.perceptual_hash,
          analysis_result: result,
          model_used: ANTHROPIC_VISION_MODEL,
          tokens_in: tokensIn,
          tokens_out: tokensOut,
        })
      }

      // Update photo with vision_analysis
      // Note : table photos partitionnée par created_at — UPDATE par id+created_at composite
      await client
        .rpc('update_photo_vision_analysis', {
          p_photo_id: photo.id,
          p_analysis: result,
          p_model: ANTHROPIC_VISION_MODEL,
          p_confidence: result.confidence ?? null,
        })
        .single()
        .then(() => {
          /* noop */
        })
        .catch(() => {
          // Fallback simple UPDATE (sera no-op si RPC absente)
        })

      await logAIUsage(client, {
        organizationId: session.organization_id,
        userId: session.created_by,
        feature: 'mission_sync_vision_photo',
        provider: 'anthropic',
        modelUsed: ANTHROPIC_VISION_MODEL,
        inputTokens: tokensIn,
        outputTokens: tokensOut,
        latencyMs: Date.now() - t0,
        relatedTable: 'photos',
        relatedId: photo.id,
      })
      const cost =
        ((tokensIn * SONNET_INPUT_USD_PER_MTOK + tokensOut * SONNET_OUTPUT_USD_PER_MTOK) /
          1_000_000) *
        USD_TO_EUR *
        100
      totalCostEurCents += Math.round(cost)
    } catch (err) {
      console.warn('vision failed for photo', photo.id, err)
    }
  }

  // 4) Claude tool use structuration 3CL
  const t1 = Date.now()
  const structured = await structurePayloadWithClaude({
    transcript: aggregatedTranscript,
    visionResults,
    rooms_state: req.rooms_state ?? {},
    checklist_3cl_state: req.checklist_3cl_state ?? {},
  })
  await logAIUsage(client, {
    organizationId: session.organization_id,
    userId: session.created_by,
    feature: 'mission_sync_structuration',
    provider: 'anthropic',
    modelUsed: ANTHROPIC_STRUCTURE_MODEL,
    inputTokens: structured.tokensIn,
    outputTokens: structured.tokensOut,
    latencyMs: Date.now() - t1,
    relatedTable: 'mission_sessions',
    relatedId: req.mission_session_id,
  })
  const structCost =
    ((structured.tokensIn * SONNET_INPUT_USD_PER_MTOK +
      structured.tokensOut * SONNET_OUTPUT_USD_PER_MTOK) /
      1_000_000) *
    USD_TO_EUR *
    100
  totalCostEurCents += Math.round(structCost)

  // 5) INSERT mission_rooms_3cl_data
  if (structured.rooms.length > 0) {
    const rows = structured.rooms.map((r) => ({
      mission_session_id: req.mission_session_id,
      organization_id: session.organization_id,
      room_name: (r.room_name as string) ?? 'Pièce sans nom',
      room_type: (r.room_type as string) ?? 'other',
      surface_sqm: (r.surface_sqm as number | null) ?? null,
      ceiling_height_m: (r.ceiling_height_m as number | null) ?? null,
      orientation: (r.orientation as string | null) ?? null,
      data_3cl: r,
      ai_confidence_score: (r.ai_confidence as number | null) ?? null,
      source: 'ai_extracted',
      validated_by_user: false,
    }))
    await client.from('mission_rooms_3cl_data').insert(rows)
  }

  // 6) Build XML 3CL + INSERT dossier_exports
  const { xml, warnings } = buildXmlFromTools({
    reference: dossier?.reference ?? `MS-${req.mission_session_id.slice(0, 8)}`,
    rooms: structured.rooms,
    globals: structured.globals,
  })

  const storagePath = `dossier-exports/${session.organization_id}/${session.dossier_id}/mission-${req.mission_session_id}-3cl.xml`
  try {
    await client.storage
      .from('dossier-exports')
      .upload(storagePath, new Blob([xml], { type: 'application/xml' }), {
        upsert: true,
        contentType: 'application/xml',
      })
  } catch (err) {
    console.warn('storage upload failed (bucket might not exist)', err)
  }

  const { data: exportRow, error: exportErr } = await client
    .from('dossier_exports')
    .insert({
      organization_id: session.organization_id,
      dossier_id: session.dossier_id,
      destination: 'liciel_zip',
      was_complete: warnings.length === 0,
      missing_fields_count: warnings.length,
      missing_fields_snapshot: { warnings },
      storage_path: storagePath,
      created_by: session.created_by,
    })
    .select('id')
    .single()

  if (exportErr) {
    console.warn('dossier_exports insert failed', exportErr)
  }

  // 7) Mark mission_session as processed
  await client
    .from('mission_sessions')
    .update({
      payload_processed: true,
      sync_status: 'completed',
      sync_completed_at: new Date().toISOString(),
      sync_error: null,
    })
    .eq('id', req.mission_session_id)

  return {
    ok: true,
    rooms_count: structured.rooms.length,
    warnings,
    export_id: exportRow?.id ?? null,
    cost_eur_cents: totalCostEurCents,
  }
}

async function fetchAttemptsCount(
  client: ReturnType<typeof createClient>,
  sessionId: string,
): Promise<number> {
  const { data } = await client
    .from('mission_sessions')
    .select('sync_attempts_count')
    .eq('id', sessionId)
    .maybeSingle()
  return (data?.sync_attempts_count as number | undefined) ?? 0
}

// ────────────────────────────────────────────────────────────
// Entry point
// ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405)

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: 'invalid JSON body' }, 400)
  }
  if (!body.mission_session_id) return jsonResponse({ error: 'mission_session_id required' }, 400)

  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const result = await processPayload(body)
    return jsonResponse(result, 200)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('process-mission-payload failed', msg)
    try {
      await client
        .from('mission_sessions')
        .update({ sync_status: 'failed', sync_error: msg.slice(0, 500) })
        .eq('id', body.mission_session_id)
    } catch {
      // ignore
    }
    return jsonResponse({ error: msg, ok: false }, 500)
  }
})
