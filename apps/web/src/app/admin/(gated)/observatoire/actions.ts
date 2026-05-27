'use server'

/**
 * Server Actions admin /observatoire.
 *
 * - `triggerManualGeneration` : appelle l'Edge Function pour générer un
 *   rapport (mois passé par défaut, ou force=true pour régénérer).
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { revalidatePath } from 'next/cache'

async function requireAdmin(): Promise<void> {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || access.needs2FA || access.hasNoSecret || !access.user) {
    throw new Error('Forbidden — admin access required.')
  }
}

export async function triggerManualGeneration(options?: {
  force?: boolean
  targetYear?: number
  targetMonth?: number
}): Promise<{ ok: boolean; error?: string; details?: unknown }> {
  await requireAdmin()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, error: 'Configuration Edge Function manquante' }
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/observatoire-monthly-report`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      force: options?.force ?? false,
      target_year: options?.targetYear,
      target_month: options?.targetMonth,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    return { ok: false, error: `Edge Function échec : ${errText.slice(0, 300)}` }
  }

  const json = await response.json()
  revalidatePath('/admin/observatoire')
  return { ok: true, details: json }
}
