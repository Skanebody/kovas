/**
 * KOVAS — Système 8 : Lead scoring temps réel (visiteurs site marketing).
 *
 * Pure function qui calcule le score 0-100 d'un visiteur à partir de son
 * `VisitorBehavior`. Score = somme pondérée des signaux, ajustée par un
 * multiplicateur source, puis clampée 0-100.
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §11 (Lead scoring temps réel).
 *
 * Déterministe, testable, zéro IO. Le caller (`tier-classifier.ts`) consomme
 * le résultat pour décider tier + actions auto.
 */

import type { VisitorBehavior, VisitorSource } from './behavior-tracker'

export interface VisitorScoreSignal {
  /** Code stable pour analytics (snake_case) */
  code: string
  /** Libellé humain court (admin UI) */
  label: string
  /** Contribution en points (peut être négative) */
  points: number
  /** Phrase explicative (debug + admin UI) */
  detail: string
}

export interface VisitorScoreResult {
  /** Score final 0-100 (clampé) */
  score: number
  /** Somme brute avant multiplier source + clamp (peut dépasser 100 ou être négative) */
  raw_total: number
  /** Détail des contributions */
  signals: ReadonlyArray<VisitorScoreSignal>
  /** Confidence 0-1 — proxy de la quantité de signal exploitable */
  confidence: number
}

/**
 * Pondérations (max ~150 avant clamp 100) :
 *
 * Pages signaux (max ~120) :
 *   - pricing visit              : +25
 *   - features visit             : +15
 *   - testimonials visit         : +20
 *   - calculator visit           : +30 (intent fort)
 *   - observatory visit          : +15 (intérêt sectoriel)
 *   - blog/guides visit          : +10
 *   - annuaire visit             : +5
 *
 * Time engagement (cumulatifs, max 35 + 15 + 20 = 70) :
 *   - time >= 60s                : +10
 *   - time >= 180s               : +15 (cumul 25)
 *   - time >= 300s               : +10 (cumul 35)
 *   - scroll_max >= 50           : +5
 *   - scroll_max >= 80           : +10 (cumul 15)
 *   - page_count >= 3            : +10
 *   - page_count >= 6            : +10 (cumul 20)
 *
 * Actions (max ~155) :
 *   - newsletter signup          : +25
 *   - signup flow started        : +40
 *   - signup flow abandoned      : -15
 *   - calculator completion      : +25
 *   - quote request submitted    : +50
 *   - videos watched > 0         : +15
 *
 * Returning visitor (max 25) :
 *   - returning                  : +15
 *   - sessions_count >= 3        : +10 (cumul 25)
 *
 * Context (max 5) :
 *   - business hours weekday     : +5
 *
 * Multiplier source (appliqué sur raw_total avant clamp) :
 *   - referral 1.5, organic 1.3, linkedin 1.2, newsletter 1.2,
 *     press 1.15, direct 1.1, unknown 1.0, paid_ads 0.95, tiktok 0.85
 *
 * Score final = clamp(raw * multiplier, 0, 100).
 */

function pushIf(
  signals: VisitorScoreSignal[],
  condition: boolean,
  signal: VisitorScoreSignal,
): void {
  if (condition) {
    signals.push(signal)
  }
}

