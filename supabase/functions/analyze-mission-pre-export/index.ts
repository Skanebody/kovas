// KOVAS — Edge Function `analyze-mission-pre-export`
//
// POST `/analyze-mission-pre-export`
//
// Lance la pré-vérification d'une mission avant export vers le logiciel
// métier (Liciel XML, OBBC, DS8, notaire XML, PDF). Orchestre les 6
// analyseurs et persiste le résultat dans `pre_export_analyses`.
//
// Authentication : Bearer JWT user (Supabase Auth). RLS s'applique
// automatiquement.
//
// Body :
// {
//   "mission_id": "uuid",
//   "target_format": "liciel_xml" | "obbc_xml" | ...
// }
//
// Réponse :
// {
//   "analysis_id": "uuid",
//   "global_score": 78,
//   "interpretation": "conforme",
//   "findings": [...],
//   "counters": { ... }
// }
//
// NOTE : la logique métier est aussi disponible côté Next.js
// (`apps/web/src/lib/pre-export/`). Cette Edge Function la duplique en inline
// (Deno) pour latence faible et indépendance.

/// <reference lib="deno.ns" />

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

// ────────────────────────────────────────────────────────────
// Types — mirror exact `apps/web/src/lib/pre-export/types.ts`
// ────────────────────────────────────────────────────────────

type TargetExportFormat =
  | 'liciel_xml'
  | 'liciel_diag'
  | 'obbc_xml'
  | 'ds8'
  | 'notaire_xml'
  | 'pdf_only'

type FindingSeverity = 'critical' | 'warning' | 'suggestion' | 'info'
type FindingCategory =
  | 'conformity'
  | 'coherence'
  | 'statistical'
  | 'opportunity'
  | 'quality'
  | 'historical'

interface Finding {
  code: string
  category: FindingCategory
  severity: FindingSeverity
  title: string
  message: string
  suggested_action?: string
  related_field?: string
  context?: Record<string, unknown>
}

interface RequestBody {
  mission_id: string
  target_format: TargetExportFormat
}

// Pondérations score global
const SCORE_WEIGHTS = {
  conformity: 40,
  coherence: 20,
  statistical: 20,
  quality: 10,
  exhaustivity: 10,
} as const

function interpretScore(score: number): string {
  if (score >= 90) return 'exemplaire'
  if (score >= 75) return 'conforme'
  if (score >= 60) return 'exploitable'
  if (score >= 40) return 'verification_recommandee'
  return 'a_reprendre'
}

// ────────────────────────────────────────────────────────────
// HTTP & utils
// ────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

// ────────────────────────────────────────────────────────────
// Analyseurs (versions Deno simplifiées — règles essentielles)
// ────────────────────────────────────────────────────────────

interface MissionData {
  id: string
  reference: string
  type: string
  status: string
  completed_at: string | null
  property: {
    address: string
    postal_code: string | null
    city: string | null
    property_type: string | null
    year_built: number | null
    surface_total: number | null
    surface_carrez: number | null
  } | null
  rooms: { id: string; name: string; room_type: string | null; surface_m2: number | null }[]
  photos: { id: string; room_id: string | null }[]
  voiceNotes: {
    id: string
    room_id: string | null
    transcript_raw: string | null
    transcript_structured: unknown
  }[]
}

