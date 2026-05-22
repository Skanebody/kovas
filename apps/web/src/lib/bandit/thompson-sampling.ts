/**
 * Thompson Sampling — bandit multi-armed Beta-Bernoulli.
 *
 * Pour chaque arm (diagnostiqueur), on tire p ~ Beta(α, β), puis on trie
 * les arms par p décroissant. α = 1 + succès, β = 1 + échecs.
 *
 * Avantages vs ε-greedy / UCB :
 *  - Explore proportionnellement à l'incertitude (variance Beta)
 *  - Pas d'hyperparamètre à régler (ε, c, …)
 *  - Convergence prouvée vers la politique optimale
 *
 * Sampling Beta via deux Gamma(α, 1) et Gamma(β, 1) :
 *   X ~ Gamma(α), Y ~ Gamma(β)  →  X / (X + Y) ~ Beta(α, β)
 *
 * Gamma sampling : Marsaglia & Tsang (2000) — méthode robuste pour α ≥ 1.
 * Pour α < 1 on remonte au cas α + 1 puis multiplie par U^(1/α).
 */

export interface ArmStats {
  alpha: number
  beta: number
}

export interface ThompsonOptions {
  /**
   * Seuil d'impressions sous lequel l'arm est considéré "warm" (cold start).
   * Les arms warm sont injectés en force dans le top via `applyColdStart`.
   */
  coldStartThreshold?: number
  /**
   * Multiplicateur appliqué au sample pour favoriser l'exploration globale.
   * Valeur > 1 augmente la variance perçue (rarement utile : Beta gère seul).
   */
  explorationBoost?: number
  /**
   * RNG injectable pour tests déterministes.
   */
  rng?: () => number
}

/**
 * Sample une distribution Gamma(shape, 1) — méthode Marsaglia & Tsang.
 * @param shape — paramètre k (alpha), doit être > 0
 * @param rng — générateur uniforme [0, 1)
 */
export function sampleGamma(shape: number, rng: () => number = Math.random): number {
  if (shape <= 0) {
    throw new Error(`sampleGamma: shape must be > 0, got ${shape}`)
  }

  // Cas α < 1 : Ahrens-Dieter via boost.
  if (shape < 1) {
    const u = rng()
    return sampleGamma(shape + 1, rng) * u ** (1 / shape)
  }

  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)

  // Boucle Marsaglia-Tsang
  // En théorie convergence en < 5 itérations en moyenne.
  // Garde-fou : 1000 itérations max pour éviter loop infini sur RNG dégénéré.
  for (let i = 0; i < 1000; i++) {
    let x: number
    let v: number
    // Box-Muller pour standard normal
    do {
      const u1 = Math.max(rng(), Number.EPSILON)
      const u2 = rng()
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      v = 1 + c * x
    } while (v <= 0)

    v = v * v * v
    const u = rng()

    if (u < 1 - 0.0331 * x ** 4) {
      return d * v
    }
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v
    }
  }

  // Fallback (ne devrait jamais arriver) : moyenne théorique
  return d
}

/**
 * Sample une distribution Beta(α, β) ∈ [0, 1].
 */
export function sampleBeta(alpha: number, beta: number, rng: () => number = Math.random): number {
  if (alpha <= 0 || beta <= 0) {
    throw new Error(`sampleBeta: alpha and beta must be > 0, got α=${alpha}, β=${beta}`)
  }
  const x = sampleGamma(alpha, rng)
  const y = sampleGamma(beta, rng)
  const sum = x + y
  if (sum === 0) return 0.5 // garde-fou théorique
  return x / sum
}

/**
 * Espérance E[Beta(α, β)] = α / (α + β). Utile pour debug / display.
 */
export function expectedBeta(alpha: number, beta: number): number {
  return alpha / (alpha + beta)
}

/**
 * Rank une liste d'arms par Thompson sampling — ordre décroissant de p tiré.
 *
 * @example
 *   const ranked = rankArms([
 *     { armId: 'a', stats: { alpha: 10, beta: 2 } },  // forte conv
 *     { armId: 'b', stats: { alpha: 1, beta: 1 } },   // jamais vu
 *     { armId: 'c', stats: { alpha: 3, beta: 7 } },   // faible conv
 *   ])
 *   // → a sera quasi toujours top, b souvent dans top 2 (exploration), c rarement
 */
