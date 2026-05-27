/**
 * Types de vue prédéfinis pour les photos de terrain.
 * Cf. docs/file-naming-convention.md §3
 *
 * Organisés en groupes pour l'UX (pillset terrain + plus avancé via dropdown).
 */

export interface ViewType {
  id: string
  label: string
  filenameTag: string // tag pour le nom de fichier (MAJ + tirets)
  group: 'general' | 'ouvertures' | 'chauffage' | 'electrique' | 'autre'
  /** True : affiché par défaut en pills (top 5 mobile-friendly) */
  pinned?: boolean
}

export const VIEW_TYPES: ViewType[] = [
  // General
  {
    id: 'vue_generale',
    label: 'Vue générale',
    filenameTag: 'VUE-GENERALE',
    group: 'general',
    pinned: true,
  },
  { id: 'detail', label: 'Détail', filenameTag: 'DETAIL', group: 'general' },
  {
    id: 'anomalie',
    label: 'Anomalie / Désordre',
    filenameTag: 'ANOMALIE-DESORDRE',
    group: 'general',
  },

  // Ouvertures
  { id: 'fenetre_nord', label: 'Fenêtre Nord', filenameTag: 'FENETRE-NORD', group: 'ouvertures' },
  { id: 'fenetre_sud', label: 'Fenêtre Sud', filenameTag: 'FENETRE-SUD', group: 'ouvertures' },
  { id: 'fenetre_est', label: 'Fenêtre Est', filenameTag: 'FENETRE-EST', group: 'ouvertures' },
  {
    id: 'fenetre_ouest',
    label: 'Fenêtre Ouest',
    filenameTag: 'FENETRE-OUEST',
    group: 'ouvertures',
  },
  { id: 'porte_entree', label: 'Porte entrée', filenameTag: 'PORTE-ENTREE', group: 'ouvertures' },
  {
    id: 'porte_interieure',
    label: 'Porte intérieure',
    filenameTag: 'PORTE-INTERIEURE',
    group: 'ouvertures',
  },

  // Chauffage / ECS
  {
    id: 'radiateur',
    label: 'Radiateur',
    filenameTag: 'RADIATEUR',
    group: 'chauffage',
    pinned: true,
  },
  {
    id: 'chaudiere',
    label: 'Chaudière',
    filenameTag: 'CHAUDIERE',
    group: 'chauffage',
    pinned: true,
  },
  { id: 'chauffe_eau', label: 'Chauffe-eau', filenameTag: 'CHAUFFE-EAU', group: 'chauffage' },
  {
    id: 'plaque_signaletique',
    label: 'Plaque signalétique',
    filenameTag: 'PLAQUE-SIGNALETIQUE',
    group: 'chauffage',
    pinned: true,
  },

  // Électrique
  {
    id: 'tableau_electrique',
    label: 'Tableau électrique',
    filenameTag: 'TABLEAU-ELECTRIQUE',
    group: 'electrique',
  },
  { id: 'prise', label: 'Prise', filenameTag: 'PRISE', group: 'electrique' },
  { id: 'interrupteur', label: 'Interrupteur', filenameTag: 'INTERRUPTEUR', group: 'electrique' },

  // Autre
  { id: 'mur', label: 'Mur', filenameTag: 'MUR', group: 'autre' },
  { id: 'plafond', label: 'Plafond', filenameTag: 'PLAFOND', group: 'autre' },
  { id: 'sol', label: 'Sol', filenameTag: 'SOL', group: 'autre' },
  { id: 'isolation', label: 'Isolation', filenameTag: 'ISOLATION', group: 'autre' },
  { id: 'vmc', label: 'VMC', filenameTag: 'VMC', group: 'autre' },
  { id: 'hotte', label: 'Hotte / ventilation', filenameTag: 'HOTTE-VENTILATION', group: 'autre' },
]

export const GROUP_LABELS: Record<ViewType['group'], string> = {
  general: 'Général',
  ouvertures: 'Ouvertures',
  chauffage: 'Chauffage / ECS',
  electrique: 'Électricité',
  autre: 'Autre',
}

export function getViewType(id: string | null | undefined): ViewType | undefined {
  if (!id) return undefined
  return VIEW_TYPES.find((v) => v.id === id)
}

export function pinnedViewTypes(): ViewType[] {
  return VIEW_TYPES.filter((v) => v.pinned)
}

export function viewTypesByGroup(): Record<string, ViewType[]> {
  const grouped: Record<string, ViewType[]> = {}
  for (const v of VIEW_TYPES) {
    if (!grouped[v.group]) grouped[v.group] = []
    grouped[v.group]!.push(v)
  }
  return grouped
}
