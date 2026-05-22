/**
 * KOVAS — EEAT scoring helpers (Mission D4 SEO).
 *
 * Helpers calcul EEAT (Experience-Expertise-Authoritativeness-Trustworthiness)
 * partagés entre Server Actions (actions.ts) et Client Component
 * (SeoDraftEditor.tsx). Fichier neutre — pas de 'use server'.
 */

export type SeoDraftStatus =
  | 'draft'
  | 'review'
  | 'approved'
  | 'published'
  | 'archived'
  | 'rejected'

export const VALID_SEO_DRAFT_STATUSES: readonly SeoDraftStatus[] = [
  'draft',
  'review',
  'approved',
  'published',
  'archived',
  'rejected',
]

export interface EeatValidations {
  hasAnecdote: boolean
  hasFigures: boolean
  hasExpertQuote: boolean
  hasPhoto: boolean
}

export function computeEeatValidations(markdown: string): EeatValidations {
  const text = markdown.toLowerCase()

  const anecdoteRegex =
    /(j'ai|j'etais|j'étais|lors d'une intervention|recemment|récemment|sur le terrain)/i
  let hasAnecdote = false
  const match = anecdoteRegex.exec(text)
  if (match && typeof match.index === 'number') {
    const idx = match.index
    const windowStart = Math.max(0, idx - 100)
    const windowEnd = Math.min(text.length, idx + 200)
    const windowText = text.slice(windowStart, windowEnd)
    const wordCount = windowText.split(/\s+/).filter(Boolean).length
    hasAnecdote = wordCount >= 50
  }

  const figureRegex = /\d+(?:[\s,]\d+)*\s*(%|€|m²|m2|ans?|mois|kg|kwh|kWh)/gi
  const figures = markdown.match(figureRegex) ?? []
  const hasFigures = figures.length >= 3

  const quoteRegex1 =
    /[«"][^»"]{20,300}[»"]\s*[—\-–]\s*[A-ZÀ-Ý][a-zà-ÿ-]+\s+[A-ZÀ-Ý][a-zà-ÿ-]+/
  const quoteRegex2 =
    /selon\s+[A-ZÀ-Ý][a-zà-ÿ-]+\s+[A-ZÀ-Ý][a-zà-ÿ-]+\s*,\s*[a-zà-ÿ]/i
  const hasExpertQuote = quoteRegex1.test(markdown) || quoteRegex2.test(markdown)

  const hasPhoto = /!\[[^\]]*\]\([^)]+\)/.test(markdown)

  return { hasAnecdote, hasFigures, hasExpertQuote, hasPhoto }
}

export function computeEeatScore(v: EeatValidations): number {
  let s = 0
  if (v.hasAnecdote) s += 3
  if (v.hasFigures) s += 3
  if (v.hasExpertQuote) s += 2
  if (v.hasPhoto) s += 2
  return s
}
