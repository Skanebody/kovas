/**
 * KOVAS — Système 2 : Email subject auto-optimization — Variant scorer.
 *
 * Pure functions qui scorent les variants de subject d'un template selon les
 * métriques Brevo (sent / opens / clicks / conversions / unsubscribes) et le
 * KPI primaire du template (open_rate | click_rate | conversion_rate).
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §5.
 *
 * Stratégie :
 *   - Composite score pondéré selon le KPI primaire (cf. doc).
 *   - Bonus implicite click_rate calculé sur opens (pas sur sent — sinon
 *     trop dilué).
 *   - Penalty unsubscribe forte (-0.5 à -1.0 selon KPI) pour éviter qu'un
 *     subject sensationnaliste maximise les opens en cramant la liste.
 *   - Confidence sigmoid : 0 à <50 sent, ~1 à >=500 sent (réglée pour Brevo
 *     volume diagnostiqueurs typique).
 *   - Anti divide-by-zero : sent_count = 0 → rates = 0, composite = 0,
 *     confidence = 0 (variant tout neuf, à explorer côté bandit pas scorer).
 *
 * Déterministe, testable, zéro IO. Le caller (Edge Function Supabase) lit
 * les stats Brevo via webhook et appelle ces fonctions pour produire le
 * dashboard admin + déclencher la génération de nouveaux challengers
 * quand un winner s'impose.
 */

export interface VariantStats {
  variant_id: string
  variant_content: string
  sent_count: number
  open_count: number
  click_count: number
  /** Conversion = trial→paid, upsell accepté, click_to_purchase selon template */
  conversion_count: number
  unsubscribe_count: number
  /** ISO timestamp de l'agrégation (pour fenêtre glissante 30j) */
  generated_at: string
}

export interface VariantScore {
  variant_id: string
  /** Sur sent_count */
  open_rate: number
  /** Sur opens (pas sur sent — taux de clic réel des lecteurs) */
  click_rate: number
  /** Sur sent_count */
  conversion_rate: number
  /** Sur sent_count */
  unsubscribe_rate: number
  /** 0-1 pondéré selon primary_kpi */
  composite_score: number
  /** 0-1 sigmoid sur sent_count, exprime la fiabilité statistique */
  confidence: number
}

export type EmailKpi = 'open_rate' | 'click_rate' | 'conversion_rate'

// ---------------------------------------------------------------------------
// Pondérations composite_score par KPI
// ---------------------------------------------------------------------------
//
// Conventions :
//   - composite_score est clampé [0, 1] côté retour.
//   - Les pondérations sont calibrées pour qu'un variant "parfait"
//     (rates max) atteigne ~1.0 sur son KPI primaire.
//   - L'unsubscribe est toujours pénalisant (jamais positif).

const WEIGHTS: Record<
  EmailKpi,
  { open: number; click: number; conversion: number; unsub: number }
> = {
  open_rate: { open: 0.7, click: 0.2, conversion: 0, unsub: -0.5 },
  click_rate: { open: 0.4, click: 0.5, conversion: 0, unsub: -0.5 },
  conversion_rate: { open: 0.2, click: 0.3, conversion: 0.5, unsub: -1.0 },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  const r = numerator / denominator
  if (Number.isNaN(r) || !Number.isFinite(r)) return 0
  return Math.max(0, Math.min(1, r))
}

function clamp01(v: number): number {
  if (Number.isNaN(v) || !Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

/**
 * Sigmoid de confiance basé sur sent_count.
 *
 * Calibration :
 *   - sent = 50    → ~0.09 (très peu de confiance)
 *   - sent = 250   → 0.50 (point d'inflexion)
 *   - sent = 500   → ~0.95 (confiance élevée)
 *   - sent = 1000+ → ~1.00 (confiance maximale)
 *
 * Pour le bandit Thompson : un variant avec confidence < 0.5 reste prioritaire
 * en exploration.
 */
function confidenceFromSent(sent: number): number {
  if (sent <= 0) return 0
  const x = -0.012 * (sent - 250)
  const sig = 1 / (1 + Math.exp(x))
  return clamp01(sig)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score un variant unique selon le KPI primaire du template.
 *
 * @example
 * ```ts
 * const score = scoreVariant(
 *   {
 *     variant_id: 'v1',
 *     variant_content: 'Ton essai termine dans 3 jours',
 *     sent_count: 800,
 *     open_count: 320,
 *     click_count: 80,
 *     conversion_count: 40,
 *     unsubscribe_count: 4,
 *     generated_at: '2026-05-27T12:00:00Z',
 *   },
 *   'conversion_rate',
 * )
 * // → { open_rate: 0.4, click_rate: 0.25, conversion_rate: 0.05,
 * //     unsubscribe_rate: 0.005, composite_score: 0.21, confidence: 0.998 }
 * ```
 */
export function scoreVariant(stats: VariantStats, primary_kpi: EmailKpi): VariantScore {
  // Anti divide-by-zero — variant tout neuf, scores neutres.
  if (stats.sent_count <= 0) {
    return {
      variant_id: stats.variant_id,
      open_rate: 0,
      click_rate: 0,
      conversion_rate: 0,
      unsubscribe_rate: 0,
      composite_score: 0,
      confidence: 0,
    }
  }

  const open_rate = safeRate(stats.open_count, stats.sent_count)
  // click_rate calculé sur opens (CTOR — Click-to-Open Rate). Plus pertinent
  // que click/sent pour évaluer la qualité du subject + body conjointement.
  const click_rate = safeRate(stats.click_count, stats.open_count)
  const conversion_rate = safeRate(stats.conversion_count, stats.sent_count)
  const unsubscribe_rate = safeRate(stats.unsubscribe_count, stats.sent_count)

  const w = WEIGHTS[primary_kpi]
  const composite_raw =
    w.open * open_rate +
    w.click * click_rate +
    w.conversion * conversion_rate +
    w.unsub * unsubscribe_rate

  return {
    variant_id: stats.variant_id,
    open_rate,
    click_rate,
    conversion_rate,
    unsubscribe_rate,
    composite_score: clamp01(composite_raw),
    confidence: confidenceFromSent(stats.sent_count),
  }
}

/**
 * Classe un tableau de variants par composite_score décroissant.
 * Stable : en cas d'égalité, conserve l'ordre d'entrée (utile pour reproductibilité tests).
 */
export function rankVariants(
  stats: ReadonlyArray<VariantStats>,
  primary_kpi: EmailKpi,
): VariantScore[] {
  // Map + index pour tri stable (Array.sort en V8 est stable mais on garantit)
  const scored = stats.map((s, idx) => ({ score: scoreVariant(s, primary_kpi), idx }))
  scored.sort((a, b) => {
    if (b.score.composite_score !== a.score.composite_score) {
      return b.score.composite_score - a.score.composite_score
    }
    // tie-break sur confidence puis index d'origine
    if (b.score.confidence !== a.score.confidence) {
      return b.score.confidence - a.score.confidence
    }
    return a.idx - b.idx
  })
  return scored.map((s) => s.score)
}

/**
 * Retourne les N meilleurs variants (top winners) — utilisé pour seed la
 * génération de nouveaux challengers via Claude (cf. prompts.ts).
 */
export function getTopWinners(
  stats: ReadonlyArray<VariantStats>,
  primary_kpi: EmailKpi,
  count: number,
): VariantScore[] {
  if (count <= 0) return []
  return rankVariants(stats, primary_kpi).slice(0, count)
}
