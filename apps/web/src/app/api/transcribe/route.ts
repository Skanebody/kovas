import { buildWhisperPrompt } from '@/lib/local-ai/vocabulary/diagnostic-jargon'
import { createClient } from '@/lib/supabase/server'
import {
  type AnnotatedSegment,
  annotateSegments,
  buildMarkedTranscript,
} from '@/lib/voice/segment-confidence'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

/**
 * Transcription audio via OpenAI Whisper.
 * - Vérifie l'auth user
 * - Vérifie l'accès à la mission via RLS
 * - Appelle gpt-4o-mini-transcribe avec `response_format: 'verbose_json'`
 *   (segments granularity) — MISSION-E niveau 3 anti-bruit
 * - Upload du blob source dans mission-audio-segments/ pour permettre le replay
 *   inline d'un segment douteux/inaudible depuis le chat (signedUrl 1h)
 * - Annote chaque segment avec une confidence ('reliable'|'doubtful'|'inaudible')
 *   dérivée de avg_logprob + no_speech_prob
 * - Retourne fullText + markedText (avec [inaudible] / *italique*) + segments
 *
 * Coût indicatif : ~0,003$/min audio (gpt-4o-mini-transcribe).
 *
 * Authority : CLAUDE.md §3 feature #1 + MISSION-E niveau 3.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

const AUDIO_STORAGE_BUCKET = 'mission-audio-segments'
const SIGNED_URL_TTL_SECONDS = 3600 // 1h pour le replay segment

export async function POST(request: Request) {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // API key check
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not configured', stub: true },
      { status: 503 },
    )
  }

  const formData = await request.formData()
  const file = formData.get('audio') as File | null
  // Accept dossierId (new) or missionId (legacy) — we treat both as dossierId.
  const dossierId = (formData.get('dossierId') ?? formData.get('missionId')) as string | null
  // sessionId optionnel — permet de scoper le replay segment par session mission.
  const sessionId = (formData.get('sessionId') ?? null) as string | null

  if (!file || !dossierId) {
    return NextResponse.json({ error: 'missing audio or dossierId' }, { status: 400 })
  }

  // Verify dossier belongs to user's org + fetch the included mission types
  // pour booster Whisper avec le vocab pertinent (DPE + Amiante + ...).
  const { data: dossier, error: dossierError } = await supabase
    .from('dossiers')
    .select('id, organization_id, missions(type)')
    .eq('id', dossierId)
    .single()
  if (dossierError || !dossier) {
    return NextResponse.json({ error: 'dossier not found' }, { status: 404 })
  }

  const orgId = dossier.organization_id as string
  const missionTypes = ((dossier.missions ?? []) as { type: string }[]).map((m) => m.type)

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const model = process.env.OPENAI_MODEL_TRANSCRIBE ?? 'gpt-4o-mini-transcribe'
  const prompt = buildWhisperPrompt(missionTypes)

  try {
    const t0 = Date.now()
    // verbose_json + segment granularity → on récupère avg_logprob + no_speech_prob
    // par segment pour exposer la confiance au client (MISSION-E niveau 3).
    const result = await openai.audio.transcriptions.create({
      file,
      model,
      language: 'fr',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
      prompt,
    })
    const latencyMs = Date.now() - t0

    // gpt-4o-mini-transcribe: $0.003/min
    const duration = (result as { duration?: number }).duration ?? 0
    const costEur = Math.round((duration / 60) * 0.003 * 0.93 * 100000) / 100000 // approx EUR

    // Annote les segments verbose_json
    const rawSegments = (result as { segments?: unknown }).segments
    const segments: AnnotatedSegment[] = annotateSegments(rawSegments)
    const markedText = segments.length > 0 ? buildMarkedTranscript(segments) : result.text

    // Upload du blob source pour permettre le replay inline (audio signé 1h)
    // Le segment_id est l'index → on upload UN seul fichier (l'audio complet)
    // et on stocke aussi les timestamps start/end pour seek côté <audio>.
    let audioSignedUrl: string | null = null
    let audioStoragePath: string | null = null
    try {
      const ext = file.type.includes('mp4') ? 'mp4' : 'webm'
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
      const scopeFolder = sessionId ?? dossierId
      audioStoragePath = `${orgId}/${scopeFolder}/${fileName}`
      const arrayBuffer = await file.arrayBuffer()
      const uploadRes = await supabase.storage
        .from(AUDIO_STORAGE_BUCKET)
        .upload(audioStoragePath, new Blob([arrayBuffer], { type: file.type }), {
          contentType: file.type || 'audio/webm',
          upsert: false,
          cacheControl: '3600',
        })
      if (uploadRes.error) {
        // Bucket peut ne pas exister (création lazy en V1) — on n'échoue pas
        // la transcription pour autant, juste pas de replay disponible.
        console.warn('[transcribe] audio upload failed', uploadRes.error.message)
        audioStoragePath = null
      } else {
        const { data: signed } = await supabase.storage
          .from(AUDIO_STORAGE_BUCKET)
          .createSignedUrl(audioStoragePath, SIGNED_URL_TTL_SECONDS)
        audioSignedUrl = signed?.signedUrl ?? null
      }
    } catch (storageErr) {
      console.warn('[transcribe] storage step failed', storageErr)
    }

    return NextResponse.json({
      transcript: result.text,
      // markedText : transcription avec [inaudible] sur les segments rejetés
      // et *italique* sur les douteux — utilisable pour Claude / persistence.
      markedText,
      // Segments annotés pour rendu UI bulle USER (italique + replay inline)
      segments: segments.map((s) => ({
        id: s.id,
        text: s.text,
        start: s.start,
        end: s.end,
        avgLogprob: s.avgLogprob,
        noSpeechProb: s.noSpeechProb,
        confidence: s.confidence,
      })),
      language: (result as { language?: string }).language ?? 'fr',
      durationSeconds: Math.round(duration),
      model,
      costEur,
      latencyMs,
      // URL signée 1h pour réécouter l'audio source (permettre le replay segment)
      audioSignedUrl,
      audioStoragePath,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'transcription failed' },
      { status: 500 },
    )
  }
}
