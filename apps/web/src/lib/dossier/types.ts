/**
 * KOVAS — Types stub pour la page dossier refondue (Partition C).
 *
 * Note : ces types sont créés en attendant que l'agent (libs partagées)
 * livre la version canonique dans `@/lib/dossier/*`. Une fois la version
 * canonique disponible, ce fichier sera fusionné / remplacé par les
 * exports officiels — l'API publique (noms / signatures) doit rester
 * compatible.
 *
 * Authority : CLAUDE.md §10 (TS strict zéro any) + spec design v5.
 */

import type { DiagnosticType } from '@/lib/mission/types'

// ============================================
// 1. État visuel d'un dossier (3 états canoniques)
// ============================================

export type DossierVisualState = 'to-start' | 'in-progress' | 'completed'

// ============================================
// 2. Status d'une pièce visitée (UI)
// ============================================

export type RoomVisitStatus = 'started' | 'in-progress' | 'completed' | 'skipped'

// ============================================
// 3. Diagnostic status (chip avec issue éventuel)
// ============================================

export interface DiagnosticStatus {
  diagnostic: DiagnosticType
  hasIssue: boolean
  issueLabel?: string
}

// ============================================
// 4. Pièce visitée vs suggérée
// ============================================

export interface VisitedRoom {
  id: string
  name: string
  type: string
  status: RoomVisitStatus
  photosCount: number
  voiceNotesCount: number
  durationMin: number
  fieldsCount: number
  diagnosticStatuses: DiagnosticStatus[]
}

export interface SuggestedRoom {
  id: string
  name: string
  type: string
  status: 'not-visited'
  suggestedReason: string
  diagnosticStatuses: DiagnosticStatus[]
}

// ============================================
// 5. Vue "par diagnostic"
// ============================================

export interface DiagnosticProgress {
  diagnostic: DiagnosticType
  percent: number
  fieldsCollected: number
  fieldsTotal: number
  missingFields: string[]
}

// ============================================
// 6. Vue "par champ critique" — 4 buckets
// ============================================

export type CriticalFieldBucketId = 'to-verify' | 'edited' | 'validated' | 'missing'

export interface CriticalField {
  /** Chemin lisible du champ (ex. "DPE › Isolation › Murs"). */
  path: string
  /** Valeur courante (formatée). */
  value: string | null
  diagnostic: DiagnosticType
  confidence?: number
  hasConflict?: boolean
  /** Référence vers la source (photo, voice note, manuel). */
  sourceLabel?: string
}

export interface CriticalFieldBucket {
  id: CriticalFieldBucketId
  label: string
  fields: CriticalField[]
}

// ============================================
// 7. ProgressionData global (root)
// ============================================

export interface ProgressionDataDiagnostics {
  list: DiagnosticProgress[]
  /** Résumé court "DPE 85% · Amiante 40%". */
  summary: string
}

export interface ProgressionDataRooms {
  visitedRooms: VisitedRoom[]
  suggestedRooms: SuggestedRoom[]
}

export interface ProgressionData {
  diagnostics: ProgressionDataDiagnostics
  rooms: ProgressionDataRooms
  fields: {
    /** Total champs collectés vs attendus tous diagnostics confondus. */
    collected: number
    total: number
  }
  buckets: CriticalFieldBucket[]
  /** Champs manquants critiques aplatis (utilisés par AttentionSection). */
  missingFields: Array<{
    label: string
    diagnostic: DiagnosticType
  }>
  /** Résumé éditorial (1 ligne) — utilisé en bottom bar + hero. */
  summary: string
  photosCount: number
  voiceNotesCount: number
}

// ============================================
// 8. Preparation checklist (état to-start)
// ============================================

export type PreparationItemId =
  | 'property-identified'
  | 'client-confirmed'
  | 'itinerary-ready'
  | 'documents-received'

export interface PreparationItem {
  id: PreparationItemId
  label: string
  done: boolean
}

// ============================================
// 9. Historique (HistoryAccordion)
// ============================================

export type HistoryItemType =
  | 'created'
  | 'updated'
  | 'photo'
  | 'voice'
  | 'export'
  | 'status_change'
  | 'comment'

export interface HistoryItem {
  id: string
  type: HistoryItemType
  label: string
  /** Timestamp ISO (UTC). */
  ts: string
  actor?: string
}

// ============================================
// 10. Données minimum pour le hero / sticky / header
// ============================================

export interface DossierHeroSummary {
  /** Nom de la pièce courante (in-progress) ou prochaine étape (to-start). */
  currentRoom?: string
  /** Temps total écoulé sur la mission (minutes). */
  totalDurationMin?: number
  photosCount: number
  voiceNotesCount: number
}

export interface DossierHeaderInfo {
  address: string
  city?: string
  propertyType?: string
  surface?: number
  year?: number
  reference: string
  clientName?: string
}
