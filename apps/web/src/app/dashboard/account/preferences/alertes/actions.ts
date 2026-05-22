'use server'

/**
 * Server actions — préférences d'alertes.
 *
 * Toutes les actions sont scoped à l'organisation courante via getCurrentUser.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import {
  getAlertPreferences,
  updateAlertPreferences,
} from '@/lib/alerts/user-preferences'
import type { AlertPreferences } from '@/lib/alerts/types'
import { revalidatePath } from 'next/cache'

export async function loadAlertPreferencesAction(): Promise<AlertPreferences> {
  const { supabase, orgId } = await getCurrentUser()
  return getAlertPreferences(supabase, orgId)
}

export async function saveAlertPreferencesAction(
  patch: Partial<Omit<AlertPreferences, 'organizationId'>>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, orgId } = await getCurrentUser()
  try {
    await updateAlertPreferences(supabase, { organizationId: orgId, ...patch })
    revalidatePath('/dashboard/account/preferences/alertes')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
