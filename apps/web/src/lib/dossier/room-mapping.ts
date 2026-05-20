/**
 * KOVAS — Mapping pièce → champs réglementaires requis (refonte page dossier).
 *
 * Authority : CLAUDE.md §3 (8 diagnostics MVP V1.5) + diagnostic-schemas.ts.
 *
 * IMPORTANT — TODO VALIDATION REGLEMENTAIRE :
 *   Les associations pièce → champs sont des HYPOTHÈSES métier basées sur le bon sens
 *   du diagnostic immobilier français. Elles doivent être validées par l'advisor
 *   diagnostiqueur (CLAUDE.md §18) AVANT toute exploitation en production.
 *
 *   Exemples à valider :
 *     - cuisine : faut-il y collecter la chaudière (souvent en cellier) ?
 *     - combles : isolation OBLIGATOIRE même si non aménagés ?
 *     - WC séparé : ventilation requise ou pas ?
 *
 *   Les `field_path` ci-dessous suivent EXACTEMENT le schéma des diagnostics
 *   (cf. lib/mission/diagnostic-schemas.ts) pour qu'on puisse croiser visited rooms
 *   ↔ dossier_field_values sans transformation.
 */

import type { DiagnosticStatus, SuggestedRoom } from '@/lib/dossier/types'
import type { DiagnosticType } from '@/lib/mission/types'

// ============================================
// 1. Types de pièces (norme métier diagnostic FR)
// ============================================
// Couvre les 14 types les plus courants. Les `custom` (non listés) n'auront pas de
// requirements et ne seront JAMAIS suggérés comme manquants.
export const ROOM_TYPES = [
  'sejour',
  'cuisine',
  'salle_de_bain',
  'chambre',
  'garage',
  'combles',
  'cellier',
  'cave',
  'wc',
  'entree',
  'bureau',
  'lingerie',
  'palier',
  'autres',
] as const

export type RoomType = (typeof ROOM_TYPES)[number]

// ============================================
// 2. Mapping room_type → exigences réglementaires
// ============================================
// TODO VALIDATION REGLEMENTAIRE — advisor diagnostiqueur (CLAUDE.md §18)
//
// Format de chaque entrée :
//   {
//     iconName        : nom Lucide à résoudre via room-icon-resolver.ts
//     suggestedReason : phrase FR sobre expliquant pourquoi cette pièce devrait être visitée
//     requiredFor     : { DiagnosticType: field_path[] } — champs typiquement collectés dans cette pièce
//   }
//
// `requiredFor` reste vide {} pour les pièces où la collecte est libre (cellier, palier, ...).
export interface RoomRequirementEntry {
  iconName: string
  suggestedReason: string
  requiredFor: Partial<Record<DiagnosticType, string[]>>
}

