/**
 * KOVAS — Calculateur DPE gratuit (Lot #143)
 *
 * Moteur d'estimation client-side. À partir des 8 réponses, calcule un score
 * 0-100 (100 = A, 0 = G) en pondérant les facteurs métier, puis renvoie la
 * classe énergétique probable + facteurs explicatifs.
 *
 * Pondérations (somme = 100%) :
 *   - Année de construction : 30%
 *   - Mode de chauffage : 25%
 *   - Isolation déclarée : 25%
 *   - Surface : 10%
 *   - DPE déjà connu (baseline) : 10%
 *
 * Implémentation : on calcule un score à partir d'une baseline (50 ou DPE
 * existant) auquel on applique les deltas pondérés des autres dimensions.
 *
 * IMPORTANT : ce calcul N'EST PAS un calcul 3CL-2021 (méthode ADEME, Phase 2).
 * Il s'agit d'une estimation indicative non opposable, à des fins de qualification
 * de lead — l'avis client final reste : "consultez un diagnostiqueur certifié".
 */

import { classToScore, scoreToClass } from './energy-class-mapper'
import type {
  CalculatorAnswers,
  DpeClass,
  HeatingType,
  IsolationLevel,
  YearBucket,
} from './question-tree'

export interface EstimationFactor {
  /** Code interne stable (pour analytics) */
  code: string
  /** Label humain SOBRE — affiché dans la result card */
  label: string
}

