/**
 * KOVAS — Types partagés veille réglementaire.
 *
 * Source de vérité : migrations `supabase/migrations/2026052518*`.
 * Les tables ne sont pas encore dans Database type généré ; on type ici à la main.
 */

export type RegulatoryImportance = 'low' | 'normal' | 'high' | 'critical'

export type RegulatoryDocType =
  | 'arrete'
  | 'decret'
  | 'loi'
  | 'circulaire'
  | 'guide'
  | 'norme'
  | 'faq'
  | 'autre'

export type RegulatoryModule =
  | 'dpe'
  | 'amiante'
  | 'plomb'
  | 'gaz'
  | 'electricite'
  | 'termites'
  | 'carrez'
  | 'erp'

export interface RegulatoryDocumentRow {
  id: string
  source_id: string
  external_id: string | null
  doc_type: RegulatoryDocType
  title: string
  url: string
  published_at: string | null
  effective_at: string | null
  jurisdiction: string
  raw_text: string
  ai_summary: string | null
  topics: string[]
  diagnostic_kinds: string[]
  applies_to: string[]
  importance: RegulatoryImportance
  is_superseded: boolean
  processed_at: string | null
  created_at: string
}

export interface RegulatoryDocumentListItem {
  id: string
  doc_type: RegulatoryDocType
  title: string
  url: string
  published_at: string | null
  effective_at: string | null
  ai_summary: string | null
  topics: string[]
  diagnostic_kinds: string[]
  importance: RegulatoryImportance
  is_superseded: boolean
  processed_at: string | null
  source: { id: string; name: string; authority: string } | null
}

export interface RegulatoryDocumentDetail extends RegulatoryDocumentListItem {
  raw_text: string
  applies_to: string[]
  jurisdiction: string
  created_at: string
}

export interface RegulatoryNotificationRow {
  id: string
  organization_id: string
  user_id: string
  document_id: string
  reason: string | null
  matched_topics: string[]
  matched_kinds: string[]
  severity: 'info' | 'warning' | 'critical'
  read_at: string | null
  dismissed_at: string | null
  created_at: string
}

export type AutoUpdateStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'rolled_back'
  | 'failed'

export type AutoUpdateChangeType =
  | 'config'
  | 'seed_data'
  | 'code_patch'
  | 'content_update'
  | 'manual_task'

export type AutoUpdateRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface SystemAutoUpdateRow {
  id: string
  triggered_by_doc_id: string | null
  detected_by: 'ai_worker' | 'admin_manual' | 'user_report'
  title: string
  summary: string
  rationale: string
  affected_areas: string[]
  change_type: AutoUpdateChangeType
  proposed_payload: Record<string, unknown>
  rollback_payload: Record<string, unknown> | null
  status: AutoUpdateStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  applied_by: string | null
  applied_at: string | null
  apply_result: Record<string, unknown> | null
  apply_error: string | null
  risk_level: AutoUpdateRiskLevel
  created_at: string
  updated_at: string
}

// ────────────────────────────────────────────────────────────
// Mapping affichage
// ────────────────────────────────────────────────────────────

export const DOC_TYPE_LABEL: Record<RegulatoryDocType, string> = {
  arrete: 'Arrêté',
  decret: 'Décret',
  loi: 'Loi',
  circulaire: 'Circulaire',
  guide: 'Guide',
  norme: 'Norme',
  faq: 'FAQ',
  autre: 'Document',
}

export const MODULE_LABEL: Record<RegulatoryModule, string> = {
  dpe: 'DPE',
  amiante: 'Amiante',
  plomb: 'Plomb',
  gaz: 'Gaz',
  electricite: 'Électricité',
  termites: 'Termites',
  carrez: 'Carrez/Boutin',
  erp: 'ERP',
}

export const ALL_MODULES: RegulatoryModule[] = [
  'dpe',
  'amiante',
  'plomb',
  'gaz',
  'electricite',
  'termites',
  'carrez',
  'erp',
]

export const ALL_DOC_TYPES: RegulatoryDocType[] = [
  'arrete',
  'decret',
  'loi',
  'circulaire',
  'guide',
  'norme',
  'faq',
  'autre',
]

export const ALL_IMPORTANCES: RegulatoryImportance[] = ['low', 'normal', 'high', 'critical']

export const IMPORTANCE_LABEL: Record<RegulatoryImportance, string> = {
  low: 'Faible',
  normal: 'Normale',
  high: 'Élevée',
  critical: 'Critique',
}

export const IMPORTANCE_BADGE: Record<RegulatoryImportance, 'muted' | 'blue' | 'orange' | 'red'> = {
  low: 'muted',
  normal: 'blue',
  high: 'orange',
  critical: 'red',
}

export const STATUS_LABEL: Record<AutoUpdateStatus, string> = {
  pending_review: 'À examiner',
  approved: 'Approuvée',
  rejected: 'Rejetée',
  applied: 'Appliquée',
  rolled_back: 'Annulée',
  failed: 'Échec',
}

export const STATUS_BADGE: Record<AutoUpdateStatus, 'muted' | 'blue' | 'green' | 'red' | 'orange'> =
  {
    pending_review: 'orange',
    approved: 'blue',
    rejected: 'muted',
    applied: 'green',
    rolled_back: 'muted',
    failed: 'red',
  }

export const RISK_BADGE: Record<AutoUpdateRiskLevel, 'muted' | 'blue' | 'orange' | 'red'> = {
  low: 'muted',
  medium: 'blue',
  high: 'orange',
  critical: 'red',
}

export const CHANGE_TYPE_LABEL: Record<AutoUpdateChangeType, string> = {
  config: 'Configuration',
  seed_data: 'Données de référence',
  code_patch: 'Patch logiciel',
  content_update: 'Contenu',
  manual_task: 'Tâche manuelle',
}
