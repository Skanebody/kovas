/**
 * KOVAS — Checklist "Avant de partir" du diagnostiqueur.
 *
 * Génère une liste d'items à vérifier (photos critiques + champs manquants
 * + mesures + documents) avant de quitter le site, calée sur la liste des
 * diagnostics actifs du dossier.
 *
 * V1 : heuristiques locales (pas d'IA). On reçoit les diagnostics actifs et
 * la liste des champs déjà remplis pour ne signaler que ce qui manque.
 */

import type { DiagnosticType } from '@/lib/mission/types'

export type ChecklistImportance = 'critical' | 'important' | 'nice_to_have'

export type ChecklistCategory = 'photo' | 'measurement' | 'info' | 'document'

export interface ChecklistItem {
  id: string
  category: ChecklistCategory
  importance: ChecklistImportance
  label: string
  /** Diagnostic source. Utile pour grouper en UI ou filtrer. */
  diagnosticType: DiagnosticType
  /** Si vrai → l'item est déjà coché à l'ouverture (champ déjà rempli). */
  prefilled: boolean
}

export interface ChecklistInput {
  /** Diagnostics actifs sur le dossier. */
  activeDiagnostics: readonly DiagnosticType[]
  /** Champs déjà remplis (paths Drizzle/JSON path) — utilisé pour pré-cocher. */
  filledFieldPaths?: readonly string[]
  /** Photos déjà prises avec leur primary_subject (issu Vision IA ou manuel). */
  photoSubjects?: readonly string[]
}

// ============================================
// Définitions par diagnostic
// ============================================

interface ItemSpec {
  category: ChecklistCategory
  importance: ChecklistImportance
  label: string
  /** Champs canoniques attendus dans dossier_field_values (pour pré-cocher). */
  matchFieldPaths?: readonly string[]
  /** Sujets photo attendus (matching photo_subjects). */
  matchPhotoSubjects?: readonly string[]
}