function signalsForPages(behavior: VisitorBehavior): VisitorScoreSignal[] {
  const out: VisitorScoreSignal[] = []
  pushIf(out, behavior.has_visited_pricing, {
    code: 'page_pricing',
    label: 'Page Tarifs',
    points: 25,
    detail: 'Visite /tarifs — intent commercial fort',
  })
  pushIf(out, behavior.has_visited_features, {
    code: 'page_features',
    label: 'Page Fonctionnalités',
    points: 15,
    detail: 'Visite /fonctionnalites',
  })
  pushIf(out, behavior.has_visited_testimonials, {
    code: 'page_testimonials',
    label: 'Page À propos',
    points: 20,
    detail: 'Visite /a-propos — recherche de réassurance',
  })
  pushIf(out, behavior.has_visited_calculator, {
    code: 'page_calculator',
    label: 'Page Calculateur',
    points: 30,
    detail: 'Visite /calculateur-dpe-gratuit — intent qualifié',
  })
  pushIf(out, behavior.has_visited_observatory, {
    code: 'page_observatory',
    label: 'Page Observatoire',
    points: 15,
    detail: 'Visite /observatoire — intérêt sectoriel',
  })
  pushIf(out, behavior.has_visited_blog_or_guides, {
    code: 'page_blog_guides',
    label: 'Blog/Guides',
    points: 10,
    detail: 'Visite /blog/* ou /guide/*',
  })
  pushIf(out, behavior.has_visited_annuaire, {
    code: 'page_annuaire',
    label: 'Annuaire',
    points: 5,
    detail: 'Visite /trouver-un-diagnostiqueur/*',
  })
  return out
}

function signalsForEngagement(behavior: VisitorBehavior): VisitorScoreSignal[] {
  const out: VisitorScoreSignal[] = []
  const t = behavior.time_on_site_seconds

  if (t >= 300) {
    out.push({
      code: 'time_300s',
      label: 'Temps > 5min',
      points: 10,
      detail: `${t}s sur le site — engagement profond`,
    })
  }
  if (t >= 180) {
    out.push({
      code: 'time_180s',
      label: 'Temps > 3min',
      points: 15,
      detail: `${t}s sur le site`,
    })
  }
  if (t >= 60) {
    out.push({
      code: 'time_60s',
      label: 'Temps > 1min',
      points: 10,
      detail: `${t}s sur le site`,
    })
  }

  const s = behavior.scroll_depth_max
  if (s >= 80) {
    out.push({
      code: 'scroll_80',
      label: 'Scroll > 80%',
      points: 10,
      detail: `Scroll max ${s}% — lecture complète`,
    })
  }
  if (s >= 50) {
    out.push({
      code: 'scroll_50',
      label: 'Scroll > 50%',
      points: 5,
      detail: `Scroll max ${s}%`,
    })
  }

  const p = behavior.page_count
  if (p >= 6) {
    out.push({
      code: 'pages_6',
      label: '6+ pages',
      points: 10,
      detail: `${p} pages visitées — exploration approfondie`,
    })
  }
  if (p >= 3) {
    out.push({
      code: 'pages_3',
      label: '3+ pages',
      points: 10,
      detail: `${p} pages visitées`,
    })
  }
  return out
}

function signalsForActions(behavior: VisitorBehavior): VisitorScoreSignal[] {
  const out: VisitorScoreSignal[] = []
  pushIf(out, behavior.has_signed_up_newsletter, {
    code: 'action_newsletter',
    label: 'Newsletter',
    points: 25,
    detail: 'Inscrit newsletter — opt-in marketing',
  })
  pushIf(out, behavior.has_started_signup_flow, {
    code: 'action_signup_start',
    label: 'Signup démarré',
    points: 40,
    detail: 'A démarré le flow signup — intent très fort',
  })
  pushIf(out, behavior.has_abandoned_signup_flow, {
    code: 'action_signup_abandoned',
    label: 'Signup abandonné',
    points: -15,
    detail: 'A abandonné le flow signup — friction détectée',
  })
  pushIf(out, behavior.has_used_calculator_to_completion, {
    code: 'action_calculator_done',
    label: 'Calculateur complété',
    points: 25,
    detail: 'A complété le calculateur DPE — lead qualifié',
  })
  pushIf(out, behavior.has_submitted_quote_request, {
    code: 'action_quote_request',
    label: 'Demande de devis',
    points: 50,
    detail: 'A soumis une demande de devis — conversion B2C',
  })
  pushIf(out, behavior.videos_watched_count > 0, {
    code: 'action_video',
    label: 'Vidéo regardée',
    points: 15,
    detail: `${behavior.videos_watched_count} vidéo(s) regardée(s)`,
  })
  return out
}

