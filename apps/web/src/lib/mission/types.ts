/**
 * KOVAS — Types du mode terrain "Capture-First" (V1.5 iteration 1).
 *
 * Authority : CLAUDE.md §3 features 1-2-10 + migration `20260520180000_capture_first_mode.sql`.
 *
 * Convention :
 * - Tous les types sont en anglais (variables/exports), commentaires métier en français.
 * - Aucun `any` (CLAUDE.md §10 — TypeScript strict).
 * - Les types `Extended` rajoutent les colonnes IA sans dupliquer ce qui existe déjà.
 */

// ============================================
// 1. Diagnostics — 8 types couverts MVP V1.5
// ============================================

export const DIAGNOSTIC_TYPES = [
  'DPE',
  'AMIANTE',
  'PLOMB',
  'GAZ',
  'ELEC',
  'TERMITES',
  'CARREZ',
  'ERP',
] as const

export type DiagnosticType = (typeof DIAGNOSTIC_TYPES)[number]

// ============================================
// 2. Photos / voice_notes étendus (cf. migration sections A + B)
// ============================================

/** Statuts Vision IA d'une photo terrain. */
export type VisionStatus =
  | 'pending'
  | 'processing'
  | 'analyzed'
  | 'failed'
  | 'skipped_duplicate'
  | 'skipped_blurry'
  | 'skipped_irrelevant'

/**
 * Info device au moment de la capture (timestamp horloge, user-agent, orientation, etc.).
 * Sérialisable JSON, pas de PII.
 */
export interface PhotoDeviceInfo {
  userAgent?: string
  platform?: string
  screenWidth?: number
  screenHeight?: number
  pixelRatio?: number
  orientation?: 'portrait' | 'landscape'
  /** Wall-clock timestamp côté client (différent du `taken_at` qui peut venir de l'EXIF). */
  capturedAtClient?: number
}

/**
 * Photo terrain telle qu'utilisée par le mode Capture-First.
 * Etend le schéma SQL `photos` (cf. init_schema + migration capture_first).
 *
 * Note : les FK vers d'autres photos (is_duplicate_of) sont des UUID sans contrainte SQL
 * car la table est partitionnée. L'app est responsable de l'intégrité.
 */
export interface MissionPhotoExtended {
  id: string
  organizationId: string
  dossierId: string
  roomId: string | null
  storagePath: string
  thumbPath: string | null
  width: number | null
  height: number | null
  sizeBytes: number | null
  mimeType: string
  takenAt: string | null

  // Champs ajoutés par la migration capture_first
  perceptualHash: string | null
  isBlurry: boolean
  isDuplicateOf: string | null
  deviceInfo: PhotoDeviceInfo | null
  gpsLat: number | null
  gpsLng: number | null
  visionStatus: VisionStatus
  visionAnalysis: VisionAnalysisResult | null
  visionConfidence: number | null
  visionModel: string | null
  visionCostUsd: number | null
  analyzedAt: string | null

  createdAt: string
}

/** Statut de transcription d'une note vocale (cf. migration section B). */
export type TranscriptionStatus = 'pending' | 'processing' | 'transcribed' | 'failed' | 'skipped'

/**
 * Note vocale étendue avec les champs IA + lien optionnel vers la photo annotée.
 * Ne touche PAS aux champs legacy (`provider`, `transcript_raw`, `parser_used`, ...)
 * conservés pour le mode classique.
 */
export interface VoiceNoteExtended {
  id: string
  organizationId: string
  dossierId: string
  roomId: string | null
  storagePath: string
  durationSeconds: number | null
  language: string

  // Mode classique (préservé)
  transcriptRaw: string | null
  transcriptStructured: Record<string, unknown> | null
  parserUsed: 'custom_js' | 'claude_haiku' | 'hybrid' | null

  // Mode Capture-First (migration)
  transcriptionStatus: TranscriptionStatus
  transcriptionConfidence: number | null
  transcriptionModel: string | null
  transcriptionCostUsd: number | null
  editedTranscription: string | null
  transcribedAt: string | null
  /** Photo à laquelle cette note est rattachée (annotation post-capture). */
  attachedPhotoId: string | null

  createdAt: string
}

// ============================================
// 3. Notes texte rapides (table mission_text_notes)
// ============================================

