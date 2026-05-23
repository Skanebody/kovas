/**
 * KOVAS — Profils prédéfinis de sidebar (refonte 2026-05-23).
 *
 * 3 profils opt-in que le user peut appliquer en 1 clic depuis la modale
 * Personnaliser. Chaque profil redéfinit l'ordre des `main_items` (zones 2+3)
 * et le contenu des `more_items` (zone 4).
 *
 * Note : les items NON listés dans `main` basculent automatiquement en `more`,
 * avec leur position par défaut.
 */

import type { SidebarPreferencesItem } from './preferences-types'
import type { SidebarItemId } from './sidebar-items'
import { SIDEBAR_ITEMS_REGISTRY } from './sidebar-items'

export type ProfilePresetCode = 'solo_terrain' | 'solo_admin' | 'manager_cabinet'

export interface ProfilePreset {
  code: ProfilePresetCode
  label: string
  description: string
  /** Ordre des items dans la zone main (visibles en sidebar). */
  mainOrder: readonly SidebarItemId[]
}

/**
 * Solo terrain — diagnostiqueur indépendant majoritairement en visite.
 * Capture en tête, accès rapide dossiers/calendrier/clients, Coach IA proche.
 */
export const PROFILE_SOLO_TERRAIN: ProfilePreset = {
  code: 'solo_terrain',
  label: 'Solo terrain',
  description: 'Capture et dossiers en tête. Idéal si vous êtes principalement en visite client.',
  mainOrder: ['capture', 'dossiers', 'calendar', 'clients', 'coach', 'facturation', 'home'],
}

/**
 * Solo administratif — diagnostiqueur indépendant centré bureau.
 * Accueil + dossiers + facturation + statistiques en priorité.
 */
export const PROFILE_SOLO_ADMIN: ProfilePreset = {
  code: 'solo_admin',
  label: 'Solo administratif',
  description:
    'Accueil, dossiers et facturation en tête. Idéal pour un solo orienté bureau et suivi cabinet.',
  mainOrder: ['home', 'dossiers', 'calendar', 'facturation', 'analytics', 'clients', 'coach'],
}

/**
 * Manager Cabinet — vue équipe et planning collectif.
 * Accueil (équipe) + dossiers + planning + facturation + statistiques.
 */
export const PROFILE_MANAGER_CABINET: ProfilePreset = {
  code: 'manager_cabinet',
  label: 'Manager Cabinet',
  description:
    'Vue équipe, planning collectif et facturation cabinet. Capture et Coach IA basculent dans Plus.',
  mainOrder: ['home', 'dossiers', 'calendar', 'facturation', 'analytics', 'clients'],
}

export const ALL_PROFILE_PRESETS: readonly ProfilePreset[] = [
  PROFILE_SOLO_TERRAIN,
  PROFILE_SOLO_ADMIN,
  PROFILE_MANAGER_CABINET,
] as const

/** Retourne le preset par code, ou null. */
export function getPreset(code: ProfilePresetCode | null | undefined): ProfilePreset | null {
  if (!code) return null
  return ALL_PROFILE_PRESETS.find((p) => p.code === code) ?? null
}

/**
 * Construit la paire (mainItems, moreItems) à partir d'un preset.
 *
 * - mainItems = items listés dans `mainOrder`, position respectée
 * - moreItems = tous les autres items (defaultZone === 'more' OR non listés
 *   dans mainOrder), triés par defaultPosition
 */
export function expandPreset(preset: ProfilePreset): {
  mainItems: SidebarPreferencesItem[]
  moreItems: SidebarPreferencesItem[]
} {
  const mainItems: SidebarPreferencesItem[] = preset.mainOrder.map((id, idx) => ({
    id,
    position: idx,
    visible: true,
  }))
  const mainSet = new Set<SidebarItemId>(preset.mainOrder)
  const moreItems: SidebarPreferencesItem[] = SIDEBAR_ITEMS_REGISTRY.filter(
    (def) => !mainSet.has(def.id),
  )
    .sort((a, b) => {
      // Items qui étaient déjà en more conservent leur position relative.
      if (a.defaultZone === 'more' && b.defaultZone === 'more') {
        return a.defaultPosition - b.defaultPosition
      }
      // Items déplacés depuis main → after les natifs de more
      if (a.defaultZone === 'more') return -1
      if (b.defaultZone === 'more') return 1
      return a.defaultPosition - b.defaultPosition
    })
    .map((def, idx) => ({ id: def.id, position: idx, visible: true }))
  return { mainItems, moreItems }
}