export function rankArms<T extends { armId: string; stats: ArmStats }>(
  arms: ReadonlyArray<T>,
  options: ThompsonOptions = {},
): T[] {
  const { explorationBoost = 1, rng = Math.random } = options
  return arms
    .map((arm) => ({
      arm,
      sample: sampleBeta(arm.stats.alpha, arm.stats.beta, rng) * explorationBoost,
    }))
    .sort((a, b) => b.sample - a.sample)
    .map(({ arm }) => arm)
}

/**
 * Sépare les arms "warm" (cold start, peu d'impressions) des arms "established".
 * Permet une politique top-N qui injecte forcément X warm arms dans le top.
 */
export function partitionWarmEstablished<
  T extends { armId: string; stats: ArmStats; impressions?: number },
>(arms: ReadonlyArray<T>, coldStartThreshold: number): { warm: T[]; established: T[] } {
  const warm: T[] = []
  const established: T[] = []
  for (const arm of arms) {
    const impressions = arm.impressions ?? Math.max(0, arm.stats.alpha + arm.stats.beta - 2)
    if (impressions < coldStartThreshold) {
      warm.push(arm)
    } else {
      established.push(arm)
    }
  }
  return { warm, established }
}

/**
 * Top-N ranker avec injection cold-start :
 *  - les warm arms sont rankés par Thompson sampling et reçoivent au moins
 *    `warmSlots` places parmi les top N (typiquement 1-2 sur top 10) ;
 *  - les established arms remplissent le reste.
 *
 * Si pas assez de warm arms pour combler `warmSlots`, les established
 * comblent les places restantes.
 */
export function rankWithColdStart<
  T extends { armId: string; stats: ArmStats; impressions?: number },
>(
  arms: ReadonlyArray<T>,
  options: ThompsonOptions & { topN: number; warmSlots?: number } = { topN: 10 },
): T[] {
  const { topN, warmSlots = 2, coldStartThreshold = 50, rng = Math.random } = options
  const { warm, established } = partitionWarmEstablished(arms, coldStartThreshold)

  const rankedWarm = rankArms(warm, { rng })
  const rankedEstablished = rankArms(established, { rng })

  // 1. Place jusqu'à `warmSlots` warm arms
  const warmPick = rankedWarm.slice(0, Math.min(warmSlots, topN))
  const remainingSlots = topN - warmPick.length

  // 2. Complète avec established
  const establishedPick = rankedEstablished.slice(0, remainingSlots)

  // 3. Si pas assez established, on reprend du warm
  const stillMissing = topN - warmPick.length - establishedPick.length
  const extraWarm = rankedWarm.slice(warmPick.length, warmPick.length + stillMissing)

  // 4. Mélange déterministe : les warm sont interleavés (positions 0 et 5 typiquement)
  return interleave(warmPick, [...establishedPick, ...extraWarm], topN)
}

/**
 * Interleave deux listes en répartissant la 1re uniformément dans la 2e.
 * Garantie : la position des warm arms reste imprévisible aux scrapers
 * tout en restant déterministe pour une exécution donnée.
 */
function interleave<T>(injected: T[], base: T[], totalLen: number): T[] {
  if (injected.length === 0) return base.slice(0, totalLen)
  if (base.length === 0) return injected.slice(0, totalLen)
  const result: T[] = []
  const step = Math.max(1, Math.floor(totalLen / (injected.length + 1)))
  let injectedIdx = 0
  let baseIdx = 0
  for (let i = 0; i < totalLen; i++) {
    if (injectedIdx < injected.length && i > 0 && i % step === 0 && baseIdx < base.length) {
      const item = injected[injectedIdx]
      if (item !== undefined) result.push(item)
      injectedIdx++
    } else if (baseIdx < base.length) {
      const item = base[baseIdx]
      if (item !== undefined) result.push(item)
      baseIdx++
    } else if (injectedIdx < injected.length) {
      const item = injected[injectedIdx]
      if (item !== undefined) result.push(item)
      injectedIdx++
    }
  }
  return result
}
