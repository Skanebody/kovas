/**
 * KOVAS — Pré-export · Analyseur 3 : cohérence statistique vs benchmarks.
 *
 * Compare la classe DPE proposée à la distribution nationale/régionale/typologie
 * stockée dans `ademe_benchmarks`. Détecte également les anomalies sur la
 * distribution personnelle du diagnostiqueur (DPE flatteurs récurrents).
 *
 * Note : nécessite des données externes (benchmarks ADEME). Le sous-score est
 * neutre (0.85) si aucun benchmark n'est trouvé, pour ne pas pénaliser
 * arbitrairement la mission.
 *
 * Poids dans le score global : 20/100.
 */

import type {
  AnalyzerResult,
  Finding,
  MissionAnalysisContext,
} from './types'

export interface AdemeBenchmark {
  scope_type: 'national' | 'regional' | 'departemental'
  scope_value: string | null
  bien_type: string | null
  year_construction_band: string | null
  /** Distribution DPE 0-1, somme = 1. */
  distribution: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G', number>
  sample_size: number | null
}

export interface DiagnosticianDistribution {
  /** Distribution personnelle du diagnostiqueur sur les N derniers DPE (30j/90j/365j). */
  period_days: 30 | 90 | 365
  total: number
  classes: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G', number>
}

/** Écart au-delà duquel on signale (en points de %). */
const FG_DEVIATION_THRESHOLD = 0.15

/**
 * Devine la bande année de construction (ADEME normalisée).
 */
export function yearToConstructionBand(year: number): string {
  if (year < 1948) return '<1948'
  if (year < 1975) return '1948-1974'
  if (year < 2001) return '1975-2000'
  return '>2000'
}

/**
 * Analyse statistique.
 *
 * @param ctx     contexte mission
 * @param benchmarks benchmarks ADEME résolus (vide = analyseur neutre)
 * @param diagnosticianDist distributions diagnostiqueur (optionnel)
 */
export function analyzeStatistical(
  ctx: MissionAnalysisContext,
  benchmarks: AdemeBenchmark[] = [],
  diagnosticianDist?: DiagnosticianDistribution,
): AnalyzerResult {
  const findings: Finding[] = []

  // 1. Recherche le benchmark le plus spécifique (typologie + bande année).
  const propType = ctx.property.property_type
  const year = ctx.property.year_built
  const band = year ? yearToConstructionBand(year) : null

  const matched =
    benchmarks.find(
      (b) => b.bien_type === propType && b.year_construction_band === band,
    ) ??
    benchmarks.find((b) => b.bien_type === propType) ??
    benchmarks.find((b) => b.scope_type === 'national')

  // 2. Compare la classe DPE proposée à la distribution
  const cls = ctx.property.energy_class
  if (cls && matched) {
    const expected = matched.distribution[cls] ?? 0
    if (expected < 0.05 && (cls === 'A' || cls === 'B')) {
      findings.push({
        code: 'rare_high_class_for_typology',
        category: 'statistical',
        severity: 'warning',
        title: `Étiquette ${cls} rare pour ce type de bien`,
        message: `Seulement ${(expected * 100).toFixed(
          1,
        )}% des biens similaires (${propType ?? 'type non précisé'}, bande ${band ?? 'n.c.'}) sont en classe ${cls}. Vérifie qu'aucune donnée n'a été oubliée pour le calcul.`,
        context: {
          expected_pct: expected,
          benchmark_scope: matched.scope_type,
          sample_size: matched.sample_size,
        },
      })
    }
  }

  // 3. Analyse de la distribution personnelle du diagnostiqueur
  if (diagnosticianDist && matched && diagnosticianDist.total >= 20) {
    const personalFg =
      (diagnosticianDist.classes.F + diagnosticianDist.classes.G) /
      diagnosticianDist.total
    const nationalFg = matched.distribution.F + matched.distribution.G
    const delta = personalFg - nationalFg
    if (Math.abs(delta) > FG_DEVIATION_THRESHOLD) {
      const flatter = delta < 0
      findings.push({
        code: 'personal_fg_distribution_deviation',
        category: 'statistical',
        severity: 'suggestion',
        title: flatter
          ? 'Distribution F/G en-deçà de la moyenne'
          : 'Distribution F/G au-dessus de la moyenne',
        message: flatter
          ? `Sur les ${diagnosticianDist.period_days} derniers jours, ta proportion de F/G (${(
              personalFg * 100
            ).toFixed(0)}%) est ${(Math.abs(delta) * 100).toFixed(
              0,
            )} points en-dessous de la moyenne nationale (${(nationalFg * 100).toFixed(0)}%). À considérer si l'observatoire ADEME compare ton activité.`
          : `Sur les ${diagnosticianDist.period_days} derniers jours, ta proportion de F/G (${(
              personalFg * 100
            ).toFixed(0)}%) est ${(Math.abs(delta) * 100).toFixed(
              0,
            )} points au-dessus de la moyenne nationale (${(nationalFg * 100).toFixed(0)}%). Plutôt rassurant côté audit ADEME.`,
        context: {
          personal_fg_pct: personalFg,
          national_fg_pct: nationalFg,
          delta_pct: delta,
          period_days: diagnosticianDist.period_days,
        },
      })
    }
  }

  // 4. Distribution A-B-C suspecte (DPE "flatteurs" récurrents)
  if (diagnosticianDist && diagnosticianDist.total >= 30) {
    const abcShare =
      (diagnosticianDist.classes.A +
        diagnosticianDist.classes.B +
        diagnosticianDist.classes.C) /
      diagnosticianDist.total
    if (abcShare > 0.6) {
      findings.push({
        code: 'personal_abc_high',
        category: 'statistical',
        severity: 'suggestion',
        title: 'Forte proportion de A-B-C',
        message: `${(abcShare * 100).toFixed(
          0,
        )}% de tes DPE récents sont en A-B-C. Si tu opères majoritairement sur du neuf ou rénové, c'est normal. Sinon, l'ADEME pourrait pointer un biais — pense à documenter.`,
      })
    }
  }

  // Score : neutre 0.85 si pas de benchmark, sinon 1 - penalty findings (warning 0.2, suggestion 0.1)
  let score = matched ? 1 : 0.85
  for (const f of findings) {
    if (f.severity === 'warning') score -= 0.2
    if (f.severity === 'suggestion') score -= 0.1
  }
  score = Math.max(0, Math.min(1, score))

  return {
    analyzer: 'statistical-analyzer',
    findings,
    score,
    meta: { benchmark_used: matched ? matched.scope_type : null },
  }
}
