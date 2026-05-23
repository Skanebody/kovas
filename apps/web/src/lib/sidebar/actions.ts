'use server'

/**
 * KOVAS — Server Actions pour mutations de préférences sidebar.
 * Validée côté serveur, RLS Supabase garantit l'isolation par user_id.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { saveSidebarPreferences } from './preferences-server'
import type { SidebarPreferences } from './preferences-types'
import { ALL_PROFILE_PRESETS, type ProfilePresetCode } from './profile-presets'
import { SIDEBAR_ITEMS_REGISTRY, type SidebarItemId } from './sidebar-items'

const KNOWN_IDS = new Set<SidebarItemId>(SIDEBAR_ITEMS_REGISTRY.map((i) => i.id))
const KNOWN_PRESETS = new Set<ProfilePresetCode>(ALL_PROFILE_PRESETS.map((p) => p.code))

/**
 * Valide les préférences entrantes : ne conserve que les ids connus, types
 * stricts. Renvoie un set propre prêt pour upsert.
 */
function sanitizePreferences(input: unknown): SidebarPreferences | null {
  if (!input || typeof input !== 'object') return null
  const obj = input as Record<string, unknown>

  const mainItemsRaw = Array.isArray(obj.mainItems) ? obj.mainItems : []
  const moreItemsRaw = Array.isArray(obj.moreItems) ? obj.moreItems : []

  const mainItems: SidebarPreferences['mainItems'] = []
  for (const entry of mainItemsRaw) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    if (
      typeof e.id === 'string' &&
      KNOWN_IDS.has(e.id as SidebarItemId) &&
      typeof e.position === 'number' &&
      typeof e.visible === 'boolean'
    ) {
      mainItems.push({
        id: e.id as SidebarItemId,
        position: e.position,
        visible: e.visible,
      })
    }
  }
  const moreItems: SidebarPreferences['moreItems'] = []
  for (const entry of moreItemsRaw) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    if (
      typeof e.id === 'string' &&
      KNOWN_IDS.has(e.id as SidebarItemId) &&
      typeof e.position === 'number' &&
      typeof e.visible === 'boolean'
    ) {
      moreItems.push({
        id: e.id as SidebarItemId,
        position: e.position,
        visible: e.visible,
      })
    }
  }

  const presetCandidate = obj.profilePreset
  const profilePreset: ProfilePresetCode | null =
    typeof presetCandidate === 'string' && KNOWN_PRESETS.has(presetCandidate as ProfilePresetCode)
      ? (presetCandidate as ProfilePresetCode)
      : null

  const notificationStyle = obj.notificationStyle === 'dot' ? 'dot' : 'count'
  const sidebarCollapsed = Boolean(obj.sidebarCollapsed)

  return {
    mainItems,
    moreItems,
    profilePreset,
    notificationStyle,
    sidebarCollapsed,
  }
}

/**
 * Server Action — sauvegarde les préférences de l'utilisateur courant.
 * Pas de revalidation : la sidebar se met à jour optimistement côté client
 * et via Supabase Realtime.
 */
export async function saveSidebarPreferencesAction(input: unknown): Promise<void> {
  const sanitized = sanitizePreferences(input)
  if (!sanitized) return
  const { user, supabase } = await getCurrentUser()
  await saveSidebarPreferences(user.id, sanitized, supabase)
}
