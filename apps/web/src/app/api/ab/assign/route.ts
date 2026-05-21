import { getAbAdminClient } from '@/lib/ab-testing/admin-client'
import {
  type AbSupabase,
  assignVariant,
  loadExperiment,
  readAssignment,
  trackEvent,
  upsertAssignment,
} from '@/lib/ab-testing/assign'
import { NextResponse } from 'next/server'

/**
 * POST /api/ab/assign
 *
 * Body : { experimentKey: string, userIdentifier: string }
 *
 * Charge l'expérience, calcule (ou réutilise) le variant assigné,
 * insère un event 'exposure' (1ère exposition seulement) et retourne
 * `{ variant }`.
 *
 * Retours :
 *  200 { variant: string } — assignation OK (running)
 *  200 { variant: 'control', fallback: true } — experiment introuvable/draft/paused
 *  400 { error } — payload invalide
 *  503 { error } — service_role manquant
 */
export const runtime = 'nodejs'

interface AssignBody {
  experimentKey?: unknown
  userIdentifier?: unknown
}

export async function POST(request: Request) {
  let body: AssignBody
  try {
    body = (await request.json()) as AssignBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const experimentKey = typeof body.experimentKey === 'string' ? body.experimentKey.trim() : ''
  const userIdentifier = typeof body.userIdentifier === 'string' ? body.userIdentifier.trim() : ''

  if (!experimentKey || !userIdentifier) {
    return NextResponse.json(
      { error: 'experimentKey and userIdentifier are required' },
      { status: 400 },
    )
  }

  let supabase: AbSupabase
  try {
    supabase = getAbAdminClient()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'service role not configured' },
      { status: 503 },
    )
  }

  const exp = await loadExperiment(supabase, experimentKey)
  if (!exp) {
    // Expérience inconnue : on n'expose rien, fallback control silencieux.
    return NextResponse.json({ variant: 'control', fallback: true })
  }

  // Réutilise l'assignment existant s'il y en a un (continuité variant).
  const existing = await readAssignment(supabase, exp.id, userIdentifier)
  const variant = existing ?? assignVariant(exp, userIdentifier)

  if (!existing) {
    await upsertAssignment(supabase, exp.id, userIdentifier, variant)
  }

  // Tracking exposure (1 row par exposition, dedupliqué côté agrégat
  // via DISTINCT user_identifier — pas de coût d'insert prohibitif).
  if (exp.status === 'running') {
    await trackEvent(supabase, {
      experimentId: exp.id,
      userIdentifier,
      eventType: 'exposure',
      variantAssigned: variant,
    })
  }

  return NextResponse.json({ variant })
}
