import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Compteur DPE annuel — limite légale française.
 *
 * Spec :
 * - Limite légale : 1000 DPE/an/diagnostiqueur (article R134-4-3 Code construction)
 * - Comptage : missions de type DPE (dpe_vente + dpe_location + copropriete)
 *   en status `done` ou `exported`, completed_at année courante (Europe/Paris)
 *
 * Alertes selon seuil :
 * - < 80%   : aucune alerte
 * - 80-89%  : info amber "vous approchez de la limite"
 * - 90-94%  : warning orange "attention au plafond"
 * - 95-98%  : critical red "très proche du plafond légal"
 * - 99-100% : critical+ "limite atteinte/dépassée"
 *
 * Référence : CLAUDE.md §4 Certifications & conformité (V1.5).
 */

export const DPE_LEGAL_LIMIT = 1000

export const DPE_MISSION_TYPES = ['dpe_vente', 'dpe_location', 'copropriete'] as const

export type DpeAlertLevel = 'none' | 'info' | 'warning' | 'critical' | 'exceeded'

export interface DpeCounterResult {
  count: number
  limit: number
  percentage: number
  remaining: number
  alertLevel: DpeAlertLevel
  year: number
  /** Projection annuelle linéaire si maintien du rythme courant */
  yearlyProjection: number
}

/**
 * Calcule le compteur DPE pour l'année courante.
 * Server-only : utilise un client Supabase server-side avec RLS.
 */
export async function getDpeCountThisYear(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<DpeCounterResult> {
  const now = new Date()
  const year = now.getFullYear()
  const yearStart = new Date(`${year}-01-01T00:00:00+01:00`)
  const yearEnd = new Date(`${year + 1}-01-01T00:00:00+01:00`)

  const { count } = await supabase
    .from('missions')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .in('type', DPE_MISSION_TYPES)
    .in('status', ['done', 'exported'])
    .gte('completed_at', yearStart.toISOString())
    .lt('completed_at', yearEnd.toISOString())

  const c = count ?? 0
  const percentage = Math.round((c / DPE_LEGAL_LIMIT) * 100)

  // Projection annuelle linéaire : (jour de l'année / nombre de jours) -> extrapolation
  const dayOfYear = Math.floor(
    (now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24),
  )
  const totalDays = Math.floor((yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24))
  const yearlyProjection = dayOfYear > 0 ? Math.round((c / dayOfYear) * totalDays) : 0

  return {
    count: c,
    limit: DPE_LEGAL_LIMIT,
    percentage,
    remaining: Math.max(DPE_LEGAL_LIMIT - c, 0),
    alertLevel: alertLevelFor(percentage),
    year,
    yearlyProjection,
  }
}

export function alertLevelFor(percentage: number): DpeAlertLevel {
  if (percentage >= 100) return 'exceeded'
  if (percentage >= 95) return 'critical'
  if (percentage >= 90) return 'warning'
  if (percentage >= 80) return 'info'
  return 'none'
}

/**
 * Microcopy contextuelle selon le niveau d'alerte.
 * Ton avatar client (CLAUDE.md docs/avatar-client.md) : SOBRE PROFESSIONNEL.
 */
export function microcopyFor(result: DpeCounterResult): string {
  const { count, limit, remaining, alertLevel, yearlyProjection } = result
  switch (alertLevel) {
    case 'exceeded':
      return `Limite légale atteinte (${count}/${limit}). Toute nouvelle attestation DPE doit attendre l'année prochaine.`
    case 'critical':
      return `Plus que ${remaining} DPE possibles cette année. Critique : revoyez votre planning.`
    case 'warning':
      return `${remaining} DPE restants avant la limite légale. Soyez attentif.`
    case 'info':
      return `À ce rythme, vous êtes parti pour ${yearlyProjection} DPE sur l'année (limite ${limit}).`
    case 'none':
    default:
      return yearlyProjection > 0
        ? `Marge confortable. À ce rythme : ${yearlyProjection} DPE prévus sur l'année.`
        : `Aucun DPE comptabilisé pour l'instant cette année.`
  }
}