function signalsForReturning(behavior: VisitorBehavior): VisitorScoreSignal[] {
  const out: VisitorScoreSignal[] = []
  if (behavior.sessions_count >= 3) {
    out.push({
      code: 'returning_3plus',
      label: '3+ sessions',
      points: 10,
      detail: `${behavior.sessions_count} sessions — visiteur engagé`,
    })
  }
  if (behavior.is_returning_visitor) {
    out.push({
      code: 'returning',
      label: 'Visiteur récurrent',
      points: 15,
      detail: 'Déjà visité — intérêt confirmé',
    })
  }
  return out
}

function signalsForContext(behavior: VisitorBehavior): VisitorScoreSignal[] {
  const out: VisitorScoreSignal[] = []
  const isWeekday = behavior.day_of_week >= 1 && behavior.day_of_week <= 5
  if (behavior.is_business_hours && isWeekday) {
    out.push({
      code: 'context_business_hours',
      label: 'Horaires pro',
      points: 5,
      detail: 'Visite en heures ouvrées semaine — intent pro',
    })
  }
  return out
}

function sourceMultiplier(source: VisitorSource): { value: number; label: string } {
  switch (source) {
    case 'referral':
      return { value: 1.5, label: 'Référence ×1.5 (LTV/CAC élevé)' }
    case 'organic_search':
      return { value: 1.3, label: 'Recherche organique ×1.3 (intent fort)' }
    case 'linkedin':
      return { value: 1.2, label: 'LinkedIn ×1.2 (audience qualifiée)' }
    case 'newsletter':
      return { value: 1.2, label: 'Newsletter ×1.2 (warm)' }
    case 'press':
      return { value: 1.15, label: 'Presse ×1.15 (crédibilité)' }
    case 'direct':
      return { value: 1.1, label: 'Direct ×1.1' }
    case 'unknown':
      return { value: 1.0, label: 'Source inconnue ×1.0' }
    case 'paid_ads':
      return { value: 0.95, label: 'Paid ads ×0.95' }
    case 'tiktok':
      return { value: 0.85, label: 'TikTok ×0.85 (bruit social)' }
  }
}

function computeConfidence(behavior: VisitorBehavior): number {
  let c = 0
  if (behavior.pages_viewed.length > 0) c += 0.3
  if (behavior.time_on_site_seconds > 30) c += 0.3
  if (behavior.is_authenticated || behavior.is_returning_visitor) c += 0.2
  if (behavior.has_started_signup_flow) c += 0.2
  return Math.max(0, Math.min(1, c))
}

/**
 * Calcule le score 0-100 d'un visiteur.
 *
 * @example
 * ```ts
 * const behavior = mergeBehaviorWithPageView(
 *   buildEmptyBehavior('sess_123'),
 *   '/tarifs',
 *   120,
 *   70,
 * )
 * const result = computeVisitorScore({
 *   ...behavior,
 *   utm_source: 'organic_search',
 *   has_visited_features: true,
 * })
 * // → { score: ~52, raw_total: ~40, confidence: 0.6, signals: [...] }
 * ```
 */
export function computeVisitorScore(behavior: VisitorBehavior): VisitorScoreResult {
  const signals: VisitorScoreSignal[] = [
    ...signalsForPages(behavior),
    ...signalsForEngagement(behavior),
    ...signalsForActions(behavior),
    ...signalsForReturning(behavior),
    ...signalsForContext(behavior),
  ]

  const subtotal = signals.reduce((sum, s) => sum + s.points, 0)
  const mult = sourceMultiplier(behavior.utm_source)
  const raw_total = subtotal * mult.value

  // Le signal multiplier est ajouté pour la traçabilité (points = delta apporté
  // par le multiplier, arrondi au plus proche entier).
  if (mult.value !== 1) {
    signals.push({
      code: 'source_multiplier',
      label: 'Multiplier source',
      points: Math.round(raw_total - subtotal),
      detail: mult.label,
    })
  }

  const score = Math.max(0, Math.min(100, Math.round(raw_total)))
  const confidence = computeConfidence(behavior)

  return {
    score,
    raw_total: Math.round(raw_total),
    signals,
    confidence,
  }
}
