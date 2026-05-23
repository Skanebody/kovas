/**
 * KOVAS — Types canoniques pour les préférences sidebar.
 * Partagés server / client.
 */

import type { ProfilePresetCode } from './profile-presets'
import type { SidebarItemId } from './sidebar-items'

export interface SidebarPreferencesItem {
  id: SidebarItemId
  position: number
  visible: boolean
}

export type SidebarNotificationStyle = 'count' | 'dot'

export interface SidebarPreferences {
  mainItems: SidebarPreferencesItem[]
  moreItems: SidebarPreferencesItem[]
  profilePreset: ProfilePresetCode | null
  notificationStyle: SidebarNotificationStyle
  sidebarCollapsed: boolean
}

/**
 * Préférences par défaut hors-ligne / nouveau user.
 * Construites à partir du registre canonique (mainItems = items dont
 * defaultZone === 'main', triés par defaultPosition).
 */
export const DEFAULT_SIDEBAR_PREFERENCES: SidebarPreferences = {
  mainItems: [],
  moreItems: [],
  profilePreset: null,
  notificationStyle: 'count',
  sidebarCollapsed: false,
}