export interface MissionTextNote {
  id: string
  organizationId: string
  dossierId: string
  attachedPhotoId: string | null
  roomId: string | null
  text: string
  createdBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

// ============================================
// 4. Champs structurés consolidés (dossier_field_values)
// ============================================

export const FIELD_SOURCE_TYPES = [
  'photo_vision',
  'voice_extraction',
  'text_extraction',
  'document_ocr',
  'manual_entry',
  'imported_liciel',
  'inferred_ai',
  'calculated',
] as const

export type FieldSourceType = (typeof FIELD_SOURCE_TYPES)[number]

export type FieldConflictResolution =
  | 'resolved_keep_this'
  | 'resolved_keep_other'
  | 'resolved_custom'

/** Valeur jsonb stockée — laissée volontairement large (un champ DPE peut être string, number, bool, array). */
export type FieldValuePayload =
  | string
  | number
  | boolean
  | null
  | FieldValuePayload[]
  | { [key: string]: FieldValuePayload }

export interface DossierFieldValue {
  id: string
  organizationId: string
  dossierId: string
  diagnosticType: DiagnosticType
  fieldPath: string
  value: FieldValuePayload
  unit: string | null
  sourceType: FieldSourceType
  sourcePhotoId: string | null
  sourceVoiceId: string | null
  sourceTextId: string | null
  sourceDocumentId: string | null
  confidence: number | null
  validatedByUser: boolean
  validatedAt: string | null
  manuallyEditedAt: string | null
  hasConflict: boolean
  conflictResolution: FieldConflictResolution | null
  createdAt: string
  updatedAt: string
}

export interface DossierFieldValueHistory {
  id: string
  fieldValueId: string
  previousValue: FieldValuePayload | null
  newValue: FieldValuePayload | null
  changedBy: string | null
  changedByUser: boolean | null
  reason: string | null
  createdAt: string
}

// ============================================
// 5. Cache Vision cross-user
// ============================================

export interface VisionCacheEntry {
  id: string
  perceptualHashPrefix: string
  fullHash: string
  diagnosticsSignature: string
  analysis: VisionAnalysisResult
  hitCount: number
  costSavingsUsd: number
  createdAt: string
  expiresAt: string
}

// ============================================
// 6. Préférences utilisateur
// ============================================

export type TerrainMode = 'capture' | 'classic'

export type WhisperMode = 'local' | 'api' | 'auto'

export interface UserPreferences {
  id: string
  userId: string
  terrainMode: TerrainMode
  whisperMode: WhisperMode
  visionCacheOptIn: boolean
  createdAt: string
  updatedAt: string
}

// ============================================
// 7. Résultat Vision IA (Claude Vision Tool)
// ============================================

/**
 * Output structuré renvoyé par la Edge Function `vision-analyzer`.
 * Contient des "field hints" qui seront ensuite consolidés dans `dossier_field_values`
 * par la Edge Function `consolidator` (iteration ultérieure).
 */
export interface VisionAnalysisFieldHint {
  diagnosticType: DiagnosticType
  fieldPath: string
  value: FieldValuePayload
  unit: string | null
  confidence: number
  /** Justification courte (FR, max 200c) — utile pour audit + UI hover. */
  rationale: string
}

export interface VisionAnalysisResult {
  /** Pertinence globale : la photo a-t-elle des infos exploitables ? */
  relevant: boolean
  /** Type principal détecté (ex: 'chaudiere', 'tableau_elec', 'pieces_generale'). */
  primarySubject: string | null
  /** Texte court FR décrivant la photo (utile pour caption auto). */
  caption: string | null
  /** Liste des champs détectés à insérer dans dossier_field_values. */
  fieldHints: VisionAnalysisFieldHint[]
  /** Tokens consommés (audit cost). */
  inputTokens: number
  outputTokens: number
  /** Modèle utilisé (ex: 'claude-sonnet-4-6'). */
  model: string
  /** Total cost en USD pour cette analyse. */
  costUsd: number
}

// ============================================
// 8. Etat client du mode Capture-First
// ============================================

/**
 * Etat local React pour la coquille Capture-First.
 * Vit dans un Zustand store ou un useReducer — pas en DB.
 */
export interface CaptureState {
  /** Pièce courante (room) — locale tant qu'elle n'est pas synchronisée. */
  currentRoomId: string | null
  currentRoomName: string | null
  /** Photo en cours de capture (avant push dans la queue locale). */
  pendingPhoto: {
    localId: string
    blob: Blob
    thumbnailBlob: Blob | null
    capturedAt: number
  } | null
  /** Fenêtre 3-4s ouverte après tap photo pour annotation vocale/texte. */
  annotationWindowOpen: boolean
  /** Si la fenêtre annotation déclenche un enregistrement vocal en arrière-plan. */
  isRecordingVoice: boolean
  /** Compteur pour debug / UI (nombre de photos prises dans la session). */
  sessionPhotoCount: number
}

// ============================================
// 9. Queue locale IndexedDB (operations à synchroniser)
// ============================================

export type SyncOperationStatus = 'pending_upload' | 'uploaded' | 'failed'

interface QueuedOperationBase {
  /** UUID local — utilisé comme clef d'idempotence côté serveur. */
  id: string
  dossierId: string
  syncStatus: SyncOperationStatus
  attempts: number
  lastError: string | null
  createdAt: number
}

export interface QueuedPhotoOperation extends QueuedOperationBase {
  kind: 'photo'
  roomId: string | null
  roomName: string | null
  blob: Blob
  thumbnailBlob: Blob | null
  capturedAt: number
  /** Largeur du blob compressé (px) — issu de preprocessPhoto. */
  width: number
  /** Hauteur du blob compressé (px) — issu de preprocessPhoto. */
  height: number
  /** Taille en bytes du blob compressé. */
  sizeBytes: number
  /** dHash 16 hex (issu de preprocessPhoto). */
  perceptualHash: string
  /** Détecté flou par variance Laplacian (issu de preprocessPhoto). */
  isBlurry: boolean
  gpsLat?: number
  gpsLng?: number
  deviceInfo?: PhotoDeviceInfo
  /** Une fois uploaded : id côté Supabase. */
  serverPhotoId?: string
}

export interface QueuedVoiceNoteOperation extends QueuedOperationBase {
  kind: 'voice'
  roomId: string | null
  blob: Blob
  durationSeconds: number
  /** Si la note est attachée à une photo locale (window 3-4s). */
  attachedLocalPhotoId: string | null
  serverVoiceId?: string
}

export interface QueuedTextNoteOperation extends QueuedOperationBase {
  kind: 'text'
  roomId: string | null
  text: string
  attachedLocalPhotoId: string | null
  serverTextId?: string
}

export interface QueuedMutationOperation extends QueuedOperationBase {
  kind: 'mutation'
  mutationKind: string
  payload: Record<string, unknown>
}

/** Union discriminée des opérations en attente de sync. */
export type SyncQueueOperation =
  | QueuedPhotoOperation
  | QueuedVoiceNoteOperation
  | QueuedTextNoteOperation
  | QueuedMutationOperation

// ============================================
// 10. Schémas diagnostics (types — implémentation dans diagnostic-schemas.ts)
// ============================================

export type DiagnosticFieldKind =
  | 'string'
  | 'text'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'enum'
  | 'date'
  | 'year'
  | 'array'

export interface DiagnosticFieldEnumOption {
  value: string
  label: string
}

export interface DiagnosticField {
  /** Chemin technique (ex: "enveloppe.isolation_combles.epaisseur_cm"). */
  path: string
  /** Label affiché à l'utilisateur. */
  label: string
  kind: DiagnosticFieldKind
  unit?: string
  required?: boolean
  /** Si kind === 'enum'. */
  options?: DiagnosticFieldEnumOption[]
  /** Si kind === 'number' ou 'integer'. */
  min?: number
  max?: number
  /** Description courte (info-bulle, prompt IA). */
  description?: string
  /** Cf. CLAUDE.md — marqueur pour validation expert avant prod. */
  needsRegulatoryValidation?: boolean
}

export interface DiagnosticSection {
  id: string
  label: string
  /** Description (FR, contexte métier). */
  description?: string
  fields: DiagnosticField[]
  /** Sous-sections (ex: enveloppe → isolation_combles, isolation_murs, ...). */
  subsections?: DiagnosticSection[]
}

export interface DiagnosticSchema {
  diagnosticType: DiagnosticType
  /** Version du schéma (incrémentée à chaque changement). */
  version: string
  /** Description courte FR. */
  description: string
  sections: DiagnosticSection[]
}
