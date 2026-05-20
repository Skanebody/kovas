/**
 * KOVAS — Document Intelligence : types backend canoniques.
 *
 * Distinction vs `types.ts` (UI stubs créés par l'agent UI) :
 *   - `backend-types.ts` (ce fichier) → types alignés sur la migration SQL
 *     `20260523140000_documents.sql` (colonnes documents.document_type,
 *     documents.source, documents.status) et utilisés par les routes API,
 *     les extracteurs et le confidence router.
 *   - `types.ts` → stubs UI avec slugs DocumentType différents
 *     (`dpe_anterior`, `boiler_plate`...). En V1.5, un adaptateur UI → backend
 *     fera la traduction (cf. issue tracker).
 *
 * Authority : CLAUDE.md §3 feature 6 (Document Intelligence V1.5).
 */

export type BackendDocumentType =
  | 'dpe'
  | 'audit_energetique'
  | 'amiante'
  | 'plomb'
  | 'plaque_chaudiere'
  | 'plaque_ecs'
  | 'plaque_climatisation'
  | 'facture_energie'
  | 'plan'
  | 'reglement_copro'
  | 'carnet_entretien'
  | 'acte_propriete'
  | 'permis_construire'
  | 'bordereau_mission'
  | 'unknown'

export type DocumentSource =
  | 'camera'
  | 'file_upload'
  | 'drag_drop'
  | 'email_import'
  | 'drive_import'

export type DocumentStatus =
  | 'captured'
  | 'classifying'
  | 'classified'
  | 'extracting'
  | 'extracted'
  | 'prefilled'
  | 'error'

/** Liste des document_types pour lesquels un extracteur V1 existe. */
export const V1_EXTRACTABLE_TYPES: ReadonlySet<BackendDocumentType> = new Set<BackendDocumentType>([
  'dpe',
  'plaque_chaudiere',
  'facture_energie',
  'plan',
])

/** Liste des document_types V1.5 — extracteurs renvoient 501 Not Implemented. */
export const V15_TYPES: ReadonlySet<BackendDocumentType> = new Set<BackendDocumentType>([
  'audit_energetique',
  'amiante',
  'plomb',
  'plaque_ecs',
  'plaque_climatisation',
  'reglement_copro',
  'carnet_entretien',
  'acte_propriete',
  'permis_construire',
  'bordereau_mission',
])

export const ALL_BACKEND_DOCUMENT_TYPES: readonly BackendDocumentType[] = [
  'dpe',
  'audit_energetique',
  'amiante',
  'plomb',
  'plaque_chaudiere',
  'plaque_ecs',
  'plaque_climatisation',
  'facture_energie',
  'plan',
  'reglement_copro',
  'carnet_entretien',
  'acte_propriete',
  'permis_construire',
  'bordereau_mission',
  'unknown',
] as const

/**
 * Map confidence_by_field : `{ "fieldPath": 0-100 }`.
 * Confiance en pourcentage entier (Claude raisonne mieux en %).
 */
export type ConfidenceMap = Record<string, number>

export function isBackendDocumentType(value: string): value is BackendDocumentType {
  return (ALL_BACKEND_DOCUMENT_TYPES as readonly string[]).includes(value)
}
