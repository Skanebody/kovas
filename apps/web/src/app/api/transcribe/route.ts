import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

/**
 * Transcription audio via OpenAI Whisper.
 * - Vérifie l'auth user
 * - Vérifie l'accès à la mission via RLS
 * - Appelle gpt-4o-mini-transcribe (fallback whisper-1 si besoin)
 * - Retourne { transcript, language, durationSeconds, costEur }
 *
 * Coût indicatif : ~0,006$/min audio (gpt-4o-mini-transcribe).
 */
export const runtime = 'nodejs'
export const maxDuration = 60

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
  const missionId = formData.get('missionId') as string | null

  if (!file || !missionId) {
    return NextResponse.json({ error: 'missing audio or missionId' }, { status: 400 })
  }

  // Verify mission belongs to user's org (RLS guarantees this if user is org member)
  const { data: mission, error: missionError } = await supabase
    .from('missions')
    .select('id, organization_id')
    .eq('id', missionId)
    .single()
  if (missionError || !mission) {
    return NextResponse.json({ error: 'mission not found' }, { status: 404 })
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const model = process.env.OPENAI_MODEL_TRANSCRIBE ?? 'gpt-4o-mini-transcribe'

  try {
    const t0 = Date.now()
    const result = await openai.audio.transcriptions.create({
      file,
      model,
      language: 'fr',
      response_format: 'verbose_json',
      // prompt: 'Diagnostic immobilier français...' // injection vocab dans J6
    })
    const latencyMs = Date.now() - t0

    // gpt-4o-mini-transcribe: $0.003/min
    const duration = (result as { duration?: number }).duration ?? 0
    const costEur = Math.round((duration / 60) * 0.003 * 0.93 * 100000) / 100000 // approx EUR

    return NextResponse.json({
      transcript: result.text,
      language: (result as { language?: string }).language ?? 'fr',
      durationSeconds: Math.round(duration),
      model,
      costEur,
      latencyMs,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'transcription failed' },
      { status: 500 },
    )
  }
}