const ITEMS_BY_DIAG: Record<DiagnosticType, readonly ItemSpec[]> = {
  DPE: [
    {
      category: 'photo',
      importance: 'critical',
      label: 'Photo compteur électrique (Linky ou ancien)',
      matchPhotoSubjects: ['compteur_elec', 'compteur', 'tableau_elec'],
    },
    {
      category: 'photo',
      importance: 'critical',
      label: 'Photo plaque signalétique chaudière',
      matchPhotoSubjects: ['chaudiere', 'plaque_chaudiere'],
    },
    {
      category: 'photo',
      importance: 'critical',
      label: 'Photo étiquette ECS (ballon eau chaude)',
      matchPhotoSubjects: ['ecs', 'ballon', 'chauffe_eau'],
    },
    {
      category: 'photo',
      importance: 'important',
      label: 'Photo fenêtres (types et menuiseries)',
      matchPhotoSubjects: ['fenetres', 'menuiseries'],
    },
    {
      category: 'photo',
      importance: 'important',
      label: 'Photo VMC (bouches + caisson si accessible)',
      matchPhotoSubjects: ['vmc', 'ventilation'],
    },
    {
      category: 'measurement',
      importance: 'critical',
      label: 'Surface habitable totale',
      matchFieldPaths: ['enveloppe.surface_habitable', 'surface_habitable'],
    },
    {
      category: 'info',
      importance: 'important',
      label: "Type d'isolation des combles",
      matchFieldPaths: ['enveloppe.isolation_combles.type', 'isolation_combles'],
    },
    {
      category: 'document',
      importance: 'nice_to_have',
      label: 'Facture chaudière ou contrat entretien',
    },
  ],
  AMIANTE: [
    {
      category: 'photo',
      importance: 'critical',
      label: 'Photos de chaque pièce (vue globale)',
      matchPhotoSubjects: ['piece', 'piece_generale', 'pieces_generale'],
    },
    {
      category: 'photo',
      importance: 'critical',
      label: 'Photos conduits, gaines techniques, plinthes anciennes',
      matchPhotoSubjects: ['conduit', 'gaine'],
    },
    {
      category: 'photo',
      importance: 'important',
      label: 'Photos dalles de sol vinyl (si avant 1997)',
      matchPhotoSubjects: ['dalle', 'sol_vinyl'],
    },
    {
      category: 'info',
      importance: 'critical',
      label: 'Année exacte du permis de construire',
      matchFieldPaths: ['property.construction_year'],
    },
  ],
  PLOMB: [
    {
      category: 'measurement',
      importance: 'critical',
      label: "Mesures plomb à l'analyseur (toutes pièces)",
      matchFieldPaths: ['plomb.mesures'],
    },
    {
      category: 'photo',
      importance: 'important',
      label: 'Photos peintures écaillées ou douteuses',
      matchPhotoSubjects: ['peinture', 'plomb_zone'],
    },
  ],
  GAZ: [
    {
      category: 'photo',
      importance: 'critical',
      label: 'Photo plaque signalétique chaudière gaz',
      matchPhotoSubjects: ['chaudiere', 'plaque_chaudiere'],
    },
    {
      category: 'photo',
      importance: 'critical',
      label: "Photo robinet gaz d'alimentation général",
      matchPhotoSubjects: ['robinet_gaz', 'compteur_gaz'],
    },
    {
      category: 'info',
      importance: 'important',
      label: 'Vérification ventilation pièce chaudière',
      matchFieldPaths: ['gaz.ventilation'],
    },
  ],
  ELEC: [
    {
      category: 'photo',
      importance: 'critical',
      label: 'Photo tableau électrique ouvert (tous disjoncteurs visibles)',
      matchPhotoSubjects: ['tableau_elec'],
    },
    {
      category: 'info',
      importance: 'critical',
      label: 'Test différentiel 30 mA',
      matchFieldPaths: ['elec.test_differentiel'],
    },
    {
      category: 'photo',
      importance: 'important',
      label: 'Photos prises de terre (barrette ou jonction)',
      matchPhotoSubjects: ['terre', 'prise_terre'],
    },
  ],
  TERMITES: [
    {
      category: 'photo',
      importance: 'critical',
      label: 'Photos zones sensibles (charpente, plinthes, cave)',
      matchPhotoSubjects: ['charpente', 'cave', 'termites_zone'],
    },
    {
      category: 'info',
      importance: 'important',
      label: 'Présence de bois en contact direct avec le sol ?',
      matchFieldPaths: ['termites.bois_contact_sol'],
    },
  ],
  CARREZ: [
    {
      category: 'measurement',
      importance: 'critical',
      label: 'Mesures de chaque pièce (Carrez/Boutin)',
      matchFieldPaths: ['carrez.mesures', 'boutin.mesures'],
    },
    {
      category: 'photo',
      importance: 'nice_to_have',
      label: "Photos d'ensemble de chaque pièce mesurée",
      matchPhotoSubjects: ['piece', 'piece_generale'],
    },
  ],
  ERP: [
    {
      category: 'document',
      importance: 'critical',
      label: 'Export Géorisques téléchargé pour la commune',
      matchFieldPaths: ['erp.georisques_pdf'],
    },
  ],
}

// ============================================
// Generator
// ============================================

function isFilled(
  spec: ItemSpec,
  filledFieldPaths: readonly string[],
  photoSubjects: readonly string[],
): boolean {
  if (spec.matchFieldPaths) {
    for (const p of spec.matchFieldPaths) {
      if (filledFieldPaths.includes(p)) return true
    }
  }
  if (spec.matchPhotoSubjects) {
    for (const s of spec.matchPhotoSubjects) {
      if (photoSubjects.includes(s)) return true
    }
  }
  return false
}

const IMPORTANCE_ORDER: Record<ChecklistImportance, number> = {
  critical: 0,
  important: 1,
  nice_to_have: 2,
}

export function generateChecklist(input: ChecklistInput): ChecklistItem[] {
  const filled = input.filledFieldPaths ?? []
  const subjects = input.photoSubjects ?? []
  const items: ChecklistItem[] = []

  for (const diag of input.activeDiagnostics) {
    const specs = ITEMS_BY_DIAG[diag]
    if (!specs) continue
    for (const [i, spec] of specs.entries()) {
      items.push({
        id: `${diag}-${i}`,
        category: spec.category,
        importance: spec.importance,
        label: spec.label,
        diagnosticType: diag,
        prefilled: isFilled(spec, filled, subjects),
      })
    }
  }

  // Tri : critical d'abord, puis important, puis nice. Conserve ordre dans diag.
  return items.sort((a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance])
}

/** Compte les items critiques non cochés (utilisé par le bouton "Terminer"). */
export function countCriticalUnchecked(
  items: ChecklistItem[],
  checkedIds: ReadonlySet<string>,
): number {
  return items.filter((i) => i.importance === 'critical' && !i.prefilled && !checkedIds.has(i.id))
    .length
}
