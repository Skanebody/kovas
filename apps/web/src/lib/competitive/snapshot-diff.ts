/**
 * KOVAS — Système 14 : Competitive intelligence — snapshot diff.
 *
 * Compare 2 PageSnapshot du même URL (capturés à 2 instants différents) et
 * détecte les changements significatifs : titre, meta, h1/h2, prix, CTA,
 * features, preuve sociale, hash de contenu.
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §17.
 *
 * Severity :
 *   - strategic : title_changed, h1_changed, price_added/removed/changed
 *   - major     : meta_description_changed, social_proof_jumped
 *   - minor     : h2_added/removed, cta_added/removed, feature_added/removed
 *   - info      : content_hash_changed seul (sans autre signal)
 *
 * is_significant = au moins un change `major` ou `strategic`.
 *
 * Déterministe, testable, zéro IO.
 */

import type { CompetitorSlug } from './competitors'
import { getCompetitor } from './competitors'
import type { PageSnapshot } from './snapshot-extractor'

export type ChangeType =
  | 'title_changed'
  | 'meta_description_changed'
  | 'h1_changed'
  | 'h2_added'
  | 'h2_removed'
  | 'price_added'
  | 'price_removed'
  | 'price_changed'
  | 'cta_added'
  | 'cta_removed'
  | 'feature_added'
  | 'feature_removed'
  | 'social_proof_jumped'
  | 'content_hash_changed'

export type ChangeSeverity = 'info' | 'minor' | 'major' | 'strategic'

export interface DetectedChange {
  type: ChangeType
  before: string | number | null
  after: string | number | null
  severity: ChangeSeverity
  detail: string
}

export interface SnapshotDiff {
  competitor_slug: CompetitorSlug
  url: string
  previous_fetched_at: string
  current_fetched_at: string
  has_changes: boolean
  /** Au moins 1 change major ou strategic */
  is_significant: boolean
  changes: DetectedChange[]
  /** Phrase courte pour log / dashboard */
  summary: string
}

const SEVERITY_BY_TYPE: Record<ChangeType, ChangeSeverity> = {
  title_changed: 'strategic',
  h1_changed: 'strategic',
  price_added: 'strategic',
  price_removed: 'strategic',
  price_changed: 'strategic',
  meta_description_changed: 'major',
  social_proof_jumped: 'major',
  h2_added: 'minor',
  h2_removed: 'minor',
  cta_added: 'minor',
  cta_removed: 'minor',
  feature_added: 'minor',
  feature_removed: 'minor',
  content_hash_changed: 'info',
}

function severityRank(s: ChangeSeverity): number {
  if (s === 'strategic') return 3
  if (s === 'major') return 2
  if (s === 'minor') return 1
  return 0
}

function setDiff<T>(a: T[], b: T[]): { added: T[]; removed: T[] } {
  const setA = new Set(a)
  const setB = new Set(b)
  const added = b.filter((x) => !setA.has(x))
  const removed = a.filter((x) => !setB.has(x))
  return { added, removed }
}

function diffPrices(previous: number[], current: number[]): DetectedChange[] {
  const changes: DetectedChange[] = []
  const { added, removed } = setDiff(previous, current)
  for (const p of added) {
    changes.push({
      type: 'price_added',
      before: null,
      after: p,
      severity: SEVERITY_BY_TYPE.price_added,
      detail: `Nouveau prix détecté : ${p}€`,
    })
  }
  for (const p of removed) {
    changes.push({
      type: 'price_removed',
      before: p,
      after: null,
      severity: SEVERITY_BY_TYPE.price_removed,
      detail: `Prix retiré : ${p}€`,
    })
  }
  // price_changed : si un prix avant a un voisin proche après (variation > 5%)
  // qui n'est pas dans la liste avant — heuristique sur prix non strictement
  // identiques mais proches.
  if (previous.length > 0 && current.length > 0 && previous.length === current.length) {
    // Cas simple : nombre de prix identique, on compare position-à-position
    // après tri (déjà trié par l'extractor).
    for (let i = 0; i < previous.length; i++) {
      const before = previous[i]
      const after = current[i]
      if (before == null || after == null) continue
      if (before === after) continue
      const pctDiff = Math.abs((after - before) / before) * 100
      if (pctDiff >= 5) {
        changes.push({
          type: 'price_changed',
          before,
          after,
          severity: SEVERITY_BY_TYPE.price_changed,
          detail: `Prix modifié : ${before}€ → ${after}€ (${pctDiff.toFixed(1)}% variation)`,
        })
      }
    }
  }
  return changes
}

function diffH2(previous: string[], current: string[]): DetectedChange[] {
  const changes: DetectedChange[] = []
  const { added, removed } = setDiff(previous, current)
  for (const h of added) {
    changes.push({
      type: 'h2_added',
      before: null,
      after: h,
      severity: SEVERITY_BY_TYPE.h2_added,
      detail: `Nouveau H2 : "${h}"`,
    })
  }
  for (const h of removed) {
    changes.push({
      type: 'h2_removed',
      before: h,
      after: null,
      severity: SEVERITY_BY_TYPE.h2_removed,
      detail: `H2 retiré : "${h}"`,
    })
  }
  return changes
}

