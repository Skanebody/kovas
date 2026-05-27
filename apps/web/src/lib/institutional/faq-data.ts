/**
 * KOVAS — Filtres FAQ par catégorie thématique (page /faq étendue)
 *
 * Vue agrégée par thématique courte (chips), à la place de la
 * navigation par grandes catégories éditoriales. Les questions sont
 * référencées par leur `id` depuis `lib/faq-data.ts` — source unique
 * de vérité pour le contenu des réponses.
 *
 * Permet le filtrage UX par diagnostic (DPE, Amiante, Plomb, etc.)
 * en surcouche de la classification éditoriale existante.
 */

import { FAQ_CATEGORIES, FAQ_LANDING, type FaqQuestion } from '@/lib/faq-data'

export type FaqChipId =
  | 'all'
  | 'dpe'
  | 'amiante'
  | 'plomb'
  | 'gaz'
  | 'electricite'
  | 'termites'
  | 'carrez'
  | 'erp'
  | 'pro'
  | 'tarifs'
  | 'compte'
  | 'rgpd'

export interface FaqChip {
  id: FaqChipId
  label: string
  /** Mots-clefs déclencheurs dans le `id` ou `question` pour matcher */
  matchers: readonly (string | RegExp)[]
}

/**
 * 13 chips affichés en filtre horizontal (le 1er "Tous" est implicite).
 *
 * Les mots-clefs déclencheurs servent uniquement au filtrage runtime :
 * une question peut apparaître dans plusieurs chips si plusieurs matchers
 * matchent (par exemple "prix-dpe" matche dpe + tarifs).
 */
export const FAQ_CHIPS: FaqChip[] = [
  { id: 'all', label: 'Tous', matchers: [] },
  { id: 'dpe', label: 'DPE', matchers: ['dpe', '3cl', 'energ', 'passoire'] },
  { id: 'amiante', label: 'Amiante', matchers: ['amiante'] },
  { id: 'plomb', label: 'Plomb', matchers: ['plomb', 'crep'] },
  { id: 'gaz', label: 'Gaz', matchers: ['gaz'] },
  { id: 'electricite', label: 'Électricité', matchers: ['electric', 'élec'] },
  { id: 'termites', label: 'Termites', matchers: ['termite'] },
  { id: 'carrez', label: 'Carrez / Boutin', matchers: ['carrez', 'boutin', 'mesur'] },
  { id: 'erp', label: 'ERP', matchers: ['erp', 'risque'] },
  {
    id: 'pro',
    label: 'Pour les diagnostiqueurs',
    matchers: ['kovas', 'liciel', 'saisie', 'export', 'workflow', 'mission'],
  },
  {
    id: 'tarifs',
    label: 'Tarifs',
    matchers: ['tarif', 'prix', 'cout', 'coût', 'essai', 'forfait'],
  },
  {
    id: 'compte',
    label: 'Compte',
    matchers: ['compte', 'connexion', 'mot-de-passe', 'inscription'],
  },
  {
    id: 'rgpd',
    label: 'Conformité RGPD',
    matchers: ['rgpd', 'securite', 'sécurit', 'donnees', 'donné', 'hebergement'],
  },
] as const

export interface CategorizedFaqQuestion extends FaqQuestion {
  /** Catégorie éditoriale d'origine (pour ancrage interne) */
  readonly originCategoryId: string
  /** Chips qui matchent cette question */
  readonly chips: readonly FaqChipId[]
}

/**
 * Construit la liste plate de toutes les questions, taggées par les chips
 * qui les concernent. Calculé une fois au build.
 */
export function buildCategorizedFaq(): CategorizedFaqQuestion[] {
  const allQuestions: Array<{ q: FaqQuestion; originCategoryId: string }> = [
    ...FAQ_LANDING.map((q) => ({ q, originCategoryId: 'essentiel' })),
    ...FAQ_CATEGORIES.flatMap((cat) => cat.questions.map((q) => ({ q, originCategoryId: cat.id }))),
  ]

  return allQuestions.map(({ q, originCategoryId }) => {
    const haystack = `${q.id} ${q.question.toLowerCase()}`
    const chips: FaqChipId[] = ['all']
    for (const chip of FAQ_CHIPS) {
      if (chip.id === 'all') continue
      const matched = chip.matchers.some((matcher) =>
        matcher instanceof RegExp ? matcher.test(haystack) : haystack.includes(matcher),
      )
      if (matched) chips.push(chip.id)
    }
    return {
      ...q,
      originCategoryId,
      chips,
    }
  })
}

/**
 * Compte le nombre de questions par chip (pour affichage badge).
 */
export function countByChip(): Record<FaqChipId, number> {
  const all = buildCategorizedFaq()
  const counts = FAQ_CHIPS.reduce(
    (acc, chip) => {
      acc[chip.id] = 0
      return acc
    },
    {} as Record<FaqChipId, number>,
  )
  for (const q of all) {
    for (const chip of q.chips) {
      counts[chip] = (counts[chip] ?? 0) + 1
    }
  }
  counts.all = all.length
  return counts
}
