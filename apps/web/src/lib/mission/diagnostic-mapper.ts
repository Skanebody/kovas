/**
 * KOVAS — Mapping mission_type (enum BDD) ↔ DiagnosticType (Capture-First).
 *
 * Le schéma BDD utilise un enum verbeux ('dpe_vente', 'amiante_vente', ...) pour
 * séparer les variantes commerciales d'un même diagnostic. Le mode Capture-First
 * ne raisonne qu'au niveau du diagnostic logique (DPE, AMIANTE, ...) pour piloter
 * la Vision IA + la consolidation `dossier_field_values`.
 *
 * Authority : CLAUDE.md §3 (8 diagnostics MVP V1.5) + migration init_schema (mission_type).
 */

import type { DiagnosticType } from './types'

/**
 * Mapping figé pour les 11 valeurs de l'enum `mission_type` BDD.
 * Toute nouvelle valeur d'enum devra être ajoutée ici sous peine de typecheck warning.
 */
const MISSION_TYPE_TO_DIAGNOSTIC: Record<string, DiagnosticType> = {
  dpe_vente: 'DPE',
  dpe_location: 'DPE',
  copropriete: 'DPE',
  amiante_vente: 'AMIANTE',
  amiante_avant_travaux: 'AMIANTE',
  plomb_crep: 'PLOMB',
  gaz: 'GAZ',
  electricite: 'ELEC',
  termites: 'TERMITES',
  carrez_boutin: 'CARREZ',
  erp: 'ERP',
}

/**
 * Convertit un `mission_type` BDD en DiagnosticType. Retourne null si la valeur est
 * inconnue (mission supprimée du périmètre, ou nouvelle valeur d'enum non synchronisée).
 */
export function missionTypeToDiagnostic(missionType: string): DiagnosticType | null {
  return MISSION_TYPE_TO_DIAGNOSTIC[missionType] ?? null
}

/**
 * Convertit une liste de `mission_type` BDD en set de DiagnosticType uniques actifs
 * pour un dossier. Les types inconnus sont silencieusement ignorés.
 */
export function missionTypesToActiveDiagnostics(missionTypes: string[]): DiagnosticType[] {
  const set = new Set<DiagnosticType>()
  for (const mt of missionTypes) {
    const diag = missionTypeToDiagnostic(mt)
    if (diag) set.add(diag)
  }
  return Array.from(set)
}
