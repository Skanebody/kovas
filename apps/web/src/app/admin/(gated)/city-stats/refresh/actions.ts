'use server'

/**
 * Server Actions admin /city-stats/refresh.
 *
 * - `triggerCityStatsBatch` : lance le batch refresh de N villes via
 *   l'Edge Function `refresh-city-stats-batch`.
 * - `triggerCityStatsUnit` : force le refresh d'une ville précise via
 *   l'Edge Function `refresh-city-stats`.
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { revalidatePath } from 'next/cache'

async function requireAdmin(): Promise<void> {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || access.needs2FA || access.hasNoSecret || !access.user) {
    throw new Error('Forbidden — admin access required.')
  }
}

export interface BatchResult {
  ok: boolean
  error?: string
  details?: {
    total_selected?: number
    succeeded?: number
    failed?: number
    p95_ms?: number
    total_ms?: number
  }
}

export async function triggerCityStatsBatch(limit = 50): Promise<BatchResult> {
  await requireAdmin()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, error: 'Configuration Edge Function manquante' }
  }

  let response: Response
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/refresh-city-stats-batch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode: 'manual', limit }),
    })
  } catch (err) {
    return {
      ok: false,
      error: `Echec d'appel Edge Function : ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  if (!response.ok) {
    const errText = await response.text()
    return {
      ok: false,
      error: `Edge Function échec ${response.status} : ${errText.slice(0, 300)}`,
    }
  }

  const json = (await response.json()) as {
    total_selected?: number
    succeeded?: number
    failed?: number
    durations?: { p95_ms?: number; total_ms?: number }
  }

  revalidatePath('/admin/city-stats/refresh')

  return {
    ok: true,
    details: {
      total_selected: json.total_selected,
      succeeded: json.succeeded,
      failed: json.failed,
      p95_ms: json.durations?.p95_ms,
      total_ms: json.durations?.total_ms,
    },
  }
}

export interface UnitResult {
  ok: boolean
  error?: string
  details?: {
    total_dpe_count?: number
    ai_generated?: boolean
    refresh_status?: string
    duration_ms?: number
  }
}

export async function triggerCityStatsUnit(input: {
  citySlug: string
  cityName: string
  deptCode: string
  inseeCode: string | null
}): Promise<UnitResult> {
  await requireAdmin()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, error: 'Configuration Edge Function manquante' }
  }

  let response: Response
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/refresh-city-stats`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        city_slug: input.citySlug,
        city_name: input.cityName,
        dept_code: input.deptCode,
        insee_code: input.inseeCode ?? undefined,
        force: true,
      }),
    })
  } catch (err) {
    return {
      ok: false,
      error: `Echec d'appel Edge Function : ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const json = (await response.json().catch(() => ({}))) as {
    total_dpe_count?: number
    ai_generated?: boolean
    refresh_status?: string
    duration_ms?: number
    error?: string
  }

  if (!response.ok) {
    return { ok: false, error: json.error ?? `HTTP ${response.status}` }
  }

  revalidatePath('/admin/city-stats/refresh')

  return {
    ok: true,
    details: {
      total_dpe_count: json.total_dpe_count,
      ai_generated: json.ai_generated,
      refresh_status: json.refresh_status,
      duration_ms: json.duration_ms,
    },
  }
}
