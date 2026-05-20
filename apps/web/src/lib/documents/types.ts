/**
 * KOVAS — Types Document Intelligence (stubs locaux UI-side).
 *
 * Ces stubs définissent le contrat client. Le backend (autre agent) crée
 * les modules `document-classifier`, `confidence-router`, `regulatory-validator`
 * qui ré-exporteront ou raffineront ces types. Tant que ces modules ne sont
 * pas présents, les composants UI s'appuient sur ces stubs.
 *
 * Si le backend introduit des champs supplémentaires, ces types sont compatibles
 * (les composants UI consomment via destructuring partiel).
 */

/**
 * Types de documents reconnus par le classifieur (15 types canoniques KOVAS).
 * Cf. spec — DPE, Plaque chaudière, Facture énergie, Plan, etc.
 */
export type DocumentType =
  | 'dpe_anterior'
  | 'boiler_plate'
  | 'energy_bill'
  | 'floor_plan'
  | 'property_deed'
  | 'amiante_anterior'
  | 'electrical_diagnosis'
  | 'gas_diagnosis'
  | 'lead_diagnosis'
  | 'termite_diagnosis'
  | 'carrez_measurement'
  | 'cadastral_extract'
  | 'building_permit'
  | 'invoice'
  | 'other'

/** Document persisté en base — minimum requis côté UI. */
export interface Document {
  id: string
  organization_id: string
  dossier_id: string | null
  filename: string
  storage_path: string
  /** URL signée publique courte durée (générée par l'API). */
  thumbnail_url: string | null
  preview_url: string | null
  document_type: DocumentType | null
  /** Score de confiance classification (0-1). */
  classification_confidence: number | null
  /** Données extraites par le moteur d'extraction (clé → valeur). */
  extraction_data: Record<string, ExtractedField> | null
  /** Validation réglementaire (présent si le type le supporte). */
  regulatory_validation: RegulatoryValidation | null
  uploaded_at: string
  uploaded_by: string | null
  /** Statut du pipeline : uploaded → classified → extracted → validated. */
  processing_status: DocumentProcessingStatus
}

export type DocumentProcessingStatus =
  | 'uploaded'
  | 'classifying'
  | 'classified'
  | 'extracting'
  | 'extracted'
  | 'failed'

/**
 * Document capturé côté client avant upload (file picker, caméra, drag&drop).
 * Sert de pré-modèle au POST /api/documents/upload.
 */
export interface CapturedDocument {
  /** File du navigateur (image ou PDF). */
  file: File
  /** URL temporaire pour preview avant upload. */
  previewUrl: string
  /** Source de capture (analytics + UX). */
  source: 'camera' | 'file_picker' | 'drag_drop'
  /** Taille en octets. */
  sizeBytes: number
  /** MIME type. */
  mimeType: string
}

/** Document après pipeline complet, prêt pour preview ou pre-fill. */
export interface ProcessedDocument {
  document: Document
  classification: ClassificationResult
  extraction: ExtractionResult | null
  validation: RegulatoryValidation | null
}

/**
 * Résultat de classification — type détecté + alternatives.
 */
export interface ClassificationResult {
  /** Type détecté avec la plus haute confiance. */
  detectedType: DocumentType
  /** Confiance globale 0-1. */
  confidence: number
  /** Alternatives proposées si confiance < 90% (max 3). */
  alternatives: { type: DocumentType; confidence: number }[]
  /** Le user a-t-il corrigé manuellement ? */
  userCorrected: boolean
}

/**
 * Champ extrait avec metadata pour routing UI (auto-validate vs review).
 */
export interface ExtractedField {
  /** Clé sémantique stable (e.g. `surface`, `dpe_label`, `year_built`). */
  key: string
  /** Label FR affiché au user (e.g. « Surface »). */
  label: string
  /** Valeur extraite (number, string, etc.). */
  value: string | number | boolean | null
  /** Confiance d'extraction 0-1. */
  confidence: number
  /** Routing : auto = ≥90%, review = 70-89%, manual = <70%. */
  routing: 'auto' | 'review' | 'manual'
}

export interface ExtractionResult {
  documentId: string
  fields: Record<string, ExtractedField>
  /** Confiance moyenne pondérée. */
  globalConfidence: number
  /** Coût IA en USD (transparence). */
  costUsd: number
}

/**
 * Validation réglementaire (durées de validité, expirations, plages spécifiques).
 * Présent uniquement pour les types réglementés (DPE 10 ans, Amiante illimité, etc.).
 */
export interface RegulatoryValidation {
  /** Statut global. */
  status: 'valid' | 'expiring' | 'expired' | 'unlimited' | 'unknown'
  /** Date d'expiration calculée (ISO, si applicable). */
  expiresAt: string | null
  /** Jours restants (si expiring). */
  daysRemaining: number | null
  /** Message FR court (e.g. « Expire dans 4 mois »). */
  message: string
  /** Référence légale (e.g. « Art. R. 134-4-2 CCH »). */
  legalReference: string | null
}

/**
 * Pre-fill result — champs proposés pour pré-remplir un dossier après extraction.
 */
export interface PrefilledField {
  /** Cible : table + colonne (e.g. `properties.surface_total`). */
  target: string
  /** Label FR humain. */
  label: string
  /** Valeur proposée. */
  proposedValue: string | number | boolean | null
  /** Valeur actuelle du dossier (si déjà saisi). */
  currentValue: string | number | boolean | null
  /** Confiance 0-1. */
  confidence: number
  /** Statut décidé par le routeur. */
  status: 'auto_validated' | 'pending_review' | 'ignored'
  /** Source : document d'origine. */
  sourceDocumentId: string
}

export interface PrefillResult {
  dossierId: string
  documentId: string
  fields: PrefilledField[]
  /** Stats pour le SuccessView. */
  stats: {
    autoValidated: number
    pendingReview: number
    ignored: number
  }
}

/**
 * Quota de scans documents (par organisation, mois courant).
 */
export interface ScanQuota {
  used: number
  included: number
  remaining: number
  /** Plan Stripe : `decouverte` | `standard` | `volume` | `founder` ... */
  planId: string
}
