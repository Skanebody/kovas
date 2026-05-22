/**
 * Learning engine — apprentissage par ignorance.
 *
 * Règle KOVAS : si un utilisateur ignore 5 fois consécutivement le même
 * type d'alerte, on l'auto-désactive (silencieusement, on l'informe
 * dans le rapport mensuel).
 *
 * Tables :
 *  - alert_dismissals (historique)
 *  - alert_auto_disabled (état courant — un upsert par (org, type, subtype))
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { AUTO_DISABLE_THRESHOLD } from './types'

export interface DismissalContext {
  organizationId: string
  userId: string
  alertType: string
  alertSubtype?: string
  context?: Record<string, unknown>
}

/**
 * Enregistre une ignorance utilisateur. Idempotent côté DB
 * (chaque dismiss est une nouvelle ligne — c'est volontaire pour audit).
 */
export async function recordDismissal(
  supabase: SupabaseClient,
  payload: DismissalContext,
): Promise<void> {
  const { error } = await supabase.from('alert_dismissals').insert({
    organization_id: payload.organizationId,
    user_id: payload.userId,
    alert_type: payload.alertType,
    alert_subtype: payload.alertSubtype ?? null,
    context: payload.context ?? null,
  })
  if (error) {
    console.warn('[alerts] recordDismissal failed', error)
  }
}

/**
 * Vrai si l'alerte doit être auto-désactivée maintenant.
 * Comptage : 5 dismissals consécutifs (= les 5 derniers, sans réactivation entre temps).
 *
 * Implémentation simple : on regarde le nombre total de dismissals
 * postérieurs à l'éventuelle date de réactivation (= last `disabled_at` row absent).
 */
export async function shouldAutoDisable(
  supabase: SupabaseClient,
  organizationId: string,
  alertType: string,
  alertSubtype?: string,
): Promise<boolean> {
  // Si déjà désactivée, on évite le re-compte.
  const { data: existing } = await supabase
    .from('alert_auto_disabled')
    .select('disabled_at')
    .eq('organization_id', organizationId)
    .eq('alert_type', alertType)
    .eq('alert_subtype', alertSubtype ?? null)
    .maybeSingle()

  if (existing) return true

  const query = supabase
    .from('alert_dismissals')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('alert_type', alertType)

  if (alertSubtype) {
    query.eq('alert_subtype', alertSubtype)
  } else {
    query.is('alert_subtype', null)
  }

  const { count, error } = await query
  if (error) {
    console.warn('[alerts] shouldAutoDisable count failed', error)
    return false
  }
  return (count ?? 0) >= AUTO_DISABLE_THRESHOLD
}

/**
 * Marque le type d'alerte comme auto-désactivé pour l'org.
 * Appelé typiquement par l'Edge Function recalibrate-alerts-for-user
 * (hebdomadaire) ou immédiatement après le 5e dismiss.
 */
export async function autoDisableAlertType(
  supabase: SupabaseClient,
  organizationId: string,
  alertType: string,
  alertSubtype?: string,
  reason = 'auto: 5 ignorances consécutives',
): Promise<void> {
  const { error } = await supabase.from('alert_auto_disabled').upsert(
    {
      organization_id: organizationId,
      alert_type: alertType,
      alert_subtype: alertSubtype ?? null,
      reason,
    },
    { onConflict: 'organization_id,alert_type,alert_subtype' },
  )
  if (error) {
    console.warn('[alerts] autoDisableAlertType failed', error)
  }
}

/**
 * Liste les types d'alertes désactivés pour une org.
 * Utilisé par AlertManager au filtrage.
 */
export async function getAutoDisabledTypes(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ReadonlySet<string>> {
  const { data, error } = await supabase
    .from('alert_auto_disabled')
    .select('alert_type, alert_subtype')
    .eq('organization_id', organizationId)
  if (error || !data) return new Set()
  const set = new Set<string>()
  for (const row of data as Array<{ alert_type: string; alert_subtype: string | null }>) {
    set.add(row.alert_subtype ? `${row.alert_type}:${row.alert_subtype}` : row.alert_type)
  }
  return set
}
