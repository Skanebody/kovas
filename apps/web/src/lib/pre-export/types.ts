/**
 * KOVAS — Module Pré-vérification Pré-export.
 *
 * Types partagés entre les 6 analyseurs et l'orchestrateur. Le module analyse
 * une mission AVANT que le diagnostiqueur exporte le fichier vers son logiciel
 * métier (Liciel XML, OBBC, DS8, notaire XML, PDF).
 *
 * Philosophie :
 *   - Anticiper ce que le diagnostiqueur n'a pas vu
 *   - JAMAIS BLOQUER l'export — toujours bouton "Exporter quand même" actif
 *   - Ton sobre, pédagogique, neutre
 *
 * Score global pondéré 0-100 :
 *   - 40 pts : conformité réglementaire ADEME (champs obligatoires DPE 3CL-2021)
 *   - 20 pts : cohérence interne (somme surfaces, équipements vs année, etc.)
 *   - 20 pts : cohérence statistique (vs benchmarks national/régional/typologie)
 *   - 10 pts : qualité photos et observations (preuve EEAT)
 *   - 10 pts : exhaustivité optionnelle (champs facultatifs)
 */

import type { VoiceParsedData } from '@/lib/voice-parser'

// ============================================================
// Format cible d'export
// ============================================================

export type TargetExportFormat =
  | 'liciel_xml'
  | 'liciel_diag'
  | 'obbc_xml'
  | 'ds8'
  | 'notaire_xml'
  | 'pdf_only'

export const TARGET_FORMAT_LABEL: Record<TargetExportFormat, string> = {
  liciel_xml: 'Liciel (XML)',
  liciel_diag: 'Liciel (.diag)',
  obbc_xml: 'OBBC (XML)',
  ds8: 'DS8',
  notaire_xml: 'Notaire (XML)',
  pdf_only: 'PDF seul',
}

// ============================================================
// Finding — alerte / suggestion produite par un analyseur
// ============================================================

export type FindingSeverity = 'critical' | 'warning' | 'suggestion' | 'info'

export type FindingCategory =
  | 'conformity' // conformité ADEME 3CL
  | 'coherence' // cohérence interne
  | 'statistical' // cohérence statistique
  | 'opportunity' // opportunité commerciale
  | 'quality' // qualité photos / observations
  | 'historical' // comparaison historique

export interface Finding {
  /** Identifiant stable du type de finding (ex: 'missing_annee_construction'). */
  code: string
  category: FindingCategory
  severity: FindingSeverity
  /** Titre court (max 80 chars), affiché sur la card. */
  title: string
  /** Message pédagogique (1-3 phrases). Ton sobre, pas de culpabilisation. */
  message: string
  /** Action suggérée (texte court). */
  suggested_action?: string
  /** Champ DB ou écran concerné (pour deep-link). */
  related_field?: string
  /** Contexte technique pour debug (jamais affiché brut à l'utilisateur). */
  context?: Record<string, unknown>
}

// ============================================================
// Contexte d'entrée — données mission consolidées
// ============================================================

export interface MissionAnalysisContext {
  mission: {
    id: string
    reference: string
    type: string
    status: string
    completed_at: string | null
  }
  property: {
    id?: string
    address: string
    postal_code: string | null
    city: string | null
    insee_code?: string | null
    property_type: string | null
    year_built: number | null
    surface_total: number | null
    surface_carrez: number | null
    /** Étiquette DPE proposée par le diagnostiqueur (saisie ou calculée). */
    energy_class?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null
    /** Étiquette GES proposée. */
    ges_class?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null
    /** Conso 5 usages kWh/m²/an. */
    conso_5_usages_kwh_m2_an?: number | null
    /** Code département (FR) déduit du code postal (75, 76, etc.). */
    departement_code?: string | null
    /** Code région INSEE. */
    region_code?: string | null
  }
  rooms: {
    id: string
    name: string
    room_type: string | null
    surface_m2: number | null
    ceiling_height_m?: number | null
  }[]
  photos: {
    id: string
    storage_path: string
    room_id: string | null
    caption: string | null
  }[]
  voiceNotes: {
    id: string
    room_id: string | null
    transcript_raw: string | null
    transcript_structured: VoiceParsedData | null
  }[]
  /** Drapeau "vente" / "location" pour règles opportunités F/G. */
  transaction_type?: 'vente' | 'location' | null
}

// ============================================================
// Résultat individuel d'un analyseur
// ============================================================

export interface AnalyzerResult {
  /** Identifiant stable de l'analyseur. */
  analyzer: string
  findings: Finding[]
  /** Sous-score 0-1 de l'axe (sera multiplié par le poids dans l'orchestrateur). */
  score: number
  /** Métadonnées techniques (debug / audit). */
  meta?: Record<string, unknown>
}

// ============================================================
// Résultat global pondéré
// ============================================================

export interface PreExportAnalysisResult {
  global_score: number // 0-100
  conformity_score: number // /40
  coherence_score: number // /20
  statistical_score: number // /20
  quality_score: number // /10
  exhaustivity_score: number // /10
  findings: Finding[]
  /** Interprétation textuelle (Dossier exemplaire / conforme / etc.). */
  interpretation: PreExportInterpretation
  /** Compteurs par sévérité pour l'UI. */
  counters: {
    critical: number
    warning: number
    suggestion: number
    info: number
  }
  analyzed_at: string
  duration_ms: number
}

export type PreExportInterpretation =
  | 'exemplaire' // 90-100
  | 'conforme' // 75-89
  | 'exploitable' // 60-74
  | 'verification_recommandee' // 40-59
  | 'a_reprendre' // 0-39

export const INTERPRETATION_LABEL: Record<PreExportInterpretation, string> = {
  exemplaire: 'Dossier exemplaire',
  conforme: 'Dossier conforme',
  exploitable: 'Dossier exploitable',
  verification_recommandee: 'Vérification recommandée',
  a_reprendre: 'Dossier à reprendre',
}

// ============================================================
// Pondérations score global (total 100)
// ============================================================

export const SCORE_WEIGHTS = {
  conformity: 40,
  coherence: 20,
  statistical: 20,
  quality: 10,
  exhaustivity: 10,
} as const

/**
 * Interprète un score global numérique vers son libellé sobre.
 */
export function interpretScore(score: number): PreExportInterpretation {
  if (score >= 90) return 'exemplaire'
  if (score >= 75) return 'conforme'
  if (score >= 60) return 'exploitable'
  if (score >= 40) return 'verification_recommandee'
  return 'a_reprendre'
}
