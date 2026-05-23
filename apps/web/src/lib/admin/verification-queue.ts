import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Helpers data layer pour /admin/verifications/queue.
 *
 * Lit la vue `admin_verification_queue` (créée par VAL-1) + dérive les 4 KPI
 * cards. Toute requête est ROLE-SCOPED service_role (page déjà gated par
 * verifyAdminAccess()).
 */

export interface VerificationQueueRow {
  id: string
  full_name: string | null
  city: string | null
  overall_status: 'pending' | 'rejected' | 'expired' | 'verified' | null
  badge_level: 'unverified' | 'verified' | 'verified_plus' | null
  manual_review_priority: number | null
  identity_status: string | null
  cofrac_status: string | null
  rcpro_status: string | null
  sirene_status: string | null
  signalements_count: number | null
  verification_started_at: string | null
  last_activity_at: string | null
}

export interface VerificationQueueKpis {
  totalPending: number
  totalCritical: number
  totalInReview: number
  validatedToday: number
}

export type QueueFilter = 'all' | 'pending' | 'in_review' | 'rejected' | 'signalement_threshold'

export interface FetchQueueOptions {
  filter: QueueFilter
  limit?: number
}

/**
 * Charge la file de modération filtrée + triée par priorité décroissante.
 */
export async function fetchVerificationQueue(
  supabase: SupabaseClient,
  options: FetchQueueOptions,
): Promise<VerificationQueueRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 1000)
  // La vue applique déjà : WHERE overall_status IN ('pending','rejected')
  //                          OR manual_review_priority > 0
  // ORDER BY manual_review_priority DESC, updated_at ASC.
  let query = supabase
    .from('admin_verification_queue')
    .select(
      'id, full_name, city, overall_status, badge_level, manual_review_priority, identity_status, cofrac_status, rcpro_status, sirene_status, signalements_count, verification_started_at, last_activity_at',
    )
    .limit(limit)

  switch (options.filter) {
    case 'pending':
      query = query.eq('overall_status', 'pending')
      break
    case 'rejected':
      query = query.eq('overall_status', 'rejected')
      break
    case 'in_review':
      query = query.or(
        'identity_status.eq.in_review,cofrac_status.eq.in_review,rcpro_status.eq.in_review,sirene_status.eq.in_review',
      )
      break
    case 'signalement_threshold':
      query = query.gte('signalements_count', 3)
      break
    default:
      // 'all' = no filter
      break
  }

  const { data, error } = await query
  if (error) {
    console.error('[verification-queue] fetch error', error.message)
    return []
  }
  return (data ?? []) as VerificationQueueRow[]
}

/**
 * KPIs en haut de page (4 cards).
 *  - Total en attente               : overall_status='pending'
 *  - Critique (priority >= 50)      : manual_review_priority >= 50
 *  - In review (manuel requis)      : un des 4 statuts phases = 'in_review'
 *  - Validés aujourd'hui            : updated_at>=today AND overall_status='verified'
 */
export async function fetchVerificationKpis(
  supabase: SupabaseClient,
): Promise<VerificationQueueKpis> {
  const todayIso = new Date()
  todayIso.setUTCHours(0, 0, 0, 0)
  const todayString = todayIso.toISOString()

  const [pendingRes, criticalRes, inReviewRes, validatedRes] = await Promise.all([
    supabase
      .from('diagnostician_verification_status')
      .select('diagnostician_id', { count: 'exact', head: true })
      .eq('overall_status', 'pending'),
    supabase
      .from('diagnostician_verification_status')
      .select('diagnostician_id', { count: 'exact', head: true })
      .gte('manual_review_priority', 50),
    supabase
      .from('diagnostician_verification_status')
      .select('diagnostician_id', { count: 'exact', head: true })
      .or(
        'identity_status.eq.in_review,cofrac_status.eq.in_review,rcpro_status.eq.in_review,sirene_status.eq.in_review',
      ),
    supabase
      .from('diagnostician_verification_status')
      .select('diagnostician_id', { count: 'exact', head: true })
      .eq('overall_status', 'verified')
      .gte('updated_at', todayString),
  ])

  return {
    totalPending: pendingRes.count ?? 0,
    totalCritical: criticalRes.count ?? 0,
    totalInReview: inReviewRes.count ?? 0,
    validatedToday: validatedRes.count ?? 0,
  }
}
