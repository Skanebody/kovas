/**
 * KOVAS — Système 2 : Email subject auto-optimization — Variant selector.
 *
 * Multi-armed bandit Thompson sampling pour choisir le prochain subject à
 * envoyer parmi les variants en compétition. À chaque envoi, on tire une
 * réalisation Beta(successes+1, trials-successes+1) pour chaque bras (variant)
 * et on sélectionne celui qui maximise le tirage.
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §5.
 *
 * Stratégie :
 *   - Beta(α, β) sampling via somme de log-gammas Marsaglia-Tsang n'est PAS
 *     nécessaire ici — on utilise l'identité :
 *       Beta(α, β) = X / (X + Y) où X ~ Gamma(α, 1), Y ~ Gamma(β, 1)
 *     et Gamma(k, 1) ≈ -ln(prod(uniform_k)) pour k entier (notre cas).
 *   - Pour des α, β potentiellement non-entiers, on approxime via Marsaglia &
 *     Tsang 2000 (rejection method).
 *   - Cold start : tous trials = 0 → reason='cold_start', round-robin (premier).
 *   - Conclusion : winner_prob >= 0.95 + min_trials atteints → bandit conclu.
 *
 * Déterministe avec random_fn injectée (utile pour tests). En prod, random_fn
 * = Math.random.
 *
 * Pure functions, zéro IO.
 */

export interface BanditVariant {
  id: string
  content: string
  /** Nombre de succès observés (opens OU clicks OU conversions selon KPI) */
  successes: number
  /** Nombre d'essais totaux (sent_count) */
  trials: number
}

export interface SelectionResult {
  selected_id: string
  selected_content: string
  reason: 'exploration' | 'exploitation' | 'cold_start'
  /** Valeur Beta samplée (pour audit/log) */
  sample_value: number
}

// ---------------------------------------------------------------------------
// Gamma + Beta sampling
// ---------------------------------------------------------------------------

/**
 * Sample Gamma(shape, 1) via Marsaglia & Tsang 2000 (rejection method).
 * Fonctionne pour shape > 0. Pour shape < 1, on applique le boosting
 * `Gamma(k) = Gamma(k+1) * U^(1/k)` (cf. Marsaglia-Tsang §3).
 */
function sampleGamma(shape: number, randomFn: () => number): number {
  if (shape <= 0) return 0
  if (shape < 1) {
    // Boosting trick
    const g = sampleGamma(shape + 1, randomFn)
    const u = Math.max(Number.EPSILON, randomFn())
    return g * u ** (1 / shape)
  }
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  // Marsaglia rejection loop — termine en pratique en 1-2 itérations
  for (let i = 0; i < 100; i++) {
    let x = 0
    let v = 0
    // Sample normal via Box-Muller
    do {
      const u1 = Math.max(Number.EPSILON, randomFn())
      const u2 = randomFn()
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = randomFn()
    if (u < 1 - 0.0331 * x ** 4) {
      return d * v
    }
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v
    }
  }
  // Fallback (très rare) — moyenne
  return d
}

/**
 * Sample Beta(alpha, beta) ∈ [0, 1].
 */
