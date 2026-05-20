/**
 * KOVAS — Classifieur de champs critiques en 4 buckets (refonte page dossier).
 *
 * Authority : CLAUDE.md §3 (consolidation IA) + spec refonte UI dossier.
 *
 * Les 4 buckets exposés au diagnostiqueur sur la page dossier :
 *  - toVerify   : faible confidence (< 0.7) ou champ en conflit (has_conflict)
 *  - edited     : champ édité manuellement (manually_edited_at != null)
 *  - validated  : validé par user OU confidence >= 0.85
 *  - missing    : champ requis non encore collecté
 *
 * Note : les buckets sont NON exclusifs sur le papier (un champ edited peut être
 * également validé). Pour préserver une UX claire, on applique la priorité :
 *   missing > toVerify > edited > validated.
 */

import type { MissingField } from '@/lib/dossier/missing-fields-detector'
import type { DiagnosticType, DossierFieldValue } from '@/lib/mission/types'

export interface CriticalFieldsBuckets {
  toVerify: DossierFieldValue[]
  edited: DossierFieldValue[]
  validated: DossierFieldValue[]
  missing: MissingField[]
}

const CONFIDENCE_VALIDATED_THRESHOLD = 0.85
const CONFIDENCE_TO_VERIFY_THRESHOLD = 0.7

/**
 * Classe les champs collectés et manquants dans 4 buckets exclusifs.
 *
 * @param fields  - tous les `dossier_field_values` consolidés du dossier
 * @param missing - les champs requis manquants (issus de detectMissingFields)
 * @param filter  - optionnel : restreint aux champs d'un diagnostic particulier
 * @returns un objet contenant les 4 buckets exclusifs
 */
export function classifyCriticalFields(
  fields: DossierFieldValue[],
  missing: MissingField[],
  filter?: DiagnosticType,
): CriticalFieldsBuckets {
  const filteredFields = filter ? fields.filter((f) => f.diagnosticType === filter) : fields
  const filteredMissing = filter ? missing.filter((m) => m.diagnostic === filter) : missing

  const toVerify: DossierFieldValue[] = []
  const edited: DossierFieldValue[] = []
  const validated: DossierFieldValue[] = []

  for (const field of filteredFields) {
    // Priorité 1 : à vérifier (low confidence OU conflit non résolu)
    const lowConfidence =
      field.confidence !== null && field.confidence < CONFIDENCE_TO_VERIFY_THRESHOLD
    const unresolvedConflict = field.hasConflict && !field.conflictResolution
    if (lowConfidence || unresolvedConflict) {
      toVerify.push(field)
      continue
    }
    // Priorité 2 : édité manuellement (signal explicite user intervention)
    if (field.manuallyEditedAt) {
      edited.push(field)
      continue
    }
    // Priorité 3 : validé (par user OU confidence haute auto)
    const highConfidence =
      field.confidence !== null && field.confidence >= CONFIDENCE_VALIDATED_THRESHOLD
    if (field.validatedByUser || highConfidence) {
      validated.push(field)
      continue
    }
    // Sinon : le champ est dans une zone grise (collecté mais ni validé ni suspect)
    // → on le range dans toVerify par sécurité (UX : "à examiner").
    toVerify.push(field)
  }

  return {
    toVerify,
    edited,
    validated,
    missing: filteredMissing,
  }
}
