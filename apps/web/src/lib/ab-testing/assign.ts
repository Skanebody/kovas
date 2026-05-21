import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AbDatabase, Json } from './types'

/**
 * A/B testing — assignation déterministe par hash(userIdentifier + experimentKey)
 * + helpers Supabase pour persister assignments et events.
 *
 * Mission C2. Toutes les lectures/écritures passent par une SupabaseClient
 * en service_role (RLS service_role only sur ab_*).
 */

export type AbSupabase = SupabaseClient<AbDatabase, 'public'>

export type ABEventType = 'exposure' | 'conversion' | 'click' | 'submit'

export type ABExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'aborted'

export interface ABVariant {
  name: string
  weight: number
  label?: string
}

export interface ABExperiment {
  key: string
  variants: ABVariant[]
  status: ABExperimentStatus
}

export interface ABExperimentRow extends ABExperiment {
  id: string
}

/**
 * Assigne un variant pour un user_identifier donné.
 *
 * - Si l'expérience n'est pas `running`, retourne toujours le premier variant
 *   (par convention `control`).
 * - Sinon, hash SHA-256(userIdentifier + ':' + experimentKey) mappé sur la
 *   somme pondérée des weights. Même paire (user, exp) ⇒ même variant.
 */
export function assignVariant(experiment: ABExperiment, userIdentifier: string): string {
  const fallback = experiment.variants[0]?.name ?? 'control'

  if (experiment.status !== 'running') return fallback
  if (!experiment.variants.length) return fallback

  const totalWeight = experiment.variants.reduce((sum, v) => sum + Math.max(0, v.weight), 0)
  if (totalWeight <= 0) return fallback

  const hash = createHash('sha256').update(`${userIdentifier}:${experiment.key}`).digest('hex')
  const hashInt = Number.parseInt(hash.slice(0, 8), 16)
  const bucket = hashInt % totalWeight

  let cumulative = 0
  for (const v of experiment.variants) {
    cumulative += Math.max(0, v.weight)
    if (bucket < cumulative) return v.name
  }
  return fallback
}

/**
 * Charge une expérience par sa clé. Retourne null si introuvable.
 * Requiert un client Supabase en service_role.
 */
export async function loadExperiment(
  supabase: AbSupabase,
  experimentKey: string,
): Promise<ABExperimentRow | null> {
  const { data, error } = await supabase
    .from('ab_experiments')
    .select('id, experiment_key, variants, status')
    .eq('experiment_key', experimentKey)
    .maybeSingle()

  if (error || !data) return null

  return {
    id: data.id,
    key: data.experiment_key,
    variants: parseVariants(data.variants),
    status: data.status,
  }
}

/**
 * Upsert l'assignment d'un user_identifier sur une expérience.
 * Idempotent grâce au UNIQUE(experiment_id, user_identifier).
 */
export async function upsertAssignment(
  supabase: AbSupabase,
  experimentId: string,
  userIdentifier: string,
  variant: string,
): Promise<void> {
  await supabase.from('ab_assignments').upsert(
    {
      experiment_id: experimentId,
      user_identifier: userIdentifier,
      variant_assigned: variant,
    },
    { onConflict: 'experiment_id,user_identifier', ignoreDuplicates: true },
  )
}

/**
 * Insère un event A/B. variant_assigned est dénormalisé pour
 * l'agrégation rapide (vue ab_experiment_results).
 */
export async function trackEvent(
  supabase: AbSupabase,
  params: {
    experimentId: string
    userIdentifier: string
    eventType: ABEventType
    variantAssigned: string
    eventValue?: number
    eventData?: Record<string, unknown>
  },
): Promise<void> {
  await supabase.from('ab_events').insert({
    experiment_id: params.experimentId,
    user_identifier: params.userIdentifier,
    event_type: params.eventType,
    variant_assigned: params.variantAssigned,
    event_value: params.eventValue ?? null,
    event_data: (params.eventData ?? null) as Json | null,
  })
}

/**
 * Lit le variant déjà assigné à un user_identifier pour une experiment_id donnée.
 * Retourne null si pas d'assignment encore.
 */
export async function readAssignment(
  supabase: AbSupabase,
  experimentId: string,
  userIdentifier: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('ab_assignments')
    .select('variant_assigned')
    .eq('experiment_id', experimentId)
    .eq('user_identifier', userIdentifier)
    .maybeSingle()
  return data?.variant_assigned ?? null
}

/**
 * Parse défensif des `variants` stockés en JSONB.
 * Accepte la forme [{name, weight, label?}].
 */
function parseVariants(raw: Json): ABVariant[] {
  if (!Array.isArray(raw)) return []
  const out: ABVariant[] = []
  for (const item of raw) {
    if (
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      'name' in item &&
      typeof (item as { name: unknown }).name === 'string'
    ) {
      const obj = item as { name: string; weight?: unknown; label?: unknown }
      const weight = typeof obj.weight === 'number' ? obj.weight : 50
      const label = typeof obj.label === 'string' ? obj.label : undefined
      out.push({ name: obj.name, weight, label })
    }
  }
  return out
}
