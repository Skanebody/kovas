/**
 * KOVAS — Algo A1.3.9 : Production anomaly detection.
 *
 * Pure function qui détecte les anomalies dans un DPE en cours de production,
 * AVANT envoi à l'ADEME. Quatre familles d'anomalies :
 *
 *   1. Classe déclarée incohérente avec la distribution locale
 *      (ex: classe A sur immeuble Haussmannien 1880 → outlier)
 *
 *   2. Consommation énergétique aberrante par rapport au type/surface/classe
 *      (ex: classe A = ≤ 70 kWhep/m²/an, donc déclarer 250 → erreur)
 *
 *   3. Incohérence DPE ↔ GES (gros écart entre étiquette énergie et émissions)
 *      (ex: classe A énergie + classe G GES = quasi impossible physiquement)
 *
 *   4. Mismatch avec ancien DPE de la parcelle (jump ≥ 2 classes)
 *      → signal A1.3.1 DPE shopping potentiel
 *
 * Sortie : { anomalies, severity, recommended_action }.
 *
 * Pure JS, déterministe, zéro IO. Les statistiques de référence sont
 * embarquées (seuils 3CL-2021 + percentiles ADEME nationaux).
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §A1.3.9.
 */

export type DpeClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
export type AnomalySeverity = 'info' | 'warning' | 'critical'

export interface ProductionAnomalyInput {
  /** Classe énergie déclarée par le diagnostiqueur */
  declared_energy_class: DpeClass
  /** Classe GES déclarée par le diagnostiqueur */
  declared_ges_class: DpeClass
  /** Consommation primaire kWhep/m²/an déclarée */
  declared_consumption_kwhep_m2_year: number | null
  /** Surface (m²) */
  surface_m2: number | null
  /** Type de bien */
  property_type: 'maison' | 'appartement' | 'autre'
  /** Année de construction */
  year_built: number | null
  /** Classe énergie d'un ancien DPE sur la même parcelle (algo A1.3.1) */
  previous_dpe_class_same_parcel: DpeClass | null
  /** Mois écoulés depuis l'ancien DPE (null si aucun) */
  months_since_previous_dpe: number | null
  /** % de passoires (F/G) sur la commune — proxy distribution locale */
  commune_passoires_pct: number | null
}

export interface AnomalyFinding {
  code:
    | 'CONSUMPTION_INCOHERENT_WITH_CLASS'
    | 'GES_ENERGY_GAP_HIGH'
    | 'PREVIOUS_DPE_BIG_JUMP'
    | 'LOCAL_DISTRIBUTION_OUTLIER'
    | 'PRE_1949_CLASS_A_OR_B_SUSPECT'
    | 'SURFACE_NULL'
  severity: AnomalySeverity
  message: string
  details: string
}

export interface ProductionAnomalyResult {
  /** Anomalies détectées (peut être vide) */
  anomalies: ReadonlyArray<AnomalyFinding>
  /** Sévérité maximale parmi les anomalies (ou 'info' si vide) */
  worst_severity: AnomalySeverity
  /** Bloquer la publication ? (true si >= 1 critical) */
  block_publication: boolean
  /** Recommandation lisible pour le diagnostiqueur */
  recommended_action: 'publish' | 'review' | 'justify_before_publish' | 'rework'
  /** Message global synthétique */
  human_message: string
}

// Plages 3CL-2021 (kWhep/m²/an, énergie primaire) — source : décret 2021-1104.
const CLASS_CONSUMPTION_RANGES: Record<DpeClass, { min: number; max: number }> = {
  A: { min: 0, max: 70 },
  B: { min: 71, max: 110 },
  C: { min: 111, max: 180 },
  D: { min: 181, max: 250 },
  E: { min: 251, max: 330 },
  F: { min: 331, max: 420 },
  G: { min: 421, max: 10000 }, // pas de plafond officiel
}

function classIndex(c: DpeClass): number {
  return { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6 }[c]
}

function classGap(a: DpeClass, b: DpeClass): number {
  return Math.abs(classIndex(a) - classIndex(b))
}

/**
 * Anomalie #1 : consommation incohérente avec la classe déclarée.
 */
function checkConsumptionVsClass(input: ProductionAnomalyInput): AnomalyFinding | null {
  const conso = input.declared_consumption_kwhep_m2_year
  if (conso == null) return null
  const range = CLASS_CONSUMPTION_RANGES[input.declared_energy_class]
  // Tolérance 10% sur les bornes basses, 5% sur les bornes hautes
  const tolMin = range.min === 0 ? 0 : range.min * 0.9
  const tolMax = range.max === 10000 ? 10000 : range.max * 1.05
  if (conso < tolMin || conso > tolMax) {
    return {
      code: 'CONSUMPTION_INCOHERENT_WITH_CLASS',
      severity: 'critical',
      message: `Consommation ${conso} kWhep/m²/an incompatible avec la classe ${input.declared_energy_class}.`,
      details: `Plage 3CL-2021 pour ${input.declared_energy_class} : ${range.min}–${range.max} kWhep/m²/an. Vérifiez le calcul moteur ADEME avant publication.`,
    }
  }
  return null
}

/**
 * Anomalie #2 : écart énergie ↔ GES anormalement grand.
 */
