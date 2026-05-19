/**
 * Types de la feature « Import Liciel ».
 *
 * Cadre légal : art. 20 RGPD (droit à la portabilité) — l'utilisateur
 * exporte lui-même depuis son compte Liciel et upload dans KOVAS.
 * Aucun scraping de l'interface Liciel (CLAUDE.md §13).
 *
 * State machine d'un job :
 *   uploaded → parsing → parsed → normalizing → normalized →
 *   deduping → deduped → committing → completed
 *   (failed / cancelled à tout moment)
 */

// ============================================================================
// JOB
// ============================================================================

export type ImportJobStatus =
  | 'uploaded'
  | 'parsing'
  | 'parsed'
  | 'normalizing'
  | 'normalized'
  | 'deduping'
  | 'deduped'
  | 'committing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type ImportSourceFormat = 'csv' | 'xlsx' | 'xml' | 'zip-pdfs'

export interface ImportJob {
  id: string
  organization_id: string
  created_by: string
  status: ImportJobStatus

  // Source
  source_filename: string
  source_filesize_bytes: number
  source_storage_path: string
  source_mime_type: string
  source_format: ImportSourceFormat | null

  // Métriques d'extraction
  detected_clients_count: number
  detected_properties_count: number
  detected_lots_count: number
  detected_coproprietes_count: number
  detected_diagnostics_count: number

  // Métriques de dédoublonnage
  duplicates_clients_count: number
  duplicates_properties_count: number
  duplicates_coproprietes_count: number

  // Métriques d'import final
  imported_clients_count: number
  imported_properties_count: number
  imported_lots_count: number
  imported_coproprietes_count: number

  // Erreurs
  error_message: string | null
  error_details: Record<string, unknown> | null
  processing_log: ProcessingLogEntry[]

  // Timestamps
  created_at: string
  parsing_started_at: string | null
  parsing_completed_at: string | null
  dedupe_completed_at: string | null
  committed_at: string | null
  expires_at: string
}

/**
 * Entrée du journal de traitement (append-only).
 * Permet d'afficher la progression côté UI + audit a posteriori.
 */
export interface ProcessingLogEntry {
  ts: string // ISO 8601
  step:
    | 'upload'
    | 'parse'
    | 'normalize_addresses'
    | 'normalize_sirets'
    | 'normalize_phones'
    | 'dedupe'
    | 'enrich'
    | 'commit'
  level: 'info' | 'warn' | 'error'
  message: string
  details?: Record<string, unknown>
}

// ============================================================================
// WIZARD STATE (côté UI)
// ============================================================================

export type WizardStep = 1 | 2 | 3 | 4 | 5

export const WIZARD_STEPS = [
  { id: 1, label: 'Préparer', short: 'Préparer' },
  { id: 2, label: 'Exporter depuis Liciel', short: 'Exporter' },
  { id: 3, label: 'Téléverser', short: 'Téléverser' },
  { id: 4, label: 'Analyser', short: 'Analyser' },
  { id: 5, label: 'Valider', short: 'Valider' },
] as const satisfies ReadonlyArray<{ id: WizardStep; label: string; short: string }>

// ============================================================================
// STAGING ENTITIES (avant validation user)
// ============================================================================

export interface StagingClient {
  id: string
  job_id: string
  organization_id: string
  raw_data: Record<string, unknown>

  // Normalisé (aligné sur schéma `clients` prod)
  type: 'particulier' | 'agence' | 'notaire' | 'syndic' | 'entreprise' | 'collectivite' | null
  display_name: string | null
  first_name: string | null
  last_name: string | null
  company_name: string | null
  siret: string | null
  email: string | null
  phone: string | null
  phone_mobile: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  country: string
  apartment_detail: string | null
  building_letter: string | null
  floor_number: number | null
  address_complement: string | null
  notes: string | null

  // Enrichissement
  insee_data: Record<string, unknown> | null
  geocoded_lat: number | null
  geocoded_lng: number | null
  ban_id: string | null

  status: StagingStatus
  merged_into_client_id: string | null

  normalization_warnings: NormalizationWarning[]
  confidence_score: number | null

  created_at: string
}

export interface StagingProperty {
  id: string
  job_id: string
  organization_id: string
  raw_data: Record<string, unknown>

  property_type:
    | 'maison'
    | 'appartement'
    | 'immeuble'
    | 'local_commercial'
    | 'bureau'
    | 'autre'
    | null
  address: string | null
  postal_code: string | null
  city: string | null
  insee_code: string | null
  country: string
  apartment_detail: string | null
  building_letter: string | null
  floor_number: number | null
  lot_number: string | null

