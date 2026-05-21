import { getAbAdminClient } from '@/lib/ab-testing/admin-client'
import type { AbEventTypeDB, AbExperimentStatusDB, Json } from '@/lib/ab-testing/types'
import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

/**
 * GET  /api/ab/admin/experiments        Liste toutes les expériences + résultats agrégés
 * POST /api/ab/admin/experiments        Crée une nouvelle expérience (status=draft)
 *
 * Auth : utilisateur authentifié uniquement (gating organisationnel à raffiner
 * via une future table `admin_users` ou claim JWT — pour V1, tout user auth
 * peut voir le dashboard admin, surface non publique).
 */
export const runtime = 'nodejs'

interface AdminExperimentSummary {
  id: string
  experimentKey: string
  description: string
  hypothesis: string | null
  status: AbExperimentStatusDB
  primaryMetric: string | null
  startedAt: string | null
  endedAt: string | null
  winnerVariant: string | null
  variants: { name: string; weight: number; label?: string }[]
  results: {
    variant: string
    exposures: number
    conversions: number
    clicks: number
    submits: number
    conversionRatePct: number | null
  }[]
}

export async function GET() {
  await getCurrentUser()

  const supabase = getAbAdminClient()

  const { data: experiments, error } = await supabase
    .from('ab_experiments')
    .select(
      'id, experiment_key, description, hypothesis, status, primary_metric, started_at, ended_at, winner_variant, variants',
    )
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: results } = await supabase
    .from('ab_experiment_results')
    .select(
      'experiment_id, variant_assigned, exposures, conversions, clicks, submits, conversion_rate_pct',
    )

  const summaries: AdminExperimentSummary[] = (experiments ?? []).map((exp) => {
    const expResults = (results ?? []).filter((r) => r.experiment_id === exp.id)
    return {
      id: exp.id,
      experimentKey: exp.experiment_key,
      description: exp.description,
      hypothesis: exp.hypothesis,
      status: exp.status,
      primaryMetric: exp.primary_metric,
      startedAt: exp.started_at,
      endedAt: exp.ended_at,
      winnerVariant: exp.winner_variant,
      variants: parseVariantsForApi(exp.variants),
      results: expResults.map((r) => ({
        variant: r.variant_assigned,
        exposures: r.exposures ?? 0,
        conversions: r.conversions ?? 0,
        clicks: r.clicks ?? 0,
        submits: r.submits ?? 0,
        conversionRatePct: r.conversion_rate_pct,
      })),
    }
  })

  return NextResponse.json({ experiments: summaries })
}

interface CreateBody {
  experimentKey?: unknown
  description?: unknown
  hypothesis?: unknown
  primaryMetric?: unknown
  variants?: unknown
}

export async function POST(request: Request) {
  const { user } = await getCurrentUser()

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const experimentKey = typeof body.experimentKey === 'string' ? body.experimentKey.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const hypothesis = typeof body.hypothesis === 'string' ? body.hypothesis.trim() : null
  const primaryMetric = typeof body.primaryMetric === 'string' ? body.primaryMetric.trim() : null

  if (!experimentKey || !description) {
    return NextResponse.json(
      { error: 'experimentKey and description are required' },
      { status: 400 },
    )
  }

  const variants = parseVariantsFromBody(body.variants)
  if (variants.length < 2) {
    return NextResponse.json({ error: 'at least 2 variants are required' }, { status: 400 })
  }

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0)
  if (totalWeight <= 0) {
    return NextResponse.json({ error: 'total weight must be > 0' }, { status: 400 })
  }

  const trafficSplit: Record<string, number> = {}
  for (const v of variants) trafficSplit[v.name] = v.weight / totalWeight

  const supabase = getAbAdminClient()
  const { data, error } = await supabase
    .from('ab_experiments')
    .insert({
      experiment_key: experimentKey,
      description,
      hypothesis,
      primary_metric: primaryMetric,
      variants: variants as unknown as Json,
      traffic_split: trafficSplit as unknown as Json,
      status: 'draft',
      created_by_user_id: user.id,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ id: data.id })
}

// ---------------------------------------------------------------
// Helpers de parsing/normalisation
// ---------------------------------------------------------------

function parseVariantsFromBody(raw: unknown): { name: string; weight: number; label?: string }[] {
  if (!Array.isArray(raw)) return []
  const out: { name: string; weight: number; label?: string }[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const obj = item as { name?: unknown; weight?: unknown; label?: unknown }
    const name = typeof obj.name === 'string' ? obj.name.trim() : ''
    const weight = typeof obj.weight === 'number' ? obj.weight : 0
    const label = typeof obj.label === 'string' ? obj.label : undefined
    if (!name || weight <= 0) continue
    out.push(label ? { name, weight, label } : { name, weight })
  }
  return out
}

function parseVariantsForApi(raw: Json): { name: string; weight: number; label?: string }[] {
  if (!Array.isArray(raw)) return []
  const out: { name: string; weight: number; label?: string }[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const obj = item as { name?: unknown; weight?: unknown; label?: unknown }
    const name = typeof obj.name === 'string' ? obj.name : ''
    const weight = typeof obj.weight === 'number' ? obj.weight : 50
    const label = typeof obj.label === 'string' ? obj.label : undefined
    if (!name) continue
    out.push(label ? { name, weight, label } : { name, weight })
  }
  return out
}

export type { AdminExperimentSummary, AbEventTypeDB }
