import { NextResponse } from 'next/server'
import { structureWithClaude } from '@/lib/claude-structurer'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/current-user'

/**
 * Fallback Claude pour transcripts à faible confiance (< 0,7).
 * Appelé côté client uniquement quand le parser custom JS a une confiance insuffisante.
 *
 * Audit AI usage : insère une ligne dans `ai_usage` pour suivi des coûts.
 */
export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured', stub: true },
      { status: 503 },
    )
  }

  const body = await request.json().catch(() => null)
  const transcript = body?.transcript as string | undefined
  const missionId = body?.missionId as string | undefined

  if (!transcript || !missionId) {
    return NextResponse.json({ error: 'missing transcript or missionId' }, { status: 400 })
  }

  try {
    const result = await structureWithClaude(transcript)

    // Track usage
    const { orgId } = await getCurrentUser()
    await supabase.from('ai_usage').insert({
      organization_id: orgId,
      user_id: user.id,
      mission_id: missionId,
      provider: 'anthropic',
      model: process.env.ANTHROPIC_MODEL_VOICE ?? 'claude-haiku-4-5',
      operation: 'structure_voice_transcript',
      input_tokens: 0, // détaillé V1.5 via headers Anthropic
      output_tokens: 0,
      cost_eur: result.costEur,
      latency_ms: result.latencyMs,
    })

    return NextResponse.json({
      structured: result.data,
      costEur: result.costEur,
      latencyMs: result.latencyMs,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'structuration failed' },
      { status: 500 },
    )
  }
}