  surface_total: number | null
  surface_carrez: number | null
  surface_boutin: number | null
  rooms_count: number | null
  floors_count: number | null
  year_built: number | null

  staging_copropriete_id: string | null
  staging_owner_client_id: string | null

  geocoded_lat: number | null
  geocoded_lng: number | null
  ban_id: string | null
  cadastre_section: string | null
  cadastre_numero: string | null

  bdnb_data: Record<string, unknown> | null
  street_view_url: string | null

  status: StagingStatus
  merged_into_property_id: string | null

  normalization_warnings: NormalizationWarning[]
  confidence_score: number | null

  created_at: string
}

export interface StagingCopropriete {
  id: string
  job_id: string
  organization_id: string
  raw_data: Record<string, unknown>

  name: string | null
  rnic_number: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  insee_code: string | null
  year_built: number | null
  lots_count: number | null

  staging_syndic_id: string | null

  geocoded_lat: number | null
  geocoded_lng: number | null
  ban_id: string | null

  status: StagingStatus
  merged_into_copropriete_id: string | null

  normalization_warnings: NormalizationWarning[]
  confidence_score: number | null

  created_at: string
}

export interface StagingLot {
  id: string
  job_id: string
  organization_id: string
  raw_data: Record<string, unknown>

  lot_number: string | null
  building_letter: string | null
  floor_number: number | null
  door_number: string | null
  description: string | null
  tantiemes_generaux: number | null

  staging_copropriete_id: string | null
  staging_property_id: string | null

  status: Exclude<StagingStatus, 'merged'>
  merged_into_lot_id: string | null

  created_at: string
}

export type StagingStatus = 'pending' | 'imported' | 'merged' | 'skipped'

// ============================================================================
// DÉDOUBLONNAGE
// ============================================================================

export type DedupeEntityType = 'client' | 'property' | 'copropriete'
export type DedupeResolution = 'merge' | 'keep_separate' | 'replace' | 'skip'

export interface DedupeMatch {
  id: string
  job_id: string
  organization_id: string
  entity_type: DedupeEntityType
  staging_entity_id: string
  existing_entity_id: string
  confidence_score: number
  match_reasons: MatchReason[]

  resolution: DedupeResolution | null
  field_choices: FieldChoiceMap | null
  resolved_by: string | null
  resolved_at: string | null

  created_at: string
}

/**
 * Raison du match — sérialisé en string pour faciliter le storage JSON.
 * Format : `<facteur>[:<score>]`
 *   ex : "email_exact", "phone_normalized", "name_lev:0.95", "geo:30m"
 */
export type MatchReason = string

/**
 * Lors d'une fusion, choix par champ entre la valeur existante et la nouvelle.
 *   - "existing" → garder la valeur prod actuelle
 *   - "new"      → écraser avec la valeur du staging
 *   - { edited: "X" } → valeur saisie manuellement par l'utilisateur
 */
export type FieldChoice = 'existing' | 'new' | { edited: string }
export type FieldChoiceMap = Record<string, FieldChoice>

// ============================================================================
// QUALITÉ / WARNINGS
// ============================================================================

/**
 * Warning de normalisation : champ + raison + valeur observée.
 * Affiché dans l'UI de validation pour expliquer pourquoi un staging
 * a une confidence < 1.
 */
