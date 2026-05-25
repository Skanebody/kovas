/**
 * KOVAS — Algo A1.3.13 : Conformity pattern learning per diagnostician.
 *
 * Pure function qui personnalise le scoring A1.3.3 (conformity_score) en
 * fonction de l'historique d'erreurs du diagnostiqueur. L'idée : un diag
 * qui oublie systématiquement la VMC mérite un warning renforcé sur ce
 * point précis. Un autre qui a un score photo solide ne mérite pas qu'on
 * le harcèle sur le sujet.
 *
 * Trois sorties :
 *   1. category_weights : multiplicateurs 0.5-1.5 par catégorie de check
 *      (à appliquer sur les seuils A1.3.3)
 *   2. personalized_warnings : ≤3 messages contextualisés
 *   3. blind_spots : top 3 catégories où le diag a le plus d'erreurs
 *      historiquement (pour onboarding renforcé)
 *
 * Pure JS, déterministe. Stockage des occurrences dans
 * `internal.diagnostician_pattern_learnings` (déjà créé par data lake
 * migration 20260525170000).
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §A1.3.13.
 */

export type PatternCategory =
  | 'photos_missing'
  | 'photos_low_quality'
  | 'vmc_oublie'
  | 'amiante_pre1997'
  | 'plomb_pre1949'
  | 'electricite_quotas'
  | 'gaz_certificats'
  | 'carrez_surface_mismatch'
  | 'erp_complétude'
  | 'reserves_non_documentees'
  | 'photos_geoloc_manquante'
  | 'consommation_aberrante'
  | 'classe_jump_suspecte'

export interface PatternOccurrence {
  category: PatternCategory
  /** Nombre d'occurrences observées sur les N dernières missions du diag */
  occurrences: number
  /** Nombre total de missions où cette catégorie était applicable */
  applicable_missions: number
}

export interface PatternLearningInput {
  /** Historique des occurrences par catégorie (lu depuis internal.diagnostician_pattern_learnings) */
  history: ReadonlyArray<PatternOccurrence>
  /** Nombre total de missions completed par le diagnostiqueur */
  total_missions: number
  /** Mois écoulés depuis l'inscription */
  months_since_signup: number
}

export interface BlindSpot {
  category: PatternCategory
  error_rate_pct: number
  occurrences: number
  applicable_missions: number
  human_label: string
  recommendation: string
}

export interface PersonalizedWarning {
  category: PatternCategory
  message: string
  severity: 'info' | 'reminder' | 'strong_reminder'
}

export interface PatternLearningResult {
  /** Multiplicateur 0.5-1.5 par catégorie (boost si error_rate haut) */
  category_weights: Record<PatternCategory, number>
  /** Top 3 catégories où le diag a le + d'erreurs */
  blind_spots: ReadonlyArray<BlindSpot>
  /** Warnings personnalisés (max 3) à afficher en pre-export */
  personalized_warnings: ReadonlyArray<PersonalizedWarning>
  /** Confidence 0-1 (basée sur volume de données historiques) */
  confidence: number
  /** Si true, profil trop jeune pour personnalisation → utiliser règles standard */
  use_baseline_only: boolean
}

const HUMAN_LABEL: Record<PatternCategory, string> = {
  photos_missing: 'Photos manquantes sur certaines pièces',
  photos_low_quality: 'Photos de qualité insuffisante',
  vmc_oublie: 'VMC non documentée',
  amiante_pre1997: 'Amiante non systématiquement coché pour < 1997',
  plomb_pre1949: 'Plomb CREP omis pour < 1949',
  electricite_quotas: 'Quotas points contrôle élec incomplets',
  gaz_certificats: 'Certificats gaz manquants',
  carrez_surface_mismatch: 'Surface Carrez vs cadastre',
  erp_complétude: 'ERP partiellement renseigné',
  reserves_non_documentees: 'Réserves énoncées sans détail',
  photos_geoloc_manquante: 'Photos sans géolocalisation',
  consommation_aberrante: 'Consommation kWh saisie hors plage',
  classe_jump_suspecte: 'Écart de classe vs ancien DPE non justifié',
}

const RECOMMENDATION: Record<PatternCategory, string> = {
  photos_missing:
    'Au moins une photo par pièce + une photo générale extérieure. La checklist du module mission le rappelle au moment du capture.',
  photos_low_quality:
    'Vérifiez la luminosité et la netteté. La galerie photo fullscreen détecte les flous (algo A1.3.6).',
  vmc_oublie:
    'La VMC est obligatoire dans le DPE 3CL-2021 même si absente (à déclarer comme "non installée"). Ajoutez-la à votre checklist personnelle.',
  amiante_pre1997:
    'Bâti < 1997 = amiante systématique. KOVAS pré-coche automatiquement, vérifiez avant export.',
  plomb_pre1949:
    'Plomb CREP obligatoire pour < 1949 en cas de vente. Vérifiez que la mention figure dans le dossier.',
  electricite_quotas:
    'Min. 87 points de contrôle pour une installation > 15 ans. La checklist intégrée les rappelle.',
  gaz_certificats:
    'Certificat d\'entretien chaudière à demander au client. Le bouton "Partager vers logiciel" inclut une mention.',
  carrez_surface_mismatch:
    'Cross-check cadastre vs déclaré (algo A1.3.2). Écart > 8% = justifier (annexes, etc.).',
  erp_complétude:
    'ERP doit couvrir TOUS les risques de la commune (Géorisques). KOVAS pré-remplit automatiquement.',
  reserves_non_documentees:
    'Toute réserve doit être justifiée (photo + texte). Le mode "Capture First" force la documentation.',
  photos_geoloc_manquante:
    'Activez la géolocalisation iOS avant la mission. KOVAS associe automatiquement photo et pièce.',
  consommation_aberrante:
    'Vérifiez les plages 3CL-2021 (algo A1.3.9). Conso 250 kWhep/m² = classe D, pas A.',
  classe_jump_suspecte:
    'Si écart ≥ 2 classes avec DPE précédent, joindre les factures de travaux (algo A1.3.1).',
}