export const ROOM_FIELD_REQUIREMENTS: Record<RoomType, RoomRequirementEntry> = {
  // TODO VALIDATION REGLEMENTAIRE
  sejour: {
    iconName: 'Sofa',
    suggestedReason: 'Pièce principale — collecte menuiseries, chauffage, ventilation.',
    requiredFor: {
      DPE: ['enveloppe.menuiseries.type_vitrage', 'systemes.chauffage.type_emetteur'],
      ELEC: ['installation.prises_courantes.nombre_par_piece'],
      PLOMB: ['logement.pieces_revetement.peinture_etat'],
    },
  },
  // TODO VALIDATION REGLEMENTAIRE
  cuisine: {
    iconName: 'UtensilsCrossed',
    suggestedReason: 'Présence eau + gaz + élec — plomb (peintures), gaz (cuisinière), élec (PE).',
    requiredFor: {
      DPE: ['systemes.eau_chaude.type_production'],
      GAZ: ['installation.appareils.cuisiniere_presente', 'installation.tuyauteries.materiau'],
      ELEC: ['installation.prises_courantes.protection_differentielle'],
      PLOMB: ['logement.pieces_revetement.peinture_etat'],
    },
  },
  // TODO VALIDATION REGLEMENTAIRE
  salle_de_bain: {
    iconName: 'Bath',
    suggestedReason: 'Pièce humide — VMC, plomberie, sécurité électrique (volume 1/2/3).',
    requiredFor: {
      DPE: ['systemes.ventilation.type'],
      ELEC: ['installation.salles_eau.protection_30ma', 'installation.salles_eau.respect_volumes'],
      PLOMB: ['logement.pieces_revetement.peinture_etat'],
    },
  },
  // TODO VALIDATION REGLEMENTAIRE
  chambre: {
    iconName: 'Bed',
    suggestedReason: 'Menuiseries + isolation + état revêtements (plomb si construction < 1949).',
    requiredFor: {
      DPE: ['enveloppe.menuiseries.type_vitrage'],
      PLOMB: ['logement.pieces_revetement.peinture_etat'],
    },
  },
  // TODO VALIDATION REGLEMENTAIRE
  garage: {
    iconName: 'Car',
    suggestedReason:
      'Tableau électrique souvent ici — amiante (dalles), termites (charpente bois).',
    requiredFor: {
      ELEC: ['installation.tableau.position', 'installation.tableau.disjoncteur_general'],
      AMIANTE: ['reperage.materiaux.dalles_sol'],
      TERMITES: ['ouvrages.bois_observables.etat'],
    },
  },
  // TODO VALIDATION REGLEMENTAIRE
  combles: {
    iconName: 'Home',
    suggestedReason:
      'Isolation toiture (DPE) + charpente bois (termites) + matériaux anciens (amiante).',
    requiredFor: {
      DPE: [
        'enveloppe.isolation_combles.presente',
        'enveloppe.isolation_combles.epaisseur_cm',
        'enveloppe.isolation_combles.type',
      ],
      AMIANTE: ['reperage.materiaux.flocage_calorifugeage'],
      TERMITES: ['ouvrages.charpente.etat'],
    },
  },
  // TODO VALIDATION REGLEMENTAIRE
  cellier: {
    iconName: 'Box',
    suggestedReason: 'Souvent emplacement chaudière + ballon ECS.',
    requiredFor: {
      DPE: ['systemes.chauffage.type_generateur', 'systemes.eau_chaude.type_production'],
      GAZ: ['installation.appareils.chaudiere_presente'],
    },
  },
  // TODO VALIDATION REGLEMENTAIRE
  cave: {
    iconName: 'Archive',
    suggestedReason:
      'Humidité + matériaux anciens — amiante / termites / état isolation plancher bas.',
    requiredFor: {
      DPE: ['enveloppe.isolation_plancher_bas.presente'],
      AMIANTE: ['reperage.materiaux.flocage_calorifugeage'],
      TERMITES: ['ouvrages.bois_observables.etat'],
    },
  },
  // TODO VALIDATION REGLEMENTAIRE
  wc: {
    iconName: 'DoorClosed',
    suggestedReason: 'Ventilation requise + état revêtements (plomb < 1949).',
    requiredFor: {
      DPE: ['systemes.ventilation.type'],
      PLOMB: ['logement.pieces_revetement.peinture_etat'],
    },
  },
  // TODO VALIDATION REGLEMENTAIRE
  entree: {
    iconName: 'DoorOpen',
    suggestedReason: "Porte d'entrée (DPE) + tableau électrique parfois ici.",
    requiredFor: {
      DPE: ['enveloppe.menuiseries.porte_entree_isolante'],
    },
  },
  // TODO VALIDATION REGLEMENTAIRE
  bureau: {
    iconName: 'Briefcase',
    suggestedReason: 'Menuiseries + revêtements + circuits dédiés (prises informatiques).',
    requiredFor: {
      DPE: ['enveloppe.menuiseries.type_vitrage'],
    },
  },
  // TODO VALIDATION REGLEMENTAIRE
  lingerie: {
    iconName: 'Shirt',
    suggestedReason: 'Eau + élec — circuits machines + ventilation.',
    requiredFor: {
      ELEC: ['installation.prises_courantes.protection_differentielle'],
    },
  },
  // TODO VALIDATION REGLEMENTAIRE
  palier: {
    iconName: 'StepForward',
    suggestedReason: 'Circulation — éclairage + détecteurs fumée.',
    requiredFor: {},
  },
  // TODO VALIDATION REGLEMENTAIRE
  autres: {
    iconName: 'Square',
    suggestedReason: "Pièce non standard — saisie libre selon ce qui s'y trouve.",
    requiredFor: {},
  },
}