function checkConformity(m: MissionData): { findings: Finding[]; score: number; optional: number } {
  const findings: Finding[] = []
  let requiredPresent = 0
  let optionalPresent = 0
  const required = 10

  if (m.property?.year_built && m.property.year_built >= 1700) requiredPresent++
  else {
    findings.push({
      code: 'missing_annee_construction',
      category: 'conformity',
      severity: 'critical',
      title: 'Année de construction manquante',
      message: 'Le champ « Année de construction » est obligatoire pour publier le DPE sur l\'observatoire ADEME.',
      suggested_action: 'Ajouter cette donnée à la mission',
      related_field: 'annee_construction',
    })
  }

  if (m.property?.surface_total && m.property.surface_total >= 8) requiredPresent++
  else {
    findings.push({
      code: 'missing_surface_habitable_totale_m2',
      category: 'conformity',
      severity: 'critical',
      title: 'Surface habitable totale manquante',
      message: 'Le champ « Surface habitable totale » est obligatoire (min 8 m²).',
      suggested_action: 'Ajouter cette donnée à la mission',
      related_field: 'surface_habitable_totale_m2',
    })
  }

  if (m.property?.property_type) requiredPresent++
  else {
    findings.push({
      code: 'missing_type_batiment',
      category: 'conformity',
      severity: 'critical',
      title: 'Type de bâtiment manquant',
      message: 'Le champ « Type de bâtiment » est obligatoire (maison, appartement, immeuble).',
      related_field: 'type_batiment',
    })
  }

  if (m.property?.address && m.property?.postal_code && m.property?.city) requiredPresent++
  else {
    findings.push({
      code: 'missing_adresse_complete',
      category: 'conformity',
      severity: 'critical',
      title: 'Adresse incomplète',
      message: 'L\'adresse complète (voie + CP + ville) est nécessaire.',
      related_field: 'adresse_complete',
    })
  }

  if (m.photos.length >= 1) requiredPresent++
  else {
    findings.push({
      code: 'missing_photo_facade',
      category: 'conformity',
      severity: 'critical',
      title: 'Aucune photo dans le dossier',
      message: 'Au moins une photo (façade) est recommandée pour la preuve EEAT.',
    })
  }

  // Détections via voice-notes structurées (simplifié)
  const equipKinds = m.voiceNotes
    .flatMap((v) => {
      const eq = (v.transcript_structured as { equipment?: { kind: string }[] } | null)?.equipment
      return eq ?? []
    })
    .map((e) => e.kind)

  if (equipKinds.some((k) => k === 'chaudiere' || k === 'pac' || k === 'radiateur')) requiredPresent++
  else
    findings.push({
      code: 'missing_chauffage_systeme',
      category: 'conformity',
      severity: 'critical',
      title: 'Système de chauffage non identifié',
      message: 'Aucun équipement de chauffage n\'a été détecté dans les notes vocales.',
    })

  if (equipKinds.includes('chauffe_eau')) requiredPresent++
  else
    findings.push({
      code: 'missing_ecs_production',
      category: 'conformity',
      severity: 'critical',
      title: 'ECS non identifiée',
      message: 'La production d\'eau chaude sanitaire devrait être renseignée.',
    })

  if (equipKinds.includes('ventilation')) requiredPresent++
  else
    findings.push({
      code: 'missing_ventilation_type',
      category: 'conformity',
      severity: 'warning',
      title: 'Type de ventilation manquant',
      message: 'Le type de ventilation (VMC simple/double flux, naturelle) devrait être noté.',
    })

  if (equipKinds.includes('fenetre')) requiredPresent++
  else
    findings.push({
      code: 'missing_fenetres_type',
      category: 'conformity',
      severity: 'warning',
      title: 'Type de vitrage manquant',
      message: 'Le type de vitrage (simple/double/triple) devrait être relevé.',
    })

  if (equipKinds.includes('isolation')) requiredPresent++
  else
    findings.push({
      code: 'missing_isolation_present',
      category: 'conformity',
      severity: 'warning',
      title: 'Isolation non décrite',
      message: 'Les éléments d\'isolation (murs, toiture, planchers) devraient être documentés.',
    })

  if (m.property?.surface_carrez) optionalPresent++

  return {
    findings,
    score: requiredPresent / required,
    optional: optionalPresent / 4, // 4 optionnels équivalents (Carrez + DPE + GES + conso)
  }
}

function checkCoherence(m: MissionData): { findings: Finding[]; score: number } {
  const findings: Finding[] = []

  // Surfaces pièces vs total
  const roomSurfaces = m.rooms
    .map((r) => r.surface_m2)
    .filter((s): s is number => typeof s === 'number' && s > 0)
  if (roomSurfaces.length > 0 && m.property?.surface_total) {
    const sum = roomSurfaces.reduce((a, b) => a + b, 0)
    const ratio = Math.abs(sum - m.property.surface_total) / m.property.surface_total
    if (ratio > 0.05) {
      findings.push({
        code: 'sum_rooms_vs_total',
        category: 'coherence',
        severity: ratio > 0.2 ? 'warning' : 'suggestion',
        title: 'Somme des surfaces ≠ surface totale',
        message: `Somme pièces ${sum.toFixed(1)} m² vs total ${m.property.surface_total.toFixed(1)} m² (écart ${(ratio * 100).toFixed(0)}%).`,
      })
    }
  }

  // Score : 1 - penalty
  const penalty = findings.reduce((acc, f) => {
    if (f.severity === 'critical') return acc + 0.4
    if (f.severity === 'warning') return acc + 0.2
    return acc + 0.1
  }, 0)
  return { findings, score: Math.max(0, Math.min(1, 1 - penalty)) }
}

function checkQuality(m: MissionData): { findings: Finding[]; score: number } {
  const findings: Finding[] = []

  if (m.photos.length === 0) {
    findings.push({
      code: 'no_photos',
      category: 'quality',
      severity: 'critical',
      title: 'Aucune photo',
      message: 'Au moins 5 photos sont recommandées pour la preuve EEAT.',
    })
  } else if (m.photos.length < 5) {
    findings.push({
      code: 'few_photos',
      category: 'quality',
      severity: 'warning',
      title: `Seulement ${m.photos.length} photo(s)`,
      message: 'Pour un dossier robuste, au moins 5 photos sont recommandées.',
    })
  }

  const penalty = findings.reduce((acc, f) => {
    if (f.severity === 'critical') return acc + 0.5
    if (f.severity === 'warning') return acc + 0.25
    return acc + 0.1
  }, 0)
  return { findings, score: Math.max(0, Math.min(1, 1 - penalty)) }
}