function errorRate(o: PatternOccurrence): number {
  if (o.applicable_missions <= 0) return 0
  return o.occurrences / o.applicable_missions
}

function severityForRate(rate: number): 'info' | 'reminder' | 'strong_reminder' {
  if (rate >= 0.4) return 'strong_reminder'
  if (rate >= 0.2) return 'reminder'
  return 'info'
}

function weightForRate(rate: number): number {
  // Pas d'erreur → légère décote (0.8)
  // Erreur moyenne → standard (1.0)
  // Erreur fréquente → boost (1.2-1.5)
  if (rate >= 0.4) return 1.5
  if (rate >= 0.25) return 1.3
  if (rate >= 0.1) return 1.1
  if (rate >= 0.02) return 1.0
  return 0.8
}

function emptyWeights(): Record<PatternCategory, number> {
  const w = {} as Record<PatternCategory, number>
  for (const cat of Object.keys(HUMAN_LABEL) as PatternCategory[]) {
    w[cat] = 1.0
  }
  return w
}

export function computeDiagnosticianPatterns(input: PatternLearningInput): PatternLearningResult {
  // Garde-fou : pas assez de données → use baseline only
  if (input.total_missions < 15 || input.months_since_signup < 2) {
    return {
      category_weights: emptyWeights(),
      blind_spots: [],
      personalized_warnings: [],
      confidence: input.total_missions === 0 ? 0 : 0.3,
      use_baseline_only: true,
    }
  }

  const weights = emptyWeights()
  const allBlindSpots: BlindSpot[] = []

  for (const occ of input.history) {
    const rate = errorRate(occ)
    weights[occ.category] = weightForRate(rate)
    if (rate >= 0.1) {
      allBlindSpots.push({
        category: occ.category,
        error_rate_pct: Math.round(rate * 100),
        occurrences: occ.occurrences,
        applicable_missions: occ.applicable_missions,
        human_label: HUMAN_LABEL[occ.category],
        recommendation: RECOMMENDATION[occ.category],
      })
    }
  }

  // Top 3 blind spots (par error_rate_pct DESC, puis occurrences DESC)
  const topBlindSpots = [...allBlindSpots]
    .sort((a, b) => b.error_rate_pct - a.error_rate_pct || b.occurrences - a.occurrences)
    .slice(0, 3)

  // Personalized warnings (≤ 3) — pour les blind spots reminder/strong
  const personalized: PersonalizedWarning[] = topBlindSpots
    .filter((b) => b.error_rate_pct >= 20)
    .slice(0, 3)
    .map((b) => ({
      category: b.category,
      message: `${b.human_label} — ${b.error_rate_pct}% de vos missions concernées. ${b.recommendation}`,
      severity: severityForRate(b.error_rate_pct / 100),
    }))

  // Confidence : 0.5-0.95 selon le volume de données
  // 15 missions → 0.5 | 30 → 0.7 | 60+ → 0.9 | 100+ → 0.95
  const confidence = Math.min(0.95, 0.3 + Math.min(0.65, (input.total_missions / 100) * 0.65))

  return {
    category_weights: weights,
    blind_spots: topBlindSpots,
    personalized_warnings: personalized,
    confidence: Math.round(confidence * 100) / 100,
    use_baseline_only: false,
  }
}

/**
 * Helper : applique les category_weights aux anomalies/opportunities de A1.3.3.
 * Convention : un weight > 1.0 boost la sévérité (warning → critical) si
 * applicable, un weight < 1.0 retrograde info → silencer (filter out).
 */
export function applyPatternWeightsToAnomalies<
  T extends { category?: string; severity: 'info' | 'warning' | 'critical' },
>(anomalies: ReadonlyArray<T>, weights: Record<string, number>): T[] {
  return anomalies
    .map((a) => {
      const raw = a.category ? weights[a.category] : 1.0
      const w: number = typeof raw === 'number' ? raw : 1.0
      if (w >= 1.3 && a.severity === 'warning') {
        return { ...a, severity: 'critical' as const }
      }
      if (w >= 1.3 && a.severity === 'info') {
        return { ...a, severity: 'warning' as const }
      }
      if (w < 0.9 && a.severity === 'info') {
        return null // filter out — diag historiquement solide sur ce point
      }
      return a
    })
    .filter((a): a is T => a !== null)
}