// ============================================
// 3. Détection des pièces suggérées (non visitées mais probables)
// ============================================

export interface DossierLite {
  property_rooms: PropertyRoomEntry[] | null
}

export interface PropertyRoomEntry {
  id: string
  name: string
  type: string | null
  floor?: number | null
}

/**
 * Métadonnée additionnelle attachée à un SuggestedRoom (utile pour UI riche).
 * Le type SuggestedRoom canonique vit dans `@/lib/dossier/types`. Cette interface
 * étend ses infos publiques en fournissant l'icône Lucide à rendre.
 */
export interface SuggestedRoomWithIcon extends SuggestedRoom {
  iconName: string
}

/**
 * Normalise un room_type libre (string) en RoomType connu.
 * Les types non reconnus retournent null (= jamais suggéré).
 */
function normalizeRoomType(value: string | null | undefined): RoomType | null {
  if (!value) return null
  const lower = value.toLowerCase().trim()
  return (ROOM_TYPES as readonly string[]).includes(lower) ? (lower as RoomType) : null
}

/**
 * Détecte les pièces qui devraient être visitées pour les diagnostics actifs
 * mais qui ne le sont pas encore (PropertyRoom existe ↔ aucune DossierRoom liée).
 *
 * @param dossier            - le dossier (avec property_rooms snapshot)
 * @param visitedRoomTypes   - set des room_types DÉJÀ visités (depuis dossier_rooms)
 * @param activeDiagnostics  - diagnostics actifs sur le dossier (issus des missions)
 * @returns la liste des pièces suggérées avec leurs statuts par diagnostic
 */
export function detectSuggestedRooms(
  dossier: DossierLite,
  visitedRoomTypes: Set<string>,
  activeDiagnostics: DiagnosticType[],
): SuggestedRoomWithIcon[] {
  if (!dossier.property_rooms || dossier.property_rooms.length === 0) {
    return []
  }

  const suggestions: SuggestedRoomWithIcon[] = []
  for (const room of dossier.property_rooms) {
    const normalizedType = normalizeRoomType(room.type)
    if (!normalizedType) continue
    // Si la pièce est déjà visitée (par son type), on n'en suggère pas une autre.
    if (visitedRoomTypes.has(normalizedType)) continue

    const entry = ROOM_FIELD_REQUIREMENTS[normalizedType]
    // Pièce sans exigences → jamais suggérée.
    const relevantDiags = activeDiagnostics.filter((d) => (entry.requiredFor[d]?.length ?? 0) > 0)
    if (relevantDiags.length === 0) continue

    const diagnosticStatuses: DiagnosticStatus[] = relevantDiags.map((d) => ({
      diagnostic: d,
      hasIssue: true,
      issueLabel: `Aucune donnée collectée — ${(entry.requiredFor[d] ?? []).length} champ(s) attendu(s)`,
    }))

    suggestions.push({
      id: room.id,
      name: room.name,
      type: normalizedType,
      status: 'not-visited',
      suggestedReason: entry.suggestedReason,
      diagnosticStatuses,
      iconName: entry.iconName,
    })
  }

  return suggestions
}

// ============================================
// 4. Helper : récupère field_path requis pour un (room_type, diagnostic)
// ============================================
export function getRequiredFieldPaths(
  roomType: string | null,
  diagnostic: DiagnosticType,
): string[] {
  const normalized = normalizeRoomType(roomType)
  if (!normalized) return []
  return ROOM_FIELD_REQUIREMENTS[normalized].requiredFor[diagnostic] ?? []
}