function sampleBeta(alpha: number, beta: number, randomFn: () => number): number {
  const x = sampleGamma(alpha, randomFn)
  const y = sampleGamma(beta, randomFn)
  const denom = x + y
  if (denom <= 0) return 0.5
  return x / denom
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

/**
 * Sélectionne le prochain variant à envoyer via Thompson sampling.
 *
 * @param variants - Tous les variants en compétition (au moins 1).
 * @param random_fn - Generator (default Math.random — injectable pour tests).
 *
 * @example
 * ```ts
 * const result = selectVariant([
 *   { id: 'v1', content: 'Ton essai termine dans 3 jours', successes: 120, trials: 400 },
 *   { id: 'v2', content: 'On débite ta carte le 30', successes: 90, trials: 400 },
 *   { id: 'v3', content: 'Encore 3 jours pour tester KOVAS', successes: 80, trials: 400 },
 * ])
 * // → { selected_id: 'v1', reason: 'exploration' | 'exploitation', ... }
 * ```
 */
export function selectVariant(
  variants: ReadonlyArray<BanditVariant>,
  random_fn: () => number = Math.random,
): SelectionResult {
  if (variants.length === 0) {
    throw new Error('selectVariant: empty variants array')
  }

  // Cold start : tous les variants ont trials = 0 → round-robin (premier).
  const allCold = variants.every((v) => v.trials === 0)
  if (allCold) {
    const first = variants[0]
    if (!first) {
      throw new Error('selectVariant: empty variants array')
    }
    return {
      selected_id: first.id,
      selected_content: first.content,
      reason: 'cold_start',
      sample_value: 0,
    }
  }

  // Thompson sampling : tire Beta pour chaque variant et garde max.
  let bestIdx = 0
  let bestSample = -1
  const samples: number[] = []
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]
    if (!v) continue
    const alpha = v.successes + 1
    const beta = Math.max(1, v.trials - v.successes + 1)
    const sample = sampleBeta(alpha, beta, random_fn)
    samples.push(sample)
    if (sample > bestSample) {
      bestSample = sample
      bestIdx = i
    }
  }

  const selected = variants[bestIdx]
  if (!selected) {
    throw new Error('selectVariant: unable to select variant')
  }

  // Approxime la probabilité de gagner du best : ratio sample vs second best.
  // Si l'écart est large + trials suffisants → exploitation.
  // Sinon → exploration.
  const sortedSamples = [...samples].sort((a, b) => b - a)
  const top = sortedSamples[0] ?? 0
  const second = sortedSamples[1] ?? 0
  const gap = top - second
  // Heuristique simple : si le top est franchement détaché ET trials >= 100,
  // c'est qu'on est en exploitation (le bandit a convergé sur son favori).
  const reason: 'exploration' | 'exploitation' =
    gap > 0.1 && selected.trials >= 100 ? 'exploitation' : 'exploration'

  return {
    selected_id: selected.id,
    selected_content: selected.content,
    reason,
    sample_value: bestSample,
  }
}

// ---------------------------------------------------------------------------
// Win probability (Monte Carlo)
// ---------------------------------------------------------------------------

export interface WinProbabilityResult {
  max_winner_id: string
  max_probability: number
  total_trials: number
}

/**
 * Estime la probabilité qu'un variant soit le meilleur, par Monte Carlo.
 * Pour chaque itération, on sample chaque variant et on compte celui qui gagne.
 *
 * @param variants - Variants en compétition.
 * @param iterations - Nombre de tirages MC (default 1000).
 * @param random_fn - Generator (default Math.random).
 */
export function computeWinProbability(
  variants: ReadonlyArray<BanditVariant>,
  iterations = 1000,
  random_fn: () => number = Math.random,
): WinProbabilityResult {
  if (variants.length === 0) {
    throw new Error('computeWinProbability: empty variants array')
  }

  const first = variants[0]
  if (!first) {
    throw new Error('computeWinProbability: empty variants array')
  }

  if (iterations <= 0) {
    return {
      max_winner_id: first.id,
      max_probability: 0,
      total_trials: 0,
    }
  }

  const wins = new Array<number>(variants.length).fill(0)
  for (let iter = 0; iter < iterations; iter++) {
    let bestIdx = 0
    let bestSample = -1
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i]
      if (!v) continue
      const alpha = v.successes + 1
      const beta = Math.max(1, v.trials - v.successes + 1)
      const sample = sampleBeta(alpha, beta, random_fn)
      if (sample > bestSample) {
        bestSample = sample
        bestIdx = i
      }
    }
    const winCount = wins[bestIdx] ?? 0
    wins[bestIdx] = winCount + 1
  }

  let maxIdx = 0
  let maxWins = -1
  for (let i = 0; i < wins.length; i++) {
    const w = wins[i] ?? 0
    if (w > maxWins) {
      maxWins = w
      maxIdx = i
    }
  }

  const totalTrials = variants.reduce((sum, v) => sum + v.trials, 0)
  const winner = variants[maxIdx] ?? first

  return {
    max_winner_id: winner.id,
    max_probability: maxWins / iterations,
    total_trials: totalTrials,
  }
}

/**
 * Conclut si le bandit a convergé sur un winner statistiquement robuste.
 * Critères : winner_prob >= threshold ET sum(trials) >= min_trials.
 *
 * @param threshold - Probabilité minimum du winner (default 0.95).
 * @param min_trials - Sent_count cumulé minimum (default 1000).
 */
export function shouldConcludeBandit(
  variants: ReadonlyArray<BanditVariant>,
  threshold = 0.95,
  min_trials = 1000,
): boolean {
  if (variants.length <= 1) return true
  const totalTrials = variants.reduce((sum, v) => sum + v.trials, 0)
  if (totalTrials < min_trials) return false
  // Utilise Math.random pour la conclusion — assume que le caller veut un
  // verdict robuste plutôt que parfaitement déterministe. Si besoin de tests
  // déterministes : injecter via computeWinProbability + check manuel.
  const result = computeWinProbability(variants, 2000, Math.random)
  return result.max_probability >= threshold
}
