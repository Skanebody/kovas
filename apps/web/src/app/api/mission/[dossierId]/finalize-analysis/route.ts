/**
 * KOVAS — API route : analyse finale d'une session "Capture silencieuse" (MISSION-H).
 *
 * POST /api/mission/[dossierId]/finalize-analysis
 *
 * Flow :
 *   1. Auth + check dossier appartient à org + résolution sessionId courant
 *   2. Charge toutes les captures de la session : voice_notes (transcrits), photos
 *      (vision_analysis si disponible), mission_text_notes, mission_chat_messages
 *      (user-only, en cas d'envoi texte direct sans vocal).
 *   3. Appelle Claude Sonnet 4.6 avec un prompt structuré : produit
 *      `{ summary[], gaps[] }` — récap pièce par pièce + champs DPE/Amiante
 *      manquants pour Liciel.
 *   4. Track usage IA et retourne le JSON brut au front.
 *
 * Authority : CLAUDE.md §3 feature 8 (analyse pré-export Liciel) + brief MISSION-H.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { missionTypesToActiveDiagnostics } from '@/lib/mission/diagnostic-mapper'
import type { DiagnosticType, VisionAnalysisResult } from '@/lib/mission/types'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 90

const MODEL = process.env.ANTHROPIC_CONSOLIDATION_MODEL ?? 'claude-sonnet-4-6'
const MIN_CAPTURES = 3

interface FinalAnalysisGap {
  field: string
  label: string
  suggestion: string
  diagnostic?: DiagnosticType | null
}

interface FinalAnalysisRoomSummary {
  room: string
  observations: string[]
}

interface SuccessResponse {
  ok: true
  summary: string
  rooms: FinalAnalysisRoomSummary[]
  gaps: FinalAnalysisGap[]
  capturesCount: number
  cost_usd: number
}

interface ErrorResponse {
  ok: false
  error: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dossierId: string }> },
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const { dossierId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(dossierId)) {
    return NextResponse.json({ ok: false, error: 'dossierId must be a UUID' }, { status: 400 })
  }

  let body: { sessionId?: string } = {}
  try {
    body = (await request.json()) as { sessionId?: string }
  } catch {
    // Body optionnel — on tente la session active si absent
  }

  // ── Auth ──────────────────────────────────────────────────────────
  let orgId: string
  let userId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
    userId = u.user.id
    supabase = u.supabase
  } catch {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'ANTHROPIC_API_KEY not configured' },
      { status: 503 },
    )
  }

  // ── 1. Résout sessionId (passé ou dernière session non-terminée) ───
  let sessionId = body.sessionId ?? null
  if (!sessionId) {
    const { data: lastSession } = await supabase
      .from('mission_sessions')
      .select('id')
      .eq('dossier_id', dossierId)
      .eq('organization_id', orgId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    sessionId = lastSession?.id ?? null
  }

  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: 'no mission session found for this dossier' },
      { status: 404 },
    )
  }

  // ── 2. Diagnostics actifs (pour cibler les champs Liciel manquants) ─
  const { data: missions } = await supabase
    .from('missions')
    .select('type')
    .eq('dossier_id', dossierId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
  const missionTypeStrings = (missions ?? []).map((m) => m.type as string)
  const activeDiagnostics: DiagnosticType[] = missionTypesToActiveDiagnostics(missionTypeStrings)

  // ── 3. Charge toutes les captures de la session ───────────────────
  const [voicesRes, photosRes, textsRes, msgsRes] = await Promise.all([
    supabase
      .from('voice_notes')
      .select('id, room_id, transcript_raw, edited_transcription, created_at')
      .eq('dossier_id', dossierId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true }),
    supabase
      .from('photos')
      .select('id, room_id, taken_at, vision_status, vision_analysis')
      .eq('dossier_id', dossierId)
      .eq('organization_id', orgId)
      .order('taken_at', { ascending: true }),
    supabase
      .from('mission_text_notes' as never)
      .select('id, room_id, text, created_at, deleted_at')
      .eq('dossier_id', dossierId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('mission_chat_messages')
      .select('id, role, content, created_at')
      .eq('session_id', sessionId)
      .eq('role', 'user')
      .order('created_at', { ascending: true }),
  ])

  type VoiceRow = {
    id: string
    room_id: string | null
    transcript_raw: string | null
    edited_transcription: string | null
    created_at: string
  }
  type PhotoRow = {
    id: string
    room_id: string | null
    taken_at: string | null
    vision_status: string | null
    vision_analysis: VisionAnalysisResult | null
  }
  type TextRow = {
    id: string
    room_id: string | null
    text: string
    created_at: string
    deleted_at: string | null
  }
  type MsgRow = { id: string; role: string; content: string; created_at: string }

  const voices = (voicesRes.data as unknown as VoiceRow[] | null) ?? []
  const photos = (photosRes.data as unknown as PhotoRow[] | null) ?? []
  const texts = (textsRes.data as unknown as TextRow[] | null) ?? []
  const msgs = (msgsRes.data as unknown as MsgRow[] | null) ?? []

  const capturesCount = voices.length + photos.length + texts.length + msgs.length
  if (capturesCount < MIN_CAPTURES) {
    return NextResponse.json(
      {
        ok: false,
        error: `Pas assez de captures pour analyser (minimum ${MIN_CAPTURES}, vous en avez ${capturesCount}). Continuez à dicter vos observations.`,
      },
      { status: 400 },
    )
  }

  // ── 4. Map des room_id → nom (pour grouper) ───────────────────────
  const allRoomIds = new Set<string>()
  for (const v of voices) if (v.room_id) allRoomIds.add(v.room_id)
  for (const p of photos) if (p.room_id) allRoomIds.add(p.room_id)
  for (const t of texts) if (t.room_id) allRoomIds.add(t.room_id)
  const roomNameById = new Map<string, string>()
  if (allRoomIds.size > 0) {
    const { data } = await supabase
      .from('dossier_rooms')
      .select('id, name')
      .in('id', Array.from(allRoomIds))
      .eq('organization_id', orgId)
    for (const r of data ?? []) {
      if (typeof r.id === 'string' && typeof r.name === 'string') {
        roomNameById.set(r.id, r.name)
      }
    }
  }

  // ── 5. Build prompt structuré ────────────────────────────────────
  const captureLines: string[] = []
  for (const v of voices) {
    const transcript = v.edited_transcription?.trim() || v.transcript_raw?.trim() || null
    if (!transcript) continue
    const room = v.room_id ? (roomNameById.get(v.room_id) ?? 'pièce inconnue') : 'global'
    captureLines.push(`[VOCAL · ${room} · ${v.created_at}] ${transcript}`)
  }
  for (const t of texts) {
    const room = t.room_id ? (roomNameById.get(t.room_id) ?? 'pièce inconnue') : 'global'
    captureLines.push(`[NOTE · ${room} · ${t.created_at}] ${t.text}`)
  }
  for (const m of msgs) {
    if (!m.content.trim()) continue
    captureLines.push(`[CHAT · ${m.created_at}] ${m.content}`)
  }
  for (const p of photos) {
    const room = p.room_id ? (roomNameById.get(p.room_id) ?? 'pièce inconnue') : 'global'
    if (p.vision_status === 'analyzed' && p.vision_analysis) {
      const va = p.vision_analysis
      const subject = typeof va.primarySubject === 'string' ? va.primarySubject : null
      const caption = typeof va.caption === 'string' ? va.caption : null
      const hints = Array.isArray(va.fieldHints)
        ? va.fieldHints
            .slice(0, 5)
            .map((h) => `${h.fieldPath}=${JSON.stringify(h.value)}`)
            .join(', ')
        : null
      captureLines.push(
        `[PHOTO ANALYSÉE · ${room} · ${p.taken_at ?? ''}] sujet=${subject ?? '?'}${caption ? ` "${caption}"` : ''}${hints ? `, hints: ${hints}` : ''}`,
      )
    } else {
      captureLines.push(`[PHOTO · ${room} · ${p.taken_at ?? ''}] non analysée`)
    }
  }

  const diagList =
    activeDiagnostics.length > 0
      ? activeDiagnostics.join(', ')
      : 'DPE (défaut, aucun diagnostic explicitement configuré)'

  const userPrompt = `Voici la session terrain d'un diagnostiqueur immobilier sur ce dossier.
Diagnostics actifs : ${diagList}.
Nombre de captures : ${capturesCount}.

Captures (chronologique) :
${captureLines.join('\n')}

Produis un JSON STRICT (sans markdown, sans texte hors JSON) avec cette structure :
{
  "summary": "Synthèse globale 3-4 phrases — état du bien, points clés relevés.",
  "rooms": [
    { "room": "Salon", "observations": ["…", "…"] },
    { "room": "Cuisine", "observations": ["…"] }
  ],
  "gaps": [
    {
      "field": "code.technique.exact",
      "label": "Libellé humain court",
      "suggestion": "Action concrète pour combler le manque (ex: 'Reprendre une photo de la chaudière avec étiquette visible')",
      "diagnostic": "DPE"
    }
  ]
}

Règles :
- "summary" : ton sobre professionnel (vouvoiement), 3-4 phrases max.
- "rooms" : 1 entrée par pièce mentionnée dans les captures, observations courtes.
- "gaps" : UNIQUEMENT les champs réellement manquants pour finaliser l'export Liciel des diagnostics actifs. Sois précis : "DPE.chauffage.energie_principale" plutôt que "info chauffage".
- Ne fabrique aucune donnée. Si l'info n'est pas dans les captures, c'est un gap.
- "diagnostic" doit être l'un de : DPE, AMIANTE, PLOMB, GAZ, ELECTRICITE, TERMITES, CARREZ, ERP, ou null si transversal.
- Maximum 12 gaps (priorise les plus critiques).`

  // ── 6. Call Claude ────────────────────────────────────────────────
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const startedAt = Date.now()
  let response: Awaited<ReturnType<typeof client.messages.create>>
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system:
        "Tu es l'assistant qualité KOVAS, expert en diagnostic immobilier français (DPE, Amiante, Plomb, Gaz, Électricité, Termites, Carrez, ERP). Tu produis des analyses sobres, professionnelles, en français, sans emoji. Tu réponds STRICTEMENT en JSON valide.",
      messages: [{ role: 'user', content: userPrompt }],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'anthropic call failed'
    console.error('[finalize-analysis] anthropic failed', { dossierId, msg })
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }

  const totalLatencyMs = Date.now() - startedAt

  // Extrait le texte du content block
  const textBlocks = response.content.filter(
    (b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text',
  )
  const rawText = textBlocks
    .map((b) => b.text)
    .join('')
    .trim()

  // Strip éventuels fences markdown
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: {
    summary?: string
    rooms?: FinalAnalysisRoomSummary[]
    gaps?: FinalAnalysisGap[]
  }
  try {
    parsed = JSON.parse(cleaned) as typeof parsed
  } catch (err) {
    console.error('[finalize-analysis] JSON parse failed', { rawText: cleaned.slice(0, 400), err })
    return NextResponse.json(
      { ok: false, error: 'Claude a renvoyé une réponse non parsable. Réessayez dans un instant.' },
      { status: 502 },
    )
  }

  const summary = typeof parsed.summary === 'string' ? parsed.summary : ''
  const rooms: FinalAnalysisRoomSummary[] = Array.isArray(parsed.rooms)
    ? parsed.rooms
        .filter((r): r is FinalAnalysisRoomSummary => {
          if (typeof r !== 'object' || r === null) return false
          const rec = r as unknown as Record<string, unknown>
          return typeof rec.room === 'string' && Array.isArray(rec.observations)
        })
        .map((r) => ({
          room: r.room,
          observations: r.observations.filter((o): o is string => typeof o === 'string'),
        }))
    : []
  const gaps: FinalAnalysisGap[] = Array.isArray(parsed.gaps)
    ? parsed.gaps
        .filter((g): g is FinalAnalysisGap => {
          if (typeof g !== 'object' || g === null) return false
          const rec = g as unknown as Record<string, unknown>
          return (
            typeof rec.field === 'string' &&
            typeof rec.label === 'string' &&
            typeof rec.suggestion === 'string'
          )
        })
        .slice(0, 12)
    : []

  // ── 7. Cost tracking + ai_usage ──────────────────────────────────
  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  // Tarifs Sonnet 4.5 : $3/MTok input, $15/MTok output
  const costUsd = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15

  await supabase.from('ai_usage').insert({
    organization_id: orgId,
    user_id: userId,
    provider: 'anthropic',
    model: MODEL,
    operation: 'finalize_mission_analysis',
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cached_tokens: 0,
    cost_eur: Math.round(costUsd * 0.93 * 1_000_000) / 1_000_000,
    latency_ms: totalLatencyMs,
  })

  return NextResponse.json({
    ok: true,
    summary,
    rooms,
    gaps,
    capturesCount,
    cost_usd: costUsd,
  })
}
