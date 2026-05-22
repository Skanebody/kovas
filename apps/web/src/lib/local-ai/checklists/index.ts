/**
 * Barrel export — checklists par diagnostic.
 *
 * Permet `import { getChecklist, getAllChecklists } from '@/lib/local-ai/checklists'`.
 */

import { AMIANTE_CHECKLIST } from './amiante'
import { BOUTIN_CHECKLIST } from './boutin'
import { CARREZ_CHECKLIST } from './carrez'
import { DPE_CHECKLIST } from './dpe'
import { ELECTRICITE_CHECKLIST } from './electricite'
import { ERP_CHECKLIST } from './erp'
import { GAZ_CHECKLIST } from './gaz'
import { PLOMB_CHECKLIST } from './plomb'
import { TERMITES_CHECKLIST } from './termites'
import type { DiagnosticChecklist, DiagnosticKind } from './types'

/** Registry complet des checklists métier. */
export const CHECKLISTS_REGISTRY: Readonly<Record<DiagnosticKind, DiagnosticChecklist>> = {
  dpe: DPE_CHECKLIST,
  amiante: AMIANTE_CHECKLIST,
  plomb: PLOMB_CHECKLIST,
  gaz: GAZ_CHECKLIST,
  electricite: ELECTRICITE_CHECKLIST,
  termites: TERMITES_CHECKLIST,
  carrez: CARREZ_CHECKLIST,
  boutin: BOUTIN_CHECKLIST,
  erp: ERP_CHECKLIST,
}

/** Récupère la checklist d'un diagnostic. */
export function getChecklist(kind: DiagnosticKind): DiagnosticChecklist {
  return CHECKLISTS_REGISTRY[kind]
}

/** Récupère les checklists pour un ensemble de diagnostics. */
export function getChecklists(kinds: readonly DiagnosticKind[]): DiagnosticChecklist[] {
  return kinds.map((k) => CHECKLISTS_REGISTRY[k])
}

/** Liste de toutes les checklists (9 diagnostics standards). */
export function getAllChecklists(): DiagnosticChecklist[] {
  return Object.values(CHECKLISTS_REGISTRY)
}

/** Résolution permissive d'un nom de diagnostic (alias, casse). */
export function resolveDiagnosticKind(input: string): DiagnosticKind | null {
  const normalized = input.toLowerCase().trim()
  switch (normalized) {
    case 'dpe':
      return 'dpe'
    case 'amiante':
    case 'asbestos':
      return 'amiante'
    case 'plomb':
    case 'crep':
      return 'plomb'
    case 'gaz':
    case 'gas':
      return 'gaz'
    case 'electricite':
    case 'électricité':
    case 'electricity':
    case 'elec':
      return 'electricite'
    case 'termites':
    case 'termite':
      return 'termites'
    case 'carrez':
    case 'loi_carrez':
      return 'carrez'
    case 'boutin':
    case 'loi_boutin':
      return 'boutin'
    case 'erp':
    case 'etat_risques':
      return 'erp'
    default:
      return null
  }
}

export type { ChecklistItem, ChecklistSection, ChecklistSeverity, ChecklistScope, DiagnosticChecklist, DiagnosticKind } from './types'
export { TRIGGER_DELAYS } from './types'