function diffCta(previous: string[], current: string[]): DetectedChange[] {
  const changes: DetectedChange[] = []
  const { added, removed } = setDiff(previous, current)
  for (const c of added) {
    changes.push({
      type: 'cta_added',
      before: null,
      after: c,
      severity: SEVERITY_BY_TYPE.cta_added,
      detail: `Nouveau CTA : "${c}"`,
    })
  }
  for (const c of removed) {
    changes.push({
      type: 'cta_removed',
      before: c,
      after: null,
      severity: SEVERITY_BY_TYPE.cta_removed,
      detail: `CTA retiré : "${c}"`,
    })
  }
  return changes
}

function diffFeatures(previous: string[], current: string[]): DetectedChange[] {
  const changes: DetectedChange[] = []
  const { added, removed } = setDiff(previous, current)
  for (const f of added) {
    changes.push({
      type: 'feature_added',
      before: null,
      after: f,
      severity: SEVERITY_BY_TYPE.feature_added,
      detail: `Feature ajoutée : ${f}`,
    })
  }
  for (const f of removed) {
    changes.push({
      type: 'feature_removed',
      before: f,
      after: null,
      severity: SEVERITY_BY_TYPE.feature_removed,
      detail: `Feature retirée : ${f}`,
    })
  }
  return changes
}

function diffSocialProof(previous: number, current: number): DetectedChange | null {
  if (previous <= 0) return null
  if (current <= previous) return null
  const pctDiff = ((current - previous) / previous) * 100
  if (pctDiff < 50) return null
  return {
    type: 'social_proof_jumped',
    before: previous,
    after: current,
    severity: SEVERITY_BY_TYPE.social_proof_jumped,
    detail: `Preuve sociale : ${previous} → ${current} (+${pctDiff.toFixed(0)}%)`,
  }
}

function buildSummary(competitor_slug: CompetitorSlug, changes: DetectedChange[]): string {
  const competitor = getCompetitor(competitor_slug)
  const name = competitor?.name ?? competitor_slug
  if (changes.length === 0) {
    return `${name} : aucun changement`
  }
  const significant = changes.filter((c) => c.severity === 'strategic' || c.severity === 'major')
  if (significant.length === 0) {
    return `${name} : ${changes.length} changement(s) mineur(s)`
  }
  // Top change : par severity puis premier
  const sorted = [...significant].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  )
  const top = sorted[0]
  if (!top) {
    return `${name} : ${changes.length} changement(s)`
  }
  return `${name} : ${significant.length} changement(s) significatif(s) (${top.detail})`
}

/**
 * Compare 2 snapshots du même URL et retourne le diff structuré.
 *
 * @example
 * ```ts
 * const diff = diffSnapshots(yesterdaySnap, todaySnap, 'liciel')
 * if (diff.is_significant) {
 *   // Trigger analyse Claude + alerte Slack
 * }
 * ```
 */
export function diffSnapshots(
  previous: PageSnapshot,
  current: PageSnapshot,
  competitor_slug: CompetitorSlug,
): SnapshotDiff {
  const changes: DetectedChange[] = []

  // Title (strategic)
  if (previous.title !== current.title) {
    changes.push({
      type: 'title_changed',
      before: previous.title,
      after: current.title,
      severity: SEVERITY_BY_TYPE.title_changed,
      detail: `Titre modifié : "${previous.title ?? '∅'}" → "${current.title ?? '∅'}"`,
    })
  }

  // Meta description (major)
  if (previous.meta_description !== current.meta_description) {
    changes.push({
      type: 'meta_description_changed',
      before: previous.meta_description,
      after: current.meta_description,
      severity: SEVERITY_BY_TYPE.meta_description_changed,
      detail: 'Meta description modifiée',
    })
  }

  // H1 (strategic)
  if (previous.h1 !== current.h1) {
    changes.push({
      type: 'h1_changed',
      before: previous.h1,
      after: current.h1,
      severity: SEVERITY_BY_TYPE.h1_changed,
      detail: `H1 modifié : "${previous.h1 ?? '∅'}" → "${current.h1 ?? '∅'}"`,
    })
  }

  // H2 list (minor)
  changes.push(...diffH2(previous.h2_list, current.h2_list))

  // Prices (strategic)
  changes.push(...diffPrices(previous.prices_eur_detected, current.prices_eur_detected))

  // CTAs (minor)
  changes.push(...diffCta(previous.cta_texts, current.cta_texts))

  // Features (minor)
  changes.push(...diffFeatures(previous.feature_keywords, current.feature_keywords))

  // Social proof (major)
  const sp = diffSocialProof(previous.social_proof_count, current.social_proof_count)
  if (sp) changes.push(sp)

  // Content hash (info) — uniquement si aucun autre signal détecté
  if (previous.content_hash !== current.content_hash && changes.length === 0) {
    changes.push({
      type: 'content_hash_changed',
      before: previous.content_hash,
      after: current.content_hash,
      severity: SEVERITY_BY_TYPE.content_hash_changed,
      detail: 'Hash de contenu modifié sans signal structuré identifiable',
    })
  }

  const has_changes = changes.length > 0
  const is_significant = changes.some((c) => c.severity === 'strategic' || c.severity === 'major')
  const summary = buildSummary(competitor_slug, changes)

  return {
    competitor_slug,
    url: current.url,
    previous_fetched_at: previous.fetched_at,
    current_fetched_at: current.fetched_at,
    has_changes,
    is_significant,
    changes,
    summary,
  }
}