function checkGesEnergyGap(input: ProductionAnomalyInput): AnomalyFinding | null {
  const gap = classGap(input.declared_energy_class, input.declared_ges_class)
  if (gap >= 4) {
    return {
      code: 'GES_ENERGY_GAP_HIGH',
      severity: gap >= 5 ? 'critical' : 'warning',
      message: `Écart énergie ↔ GES inhabituel (${gap} classes : énergie ${input.declared_energy_class}, GES ${input.declared_ges_class}).`,
      details:
        "Un écart de 4+ classes est physiquement rare. Possible erreur sur le coefficient d'émission CO₂ par énergie. Vérifiez le système de chauffage saisi.",
    }
  }
  return null
}

/**
 * Anomalie #3 : ancien DPE sur même parcelle avec écart fort.
 */
function checkPreviousDpeJump(input: ProductionAnomalyInput): AnomalyFinding | null {
  const prev = input.previous_dpe_class_same_parcel
  const months = input.months_since_previous_dpe
  if (!prev || months == null) return null
  const gap = classGap(input.declared_energy_class, prev)
  // Travaux significatifs en < 24 mois peuvent faire bouger de 2-3 classes
  // mais 4+ classes sans travaux documentés = très suspect
  if (gap >= 2 && months < 24) {
    const severity: AnomalySeverity = gap >= 4 ? 'critical' : gap >= 3 ? 'warning' : 'info'
    return {
      code: 'PREVIOUS_DPE_BIG_JUMP',
      severity,
      message: `Écart de ${gap} classe(s) avec un DPE de ${months} mois (parcelle).`,
      details: `Ancien DPE : ${prev}. Nouveau : ${input.declared_energy_class}. Sans travaux documentés (factures), risque de signalement ADEME.`,
    }
  }
  return null
}

/**
 * Anomalie #4 : classe A ou B sur bien d'avant 1949 (Haussmannien, ancien rural).
 */
function checkPre1949ClassAB(input: ProductionAnomalyInput): AnomalyFinding | null {
  if (
    input.year_built != null &&
    input.year_built < 1949 &&
    (input.declared_energy_class === 'A' || input.declared_energy_class === 'B')
  ) {
    return {
      code: 'PRE_1949_CLASS_A_OR_B_SUSPECT',
      severity: 'warning',
      message: `Classe ${input.declared_energy_class} sur bien construit en ${input.year_built}.`,
      details:
        'Atteindre classe A ou B sur bâti antérieur 1949 nécessite généralement une rénovation lourde documentée (isolation, double-flux, ENR). Vérifiez la cohérence.',
    }
  }
  return null
}

/**
 * Anomalie #5 : classe trop éloignée de la distribution locale.
 */
function checkLocalDistribution(input: ProductionAnomalyInput): AnomalyFinding | null {
  const pct = input.commune_passoires_pct
  if (pct == null) return null
  // Si la commune a >40% de passoires et qu'on déclare A/B sans contexte précis
  if (pct > 40 && (input.declared_energy_class === 'A' || input.declared_energy_class === 'B')) {
    return {
      code: 'LOCAL_DISTRIBUTION_OUTLIER',
      severity: 'info',
      message: `Classe ${input.declared_energy_class} dans une commune à ${Math.round(pct)}% de passoires (F/G).`,
      details:
        'La majorité du parc local est en F/G. Une classe A/B est possible (rénovation récente) mais doit être justifiée par les travaux saisis.',
    }
  }
  return null
}

/**
 * Anomalie #6 : surface manquante (bloque le calcul A1.3.2 cohérence).
 */
function checkSurfaceNull(input: ProductionAnomalyInput): AnomalyFinding | null {
  if (input.surface_m2 == null || input.surface_m2 <= 0) {
    return {
      code: 'SURFACE_NULL',
      severity: 'warning',
      message: 'Surface non renseignée.',
      details:
        'Sans surface, impossible de vérifier la cohérence cadastrale (algo A1.3.2). Complétez avant publication.',
    }
  }
  return null
}

function severityRank(s: AnomalySeverity): number {
  switch (s) {
    case 'critical':
      return 2
    case 'warning':
      return 1
    default:
      return 0
  }
}

export function detectProductionAnomalies(input: ProductionAnomalyInput): ProductionAnomalyResult {
  const findings = [
    checkConsumptionVsClass(input),
    checkGesEnergyGap(input),
    checkPreviousDpeJump(input),
    checkPre1949ClassAB(input),
    checkLocalDistribution(input),
    checkSurfaceNull(input),
  ].filter((f): f is AnomalyFinding => f !== null)

  const worst: AnomalySeverity = findings.reduce<AnomalySeverity>((acc, f) => {
    return severityRank(f.severity) > severityRank(acc) ? f.severity : acc
  }, 'info')

  const hasCritical = findings.some((f) => f.severity === 'critical')
  const hasWarning = findings.some((f) => f.severity === 'warning')

  const action: ProductionAnomalyResult['recommended_action'] = hasCritical
    ? 'rework'
    : hasWarning
      ? 'justify_before_publish'
      : findings.length > 0
        ? 'review'
        : 'publish'

  const human = (() => {
    if (hasCritical) {
      return `${findings.length} anomalie(s) critique(s) détectée(s) — corrigez avant publication.`
    }
    if (hasWarning) {
      return `${findings.length} point(s) à justifier avant publication (photos, factures).`
    }
    if (findings.length > 0) {
      return `${findings.length} information(s) à vérifier — publication possible.`
    }
    return 'Aucune anomalie détectée — publication recommandée.'
  })()

  return {
    anomalies: findings,
    worst_severity: worst,
    block_publication: hasCritical,
    recommended_action: action,
    human_message: human,
  }
}
