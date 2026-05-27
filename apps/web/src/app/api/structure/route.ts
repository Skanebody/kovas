import { getCurrentUser } from '@/lib/auth/current-user'
import { structureWithClaude } from '@/lib/claude-structurer'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
  // Accept dossierId (new) or missionId (legacy)
  const contextId = (body?.dossierId ?? body?.missionId) as string | undefined

  if (!transcript || !contextId) {
    return NextResponse.json({ error: 'missing transcript or dossierId' }, { status: 400 })
  }

  // Fetch mission types to inject the relevant jargon sections into the system prompt
  const { data: dossier } = await supabase
    .from('dossiers')
    .select('id, missions(type)')
    .eq('id', contextId)
    .single()
  const missionTypes = ((dossier?.missions ?? []) as { type: string }[]).map((m) => m.type)

  try {
    const result = await structureWithClaude(transcript, missionTypes)

    // Track usage (sans lien mission spécifique — la note vocale est dossier-level)
    const { orgId } = await getCurrentUser()
    await supabase.from('ai_usage').insert({
      organization_id: orgId,
      user_id: user.id,
      provider: 'anthropic',
      model: process.env.ANTHROPIC_MODEL_VOICE ?? 'claude-haiku-4-5',
      operation: 'structure_voice_transcript',
      input_tokens: 0,
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
