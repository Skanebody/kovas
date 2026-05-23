/**
 * KOVAS — Types Veille articles SEO (méthode Amandine Bart).
 *
 * Pipeline IA d'articles éditoriaux longs (1500-3000 mots) générés par
 * Claude Haiku avec scoring E-E-A-T (4 axes) et validation admin.
 */

import type { VeilleCategory } from './seo-keywords'

export type VeilleArticleStatus = 'pending_review' | 'approved' | 'published' | 'rejected'

export interface VeilleArticleDraft {
  readonly id: string
  readonly topic: string
  readonly targetKeyword: string
  readonly slug: string
  readonly title: string
  readonly metaTitle: string | null
  readonly metaDescription: string | null
  readonly contentMarkdown: string
  readonly excerpt: string | null
  readonly heroImageUrl: string | null

  // Métadonnées IA
  readonly aiModel: string
  readonly aiInputTokens: number
  readonly aiOutputTokens: number
  readonly aiCostEur: number
  readonly aiGeneratedAt: string

  // Scoring E-E-A-T méthode Amandine Bart (0-100 chaque axe)
  readonly eeatExperience: number
  readonly eeatExpertise: number
  readonly eeatAuthoritativeness: number
  readonly eeatTrustworthiness: number
  readonly eeatScore: number

  // Métriques structurelles
  readonly wordCount: number
  readonly internalLinksCount: number
  readonly sourceCitationsCount: number
  readonly faqQuestionsCount: number
  readonly h2Count: number
  readonly h3Count: number

  // Workflow
  readonly status: VeilleArticleStatus
  readonly reviewedBy: string | null
  readonly reviewedAt: string | null
  readonly reviewNotes: string | null
  readonly rejectedReason: string | null
  readonly publishedAt: string | null

  // Catégorisation
  readonly category: VeilleCategory
  readonly tags: ReadonlyArray<string>

  readonly createdAt: string
  readonly updatedAt: string
}

export interface VeilleArticleListItem {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly excerpt: string
  readonly category: VeilleCategory
  readonly publishedAt: string
  readonly targetKeyword: string
  readonly wordCount: number
}

export interface EeatScoreBreakdown {
  readonly experience: number
  readonly expertise: number
  readonly authoritativeness: number
  readonly trustworthiness: number
  readonly composite: number
}

export const CATEGORY_LABELS: Record<VeilleCategory, string> = {
  reglementaire: 'Réglementation',
  pratique: 'Pratique',
  technique: 'Technique',
  marche: 'Marché',
  jurisprudence: 'Jurisprudence',
}

export const CATEGORY_DESCRIPTIONS: Record<VeilleCategory, string> = {
  reglementaire: 'Évolutions des textes officiels (décrets, arrêtés, lois)',
  pratique: 'Conseils opérationnels et démarches concrètes',
  technique: 'Méthodes de calcul et protocoles techniques',
  marche: 'Analyses du marché du diagnostic immobilier',
  jurisprudence: 'Décisions de justice et leur portée pratique',
}
