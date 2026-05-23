'use server'

/**
 * Server Actions admin /observatoire/refresh.
 *
 * - `triggerStatsRefresh` : appelle l'Edge Function `observatoire-stats-refresh`
 *   pour recalculer les stats live, puis invalide le cache ISR de /observatoire.
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { revalidatePath } from 'next/cache'

async function requireAdmin(): Promise<void> {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || access.needs2FA || access.hasNoSecret || !access.user) {
    throw new Error('Forbidden — admin access required.')
  }
}

export interface RefreshActionResult {
  ok: boolean
  error?: string
  details?: {
    period_year?: number
    period_month?: number
    rows_upserted?: number
    used_real_data?: boolean
    revalidated?: boolean
  }
}

export async function triggerStatsRefresh(options?: {
  targetYear?: number
  targetMonth?: number
}): Promise<RefreshActionResult> {
  await requireAdmin()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, error: 'Configuration Edge Function manquante' }
  }

  let response: Response
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/observatoire-stats-refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target_year: options?.targetYear,
        target_month: options?.targetMonth,
      }),
    })
  } catch (err) {
    return {
      ok: false,
      error: `Echec d'appel Edge Function : ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  if (!response.ok) {
    const errText = await response.text()
    return { ok: false, error: `Edge Function échec ${response.status} : ${errText.slice(0, 300)}` }
  }

  const json = (await response.json()) as RefreshActionResult['details'] & { ok?: boolean }

  // Revalidation locale en complément du webhook (ceinture + bretelles)
  revalidatePath('/observatoire')
  revalidatePath('/observatoire/rapports')
  revalidatePath('/admin/observatoire/refresh')

  return {
    ok: true,
    details: {
      period_year: json?.period_year,
      period_month: json?.period_month,
      rows_upserted: json?.rows_upserted,
      used_real_data: json?.used_real_data,
      revalidated: json?.revalidated,
    },
  }
}