export interface EstimationResult {
  /** Classe énergétique estimée A-G */
  estimatedClass: DpeClass
  /** Score brut 0-100 (clampé) — utile pour audit + dégradé visuel */
  score: number
  /** Niveau de confiance 0-100 (pondéré par le nombre d'inconnues). */
  confidence: number
  /** Facteurs ayant un impact positif sur la perf énergétique */
  positive: EstimationFactor[]
  /** Facteurs ayant un impact négatif sur la perf énergétique */
  negative: EstimationFactor[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-scores par dimension (chacun renvoie un Δ -40..+40 relativement à 50)
// ─────────────────────────────────────────────────────────────────────────────

interface SubScore {
  /** Delta appliqué sur la baseline 50 (signed, typiquement -30..+40) */
  delta: number
  /** Facteur explicatif si l'impact est notable */
  factor: EstimationFactor | null
  /** Sens du facteur — pour répartir positive/negative */
  direction: 'positive' | 'negative' | 'neutral'
}

const NEUTRAL: SubScore = { delta: 0, factor: null, direction: 'neutral' }

/** Année de construction (poids 30%). */
function scoreYear(bucket: YearBucket | null): SubScore {
  if (!bucket) return NEUTRAL

  const map: Record<YearBucket, { delta: number; positive: boolean; label: string }> = {
    before_1948: {
      delta: -25,
      positive: false,
      label: 'Construction antérieure à 1948 (peu d’isolation d’origine)',
    },
    '1948_1974': {
      delta: -15,
      positive: false,
      label: 'Construction 1948-1974 (avant 1ère réglementation thermique)',
    },
    '1975_1989': {
      delta: -5,
      positive: false,
      label: 'Construction 1975-1989 (RT 1974 limitée)',
    },
    '1990_2000': { delta: 5, positive: true, label: 'Construction 1990-2000 (RT 1988)' },
    '2001_2012': { delta: 15, positive: true, label: 'Construction 2001-2012 (RT 2005)' },
    '2013_2020': {
      delta: 30,
      positive: true,
      label: 'Construction récente (RT 2012, BBC compatible)',
    },
    after_2020: {
      delta: 40,
      positive: true,
      label: 'Construction post-2020 (RE2020, performance élevée)',
    },
  }

  const entry = map[bucket]
  return {
    delta: entry.delta,
    factor: { code: `year:${bucket}`, label: entry.label },
    direction: entry.positive ? 'positive' : 'negative',
  }
}

/** Mode de chauffage (poids 25%). */
function scoreHeating(heating: HeatingType | null): SubScore {
  if (!heating) return NEUTRAL

  const map: Record<HeatingType, { delta: number; positive: boolean; label: string }> = {
    pompe_chaleur: {
      delta: 30,
      positive: true,
      label: 'Pompe à chaleur (rendement énergétique élevé)',
    },
    bois: {
      delta: 20,
      positive: true,
      label: 'Chauffage bois / granulés (énergie renouvelable)',
    },
    reseau_chaleur: {
      delta: 10,
      positive: true,
      label: 'Réseau de chaleur urbain (mix vertueux fréquent)',
    },
    gaz: { delta: 5, positive: true, label: 'Chauffage gaz (rendement correct)' },
    electricite: {
      delta: -10,
      positive: false,
      label: 'Chauffage électrique direct (coefficient 2,3 pénalisant)',
    },
    autre: { delta: 0, positive: true, label: 'Mode de chauffage atypique (non-classifié)' },
    fioul: {
      delta: -30,
      positive: false,
      label: 'Chauffage fioul (forte intensité carbone)',
    },
  }

  const entry = map[heating]
  return {
    delta: entry.delta,
    factor: { code: `heating:${heating}`, label: entry.label },
    direction:
      entry.delta > 0 ? 'positive' : entry.delta < 0 ? 'negative' : 'neutral',
  }
}

/** Isolation déclarée (poids 25%). */
function scoreIsolation(level: IsolationLevel | null): SubScore {
  if (!level) return NEUTRAL

  const map: Record<IsolationLevel, { delta: number; label: string | null }> = {
    tres_bonne: { delta: 30, label: 'Isolation déclarée très bonne' },
    bonne: { delta: 15, label: 'Isolation déclarée bonne' },
    moyenne: { delta: 0, label: null },
    mauvaise: { delta: -25, label: 'Isolation déclarée faible' },
    inconnue: { delta: -5, label: null },
  }

  const entry = map[level]
  if (entry.label === null) return { delta: entry.delta, factor: null, direction: 'neutral' }

  return {
    delta: entry.delta,
    factor: { code: `isolation:${level}`, label: entry.label },
    direction: entry.delta > 0 ? 'positive' : 'negative',
  }
}

/** Surface (poids 10%). Volumes extrêmes pénalisés. */
function scoreSurface(surface: number | null): SubScore {
  if (typeof surface !== 'number' || surface < 8) return NEUTRAL

  if (surface > 200) {
    return {
      delta: -5,
      factor: {
        code: 'surface:large',
        label: 'Grande surface (>200 m²) — déperditions accrues',
      },
      direction: 'negative',
    }
  }

  // Petit / standard : neutre
  return NEUTRAL
}

/**
 * Calcule le score global pondéré à partir des sous-scores.
 *
 * Stratégie :
 *   - Baseline 50 (équivalent classe D).
 *   - Chaque sous-score apporte `delta * poids` au score final.
 *   - Si l'utilisateur a déclaré sa classe DPE actuelle, on prend cette valeur
 *     comme baseline (au lieu de 50) avec un poids de 10%.
 *
 * Le score final est clampé 0-100.
 */
function combineScores(answers: CalculatorAnswers): {
  rawScore: number
  subscores: { code: string; sub: SubScore }[]
} {
  const yearSub = scoreYear(answers.year_bucket)
  const heatingSub = scoreHeating(answers.heating)
  const isolationSub = scoreIsolation(answers.isolation)
  const surfaceSub = scoreSurface(answers.surface_m2)

  // Baseline 50 ou baseline DPE existant si déclaré
  let baseline = 50
  const existing = answers.existing_dpe
  if (existing && existing.known === true && existing.value) {
    baseline = classToScore(existing.value)
  }

  // Poids : year 30%, heating 25%, isolation 25%, surface 10%, baseline implicite 10%
  // (la baseline DPE existant joue déjà via le point de départ)
  const score =
    baseline +
    yearSub.delta * 0.3 +
    heatingSub.delta * 0.25 +
    isolationSub.delta * 0.25 +
    surfaceSub.delta * 0.1

  return {
    rawScore: Math.max(0, Math.min(100, score)),
    subscores: [
      { code: 'year', sub: yearSub },
      { code: 'heating', sub: heatingSub },
      { code: 'isolation', sub: isolationSub },
      { code: 'surface', sub: surfaceSub },
    ],
  }
}

/**
 * Calcule la confiance 0-100 basée sur les inconnues fournies par l'utilisateur.
 * Plus il y a d'"inconnu" ou de réponses imprécises, plus la confiance baisse.
 */
function computeConfidence(answers: CalculatorAnswers): number {
  let conf = 100
  if (answers.isolation === 'inconnue') conf -= 20
  const existing = answers.existing_dpe
  if (!existing) conf -= 5
  else if (existing.known === 'unsure' || (existing.known === true && !existing.value)) {
    conf -= 10
  }
  if (!answers.year_bucket) conf -= 15
  if (!answers.heating) conf -= 15
  // Surface manquante ou hors range → -10
  if (typeof answers.surface_m2 !== 'number' || answers.surface_m2 < 8) conf -= 10
  return Math.max(20, Math.min(100, conf))
}

/**
 * Point d'entrée principal — appelé par le composant `result-card.tsx`.
 *
 * Accepte un `CalculatorAnswers` (idéalement complet) et renvoie une
 * `EstimationResult` exploitable directement par l'UI + envoyée dans
 * `factors_json` à l'API server-side.
 */
export function estimateEnergyClass(answers: CalculatorAnswers): EstimationResult {
  const { rawScore, subscores } = combineScores(answers)
  const estimatedClass = scoreToClass(rawScore)
  const confidence = computeConfidence(answers)

  const positive: EstimationFactor[] = []
  const negative: EstimationFactor[] = []

  for (const { sub } of subscores) {
    if (!sub.factor) continue
    if (sub.direction === 'positive') positive.push(sub.factor)
    else if (sub.direction === 'negative') negative.push(sub.factor)
  }

  // On limite chaque liste à 3 facteurs pour rester lisible (priorité aux
  // facteurs de plus gros impact — ils sont déjà dans l'ordre de scan).
  return {
    estimatedClass,
    score: Math.round(rawScore),
    confidence,
    positive: positive.slice(0, 3),
    negative: negative.slice(0, 3),
  }
}