export interface NormalizationWarning {
  field: string
  code:
    | 'siret_invalid'
    | 'siret_closed'
    | 'phone_unparseable'
    | 'phone_not_fr'
    | 'email_invalid'
    | 'email_typo'
    | 'address_unmatched'
    | 'address_low_score'
    | 'rnic_invalid'
    | 'unknown_value'
  message: string
  raw_value?: string
  suggested_value?: string
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface UploadResponse {
  job_id: string
  filename: string
  filesize: number
  format: ImportSourceFormat | null
}

export interface JobStatusResponse {
  job: Pick<
    ImportJob,
    | 'id'
    | 'status'
    | 'source_filename'
    | 'source_format'
    | 'detected_clients_count'
    | 'detected_properties_count'
    | 'detected_lots_count'
    | 'detected_coproprietes_count'
    | 'duplicates_clients_count'
    | 'duplicates_properties_count'
    | 'duplicates_coproprietes_count'
    | 'error_message'
    | 'created_at'
    | 'committed_at'
  >
  /**
   * Étape courante normalisée pour l'UI de progression (sous-étapes du
   * polling, plus fines que `status`).
   */
  current_substep:
    | 'reading_file'
    | 'extracting_entities'
    | 'normalizing_addresses'
    | 'verifying_sirets'
    | 'detecting_duplicates'
    | 'enriching'
    | 'preparing_validation'
    | null
  progress_percent: number | null
}

export interface DedupeReviewResponse {
  matches_by_entity: {
    client: DedupeMatch[]
    property: DedupeMatch[]
    copropriete: DedupeMatch[]
  }
  new_entities_count: {
    client: number
    property: number
    copropriete: number
    lot: number
  }
}

export interface CommitResponse {
  job_id: string
  imported: {
    clients: number
    properties: number
    coproprietes: number
    lots: number
  }
  skipped: {
    clients: number
    properties: number
    coproprietes: number
  }
  merged: {
    clients: number
    properties: number
    coproprietes: number
  }
}

// ============================================================================
// SCHÉMA LICIEL (sera complété au fur et à mesure des observations terrain)
// ============================================================================

/**
 * Schéma intermédiaire — sortie du parser Liciel, entrée du normalizer.
 * Représente l'état brut juste après extraction (encore non normalisé,
 * pas encore en BDD).
 *
 * Note : les champs `liciel_*` correspondent aux noms Liciel d'origine
 * (à compléter quand on aura les vrais exports). Les autres champs sont
 * pré-mappés sur le schéma KOVAS.
 */
export interface LicielParsedClient {
  liciel_id?: string
  type?: string
  nom?: string
  prenom?: string
  raison_sociale?: string
  siret?: string
  email?: string
  telephone?: string
  telephone_mobile?: string
  adresse_ligne1?: string
  adresse_ligne2?: string
  code_postal?: string
  ville?: string
  notes?: string
}

export interface LicielParsedProperty {
  liciel_id?: string
  type_bien?: string
  adresse_ligne1?: string
  adresse_ligne2?: string
  code_postal?: string
  ville?: string
  surface_loi_carrez?: number
  surface_habitable?: number
  surface_utile?: number
  nombre_pieces?: number
  nombre_niveaux?: number
  annee_construction?: number
  liciel_client_proprietaire_id?: string
  liciel_copropriete_id?: string
  liciel_lot_id?: string
}

export interface LicielParsedCopropriete {
  liciel_id?: string
  nom_copro?: string
  numero_immatriculation?: string
  adresse_ligne1?: string
  code_postal?: string
  ville?: string
  nombre_lots?: number
  annee_construction?: number
  liciel_syndic_id?: string
}

export interface LicielParsedLot {
  liciel_id?: string
  numero_lot?: string
  etage?: string
  numero_porte?: string
  description?: string
  liciel_copropriete_id?: string
  liciel_property_id?: string
}

export interface LicielParsedDiagnostic {
  liciel_id?: string
  type_diagnostic?: string
  date_diagnostic?: string
  liciel_property_id?: string
}

export interface LicielParsedExport {
  clients: LicielParsedClient[]
  properties: LicielParsedProperty[]
  coproprietes: LicielParsedCopropriete[]
  lots: LicielParsedLot[]
  diagnostics: LicielParsedDiagnostic[]
}

// ============================================================================
// ERREURS TYPÉES
// ============================================================================

export type ImportErrorCode =
  | 'FORMAT_UNSUPPORTED'
  | 'FORMAT_DETECTION_FAILED'
  | 'FILE_TOO_LARGE'
  | 'FILE_EMPTY'
  | 'FILE_CORRUPTED'
  | 'CLAUDE_EXTRACTION_FAILED'
  | 'BAN_API_DOWN'
  | 'INSEE_API_DOWN'
  | 'DEDUPE_FAILED'
  | 'COMMIT_FAILED'
  | 'UNAUTHORIZED'
  | 'JOB_NOT_FOUND'
  | 'JOB_EXPIRED'
  | 'UNRESOLVED_DUPLICATES'

export class ImportError extends Error {
  constructor(
    public code: ImportErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ImportError'
  }
}

// ============================================================================
// LIMITES & CONFIGURATION
// ============================================================================

export const IMPORT_LIMITS = {
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024, // 100 Mo
  MAX_FILE_SIZE_MB: 100,
  JOB_TTL_DAYS: 7,
  POLLING_INTERVAL_MS: 2000,
  DEDUPE_THRESHOLD_AUTO: 0.95, // ≥ ce score → fusion suggérée par défaut
  DEDUPE_THRESHOLD_PROBABLE: 0.8, // confirmation user requise
  DEDUPE_THRESHOLD_MIN: 0.6, // sous ce score → pas considéré comme doublon
} as const

export const ACCEPTED_MIME_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/xml',
  'text/xml',
  'application/zip',
  'application/x-zip-compressed',
] as const

export const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.xml', '.zip'] as const
