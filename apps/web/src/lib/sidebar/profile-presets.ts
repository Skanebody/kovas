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
 * Démarrer en tête, accès rapide dossiers/calendrier/clients/biens.
 *
 * Refonte 2026-05-27 : ajout `properties` (Biens, entité métier centrale)
 * en position 5. `home` repoussé en fin (l'accueil est moins utile sur le
 * terrain qu'un accès direct aux entités).
 */
export const PROFILE_SOLO_TERRAIN: ProfilePreset = {
  code: 'solo_terrain',
  label: 'Solo terrain',
  description: 'Démarrer et dossiers en tête. Idéal si tu es principalement en visite client.',
  mainOrder: ['capture', 'dossiers', 'calendar', 'clients', 'properties', 'facturation', 'home'],
}

/**
 * Solo administratif — diagnostiqueur indépendant centré bureau.
 * Accueil + dossiers + facturation + statistiques + gain en priorité.
 *
 * Refonte 2026-05-27 : ajout `gain` (KPI mensuel de temps libéré, motivation
 * jour 1 sur un profil bureau qui veut suivre son ROI) en position 4.
 */
export const PROFILE_SOLO_ADMIN: ProfilePreset = {
  code: 'solo_admin',
  label: 'Solo administratif',
  description:
    'Accueil, dossiers, facturation et gain de temps en tête. Idéal pour un solo orienté bureau.',
  mainOrder: ['home', 'dossiers', 'calendar', 'facturation', 'gain', 'analytics', 'clients'],
}

/**
 * Manager Cabinet — vue équipe et planning collectif.
 * Accueil (équipe) + dossiers + planning + facturation + statistiques + leads.
 *
 * Refonte 2026-05-27 : ajout `leads` (file demandes B2C entrantes — utile pour
 * dispatch équipe) en position 5. `capture` bascule dans more (le manager
 * ne capture pas lui-même, c'est ses diagnostiqueurs).
 */
export const PROFILE_MANAGER_CABINET: ProfilePreset = {
  code: 'manager_cabinet',
  label: 'Manager Cabinet',
  description:
    'Vue équipe, planning collectif, facturation et leads B2C. Démarrer bascule dans Plus.',
  mainOrder: ['home', 'dossiers', 'calendar', 'facturation', 'leads', 'analytics', 'clients'],
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