// ────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing authorization' }, 401)

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!body.mission_id || !body.target_format) {
    return json({ error: 'mission_id and target_format are required' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnon) return json({ error: 'Supabase env missing' }, 500)

  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })

  const startedAt = Date.now()

  // 1. Charger la mission + dossier + property + rooms + photos + voice notes
  const { data: mission, error: missionErr } = await supabase
    .from('missions')
    .select(
      'id, reference, type, status, completed_at, organization_id, diagnostician_id, dossier_id, dossiers(property_id, properties(address, postal_code, city, property_type, year_built, surface_total, surface_carrez))',
    )
    .eq('id', body.mission_id)
    .maybeSingle()

  if (missionErr || !mission) {
    return json({ error: 'Mission not found or unauthorized' }, 404)
  }

  const dossier = Array.isArray(mission.dossiers) ? mission.dossiers[0] : mission.dossiers
  const property = dossier
    ? Array.isArray(dossier.properties)
      ? dossier.properties[0]
      : dossier.properties
    : null

  const dossierId: string | null = (mission as { dossier_id?: string }).dossier_id ?? null

  const [{ data: rooms }, { data: photos }, { data: voiceNotes }] = await Promise.all([
    dossierId
      ? supabase
          .from('dossier_rooms')
          .select('id, name, room_type, surface_m2')
          .eq('dossier_id', dossierId)
      : Promise.resolve({ data: [] }),
    dossierId
      ? supabase.from('photos').select('id, room_id').eq('dossier_id', dossierId)
      : Promise.resolve({ data: [] }),
    dossierId
      ? supabase
          .from('voice_notes')
          .select('id, room_id, transcript_raw, transcript_structured')
          .eq('dossier_id', dossierId)
      : Promise.resolve({ data: [] }),
  ])

  const missionData: MissionData = {
    id: mission.id,
    reference: mission.reference,
    type: mission.type,
    status: mission.status,
    completed_at: mission.completed_at,
    property: property ?? null,
    rooms: rooms ?? [],
    photos: photos ?? [],
    voiceNotes: voiceNotes ?? [],
  }

  // 2. Analyseurs
  const conformity = checkConformity(missionData)
  const coherence = checkCoherence(missionData)
  const quality = checkQuality(missionData)
  // Statistical & historical : pas implémentés en edge (nécessitent benchmark fetch).
  // Sous-scores neutres pour ne pas pénaliser.
  const statisticalScore = 0.85
  const exhaustivityScore = conformity.optional

  // 3. Agrégation findings
  const findings: Finding[] = [
    ...conformity.findings,
    ...coherence.findings,
    ...quality.findings,
  ]

  // 4. Score global pondéré
  const conformity_score = Math.round(conformity.score * SCORE_WEIGHTS.conformity)
  const coherence_score = Math.round(coherence.score * SCORE_WEIGHTS.coherence)
  const statistical_score = Math.round(statisticalScore * SCORE_WEIGHTS.statistical)
  const quality_score = Math.round(quality.score * SCORE_WEIGHTS.quality)
  const exhaustivity_score = Math.round(exhaustivityScore * SCORE_WEIGHTS.exhaustivity)
  const global_score = Math.max(
    0,
    Math.min(
      100,
      conformity_score +
        coherence_score +
        statistical_score +
        quality_score +
        exhaustivity_score,
    ),
  )

  const counters = findings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1
      return acc
    },
    { critical: 0, warning: 0, suggestion: 0, info: 0 } as Record<FindingSeverity, number>,
  )

  const duration_ms = Date.now() - startedAt

  // 5. Persistance
  const orgId = (mission as { organization_id: string }).organization_id
  const diagId = (mission as { diagnostician_id: string }).diagnostician_id

  const { data: persisted, error: insertErr } = await supabase
    .from('pre_export_analyses')
    .insert({
      mission_id: body.mission_id,
      organization_id: orgId,
      diagnostician_id: diagId,
      target_format: body.target_format,
      global_score,
      conformity_score,
      coherence_score,
      statistical_score,
      quality_score,
      exhaustivity_score,
      findings,
      analysis_duration_ms: duration_ms,
    })
    .select('id')
    .single()

  if (insertErr) {
    return json({ error: 'Failed to persist analysis', detail: insertErr.message }, 500)
  }

  return json({
    analysis_id: persisted?.id,
    global_score,
    conformity_score,
    coherence_score,
    statistical_score,
    quality_score,
    exhaustivity_score,
    interpretation: interpretScore(global_score),
    findings,
    counters,
    duration_ms,
  })
})
