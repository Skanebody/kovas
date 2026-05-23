/**
 * KOVAS — Server-side helpers pour charger / sauvegarder les préférences sidebar.
 * Utilisable depuis Server Components, route handlers, Server Actions.
 */

import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_SIDEBAR_PREFERENCES,
  type SidebarNotificationStyle,
  type SidebarPreferences,
  type SidebarPreferencesItem,
} from './preferences-types'
import {
  ALL_PROFILE_PRESETS,
  type ProfilePresetCode,
  expandPreset,
  getPreset,
} from './profile-presets'
import { SIDEBAR_ITEMS_REGISTRY, type SidebarItemId } from './sidebar-items'

const KNOWN_IDS: ReadonlySet<SidebarItemId> = new Set(SIDEBAR_ITEMS_REGISTRY.map((i) => i.id))

const KNOWN_PRESETS: ReadonlySet<ProfilePresetCode> = new Set(
  ALL_PROFILE_PRESETS.map((p) => p.code),
)

/**
 * Type-guard / parse runtime du JSONB Supabase vers SidebarPreferencesItem[].
 * Ignore les ids inconnus (préférences obsolètes) et les entrées malformées.
 */
function parseItemsJsonb(raw: unknown): SidebarPreferencesItem[] {
  if (!Array.isArray(raw)) return []
  const result: SidebarPreferencesItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const obj = entry as Record<string, unknown>
    const id = obj.id
    const position = obj.position
    const visible = obj.visible
    if (
      typeof id === 'string' &&
      KNOWN_IDS.has(id as SidebarItemId) &&
      typeof position === 'number' &&
      typeof visible === 'boolean'
    ) {
      result.push({ id: id as SidebarItemId, position, visible })
    }
  }
  return result
}

/**
 * Construit les préférences par défaut depuis le registre canonique.
 * Utilisé quand un user n'a pas encore de ligne sidebar_preferences.
 */
export function buildDefaultPreferences(): SidebarPreferences {
  const mainItems: SidebarPreferencesItem[] = SIDEBAR_ITEMS_REGISTRY.filter(
    (def) => def.defaultZone === 'main',
  )
    .sort((a, b) => a.defaultPosition - b.defaultPosition)
    .map((def, idx) => ({ id: def.id, position: idx, visible: true }))
  const moreItems: SidebarPreferencesItem[] = SIDEBAR_ITEMS_REGISTRY.filter(
    (def) => def.defaultZone === 'more',
  )
    .sort((a, b) => a.defaultPosition - b.defaultPosition)
    .map((def, idx) => ({ id: def.id, position: idx, visible: true }))
  return {
    ...DEFAULT_SIDEBAR_PREFERENCES,
    mainItems,
    moreItems,
  }
}

/**
 * Réconcilie des préférences chargées avec le registre actuel :
 *  - ajoute les items présents en registre mais absents des préférences (en more)
 *  - retire les items obsolètes (déjà filtré par parseItemsJsonb)
 */
function reconcileWithRegistry(prefs: SidebarPreferences): SidebarPreferences {
  const present = new Set<SidebarItemId>([
    ...prefs.mainItems.map((i) => i.id),
    ...prefs.moreItems.map((i) => i.id),
  ])
  const missing = SIDEBAR_ITEMS_REGISTRY.filter((def) => !present.has(def.id))
  if (missing.length === 0) return prefs
  // Ajoute les manquants dans more, à la fin
  const baseMaxPos = prefs.moreItems.reduce((max, i) => Math.max(max, i.position), -1)
  const additions: SidebarPreferencesItem[] = missing
    .sort((a, b) => a.defaultPosition - b.defaultPosition)
    .map((def, idx) => ({
      id: def.id,
      position: baseMaxPos + 1 + idx,
      visible: true,
    }))
  return {
    ...prefs,
    moreItems: [...prefs.moreItems, ...additions],
  }
}

/**
 * Charge les préférences sidebar d'un user. Retourne les valeurs par défaut
 * si pas de ligne en DB. Réconcilie automatiquement avec le registre actuel
 * (ajoute les nouveaux items, ignore les obsolètes).
 */
export async function loadSidebarPreferences(
  userId: string,
  client?: SupabaseClient,
): Promise<SidebarPreferences> {
  const supabase = client ?? (await createClient())
  // biome-ignore lint/suspicious/noExplicitAny: table sidebar_preferences non incluse dans types Database (cf. tâche DEPLOY-4 pending)
  const supabaseAny = supabase as any
  const { data, error } = await supabaseAny
    .from('sidebar_preferences')
    .select('main_items, more_items, profile_preset, notification_style, sidebar_collapsed')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    return buildDefaultPreferences()
  }

  const row = data as {
    main_items: unknown
    more_items: unknown
    profile_preset: string | null
    notification_style: string | null
    sidebar_collapsed: boolean | null
  }

  const mainItems = parseItemsJsonb(row.main_items)
  const moreItems = parseItemsJsonb(row.more_items)

  // Si DB renvoie un set vide (jamais customisé), on retombe sur défaut
  if (mainItems.length === 0 && moreItems.length === 0) {
    return buildDefaultPreferences()
  }

  const notificationStyle: SidebarNotificationStyle =
    row.notification_style === 'dot' ? 'dot' : 'count'

  const presetCandidate = row.profile_preset
  const profilePreset: ProfilePresetCode | null =
    typeof presetCandidate === 'string' && KNOWN_PRESETS.has(presetCandidate as ProfilePresetCode)
      ? (presetCandidate as ProfilePresetCode)
      : null

  return reconcileWithRegistry({
    mainItems,
    moreItems,
    profilePreset,
    notificationStyle,
    sidebarCollapsed: Boolean(row.sidebar_collapsed),
  })
}

/**
 * Sauvegarde les préférences (upsert sur user_id).
 * Appelle depuis Server Actions ou route handlers.
 */
export async function saveSidebarPreferences(
  userId: string,
  prefs: SidebarPreferences,
  client?: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = client ?? (await createClient())
  // biome-ignore lint/suspicious/noExplicitAny: table sidebar_preferences non incluse dans types Database (cf. tâche DEPLOY-4 pending)
  const supabaseAny = supabase as any
  const { error } = await supabaseAny.from('sidebar_preferences').upsert(
    {
      user_id: userId,
      main_items: prefs.mainItems,
      more_items: prefs.moreItems,
      profile_preset: prefs.profilePreset,
      notification_style: prefs.notificationStyle,
      sidebar_collapsed: prefs.sidebarCollapsed,
    },
    { onConflict: 'user_id' },
  )
  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/**
 * Applique un preset (retourne les préférences résultantes sans sauvegarder).
 */
export function applyPreset(code: ProfilePresetCode, base: SidebarPreferences): SidebarPreferences {
  const preset = getPreset(code)
  if (!preset) return base
  const { mainItems, moreItems } = expandPreset(preset)
  return {
    ...base,
    mainItems,
    moreItems,
    profilePreset: code,
  }
}

/** Reset complet aux défauts (perd le preset). */
export function resetToDefaults(base: SidebarPreferences): SidebarPreferences {
  const fresh = buildDefaultPreferences()
  return {
    ...base,
    mainItems: fresh.mainItems,
    moreItems: fresh.moreItems,
    profilePreset: null,
  }
}
