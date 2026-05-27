/**
 * KOVAS — Pré-export · Orchestrateur principal.
 *
 * Pipeline :
 *   1. Construit le contexte mission (`MissionAnalysisContext`) à partir des
 *      données déjà chargées par l'appelant (page server-side ou Edge Function).
 *   2. Lance les 6 analyseurs en parallèle (les analyseurs synchrones sont
 *      enveloppés dans une `Promise.resolve` pour parallélisme cohérent).
 *   3. Agrège les findings, normalise les sous-scores, calcule le score global
 *      pondéré via `risk-scorer`.
 *   4. Retourne un `PreExportAnalysisResult` prêt à être persisté + affiché.
 *
 * Latence cible : < 200 ms hors analyseurs réseau (statistical, historical).
 */

import { checkAdemeConformity } from './ademe-conformity-checker'
import { validateDataCoherence } from './data-coherence-validator'
import { type HistoricalDpe, checkHistorical } from './historical-checker'
import { detectOpportunities } from './opportunity-detector'
import { analyzePhotosAndObservations } from './photo-vision-analyzer'
import { computeGlobalScore } from './risk-scorer'
import {
  type AdemeBenchmark,
  type DiagnosticianDistribution,
  analyzeStatistical,
} from './statistical-analyzer'
import type { Finding, MissionAnalysisContext, PreExportAnalysisResult } from './types'

export interface OrchestratorInputs {
  ctx: MissionAnalysisContext
  /** Benchmarks ADEME pré-chargés (depuis `ademe_benchmarks`). Vide → analyseur neutre. */
  benchmarks?: AdemeBenchmark[]
  /** Distribution personnelle du diagnostiqueur (computée en amont). */
  diagnosticianDistribution?: DiagnosticianDistribution
  /** DPE historique trouvé pour l'adresse (null si rien). */
  historical?: HistoricalDpe | null
}

export async function runPreExportAnalysis(
  inputs: OrchestratorInputs,
): Promise<PreExportAnalysisResult> {
  const start = Date.now()

  const { ctx, benchmarks = [], diagnosticianDistribution, historical = null } = inputs

  // Lancement parallèle (analyseurs purs — pas d'IO ici)
  const [conformityRes, coherenceRes, statisticalRes, opportunityRes, historicalRes, qualityRes] =
    await Promise.all([
      Promise.resolve(checkAdemeConformity(ctx)),
      Promise.resolve(validateDataCoherence(ctx)),
      Promise.resolve(analyzeStatistical(ctx, benchmarks, diagnosticianDistribution)),
      Promise.resolve(detectOpportunities(ctx)),
      Promise.resolve(checkHistorical(ctx, historical)),
      Promise.resolve(analyzePhotosAndObservations(ctx)),
    ])

  // Calcul du sous-score exhaustivity à partir du meta du conformity checker
  const conformityMeta = conformityRes.meta as
    | {
        required_total: number
        required_present: number
        optional_total: number
        optional_present: number
      }
    | undefined

  const exhaustivityScore = conformityMeta
    ? conformityMeta.optional_total === 0
      ? 1
      : conformityMeta.optional_present / conformityMeta.optional_total
    : 0.5

  // Fusion des findings (ordre : conformity > coherence > statistical > quality > opportunity > historical)
  const findings: Finding[] = [
    ...conformityRes.findings,
    ...coherenceRes.findings,
    ...statisticalRes.findings,
    ...qualityRes.findings,
    ...opportunityRes.findings,
    ...historicalRes.findings,
  ]

  const result = computeGlobalScore(
    {
      conformity: conformityRes.score,
      coherence: coherenceRes.score,
      statistical: statisticalRes.score,
      quality: qualityRes.score,
      exhaustivity: exhaustivityScore,
    },
    findings,
    Date.now() - start,
  )

  return result
}

// Re-exports pour faciliter l'import côté UI / API
export type {
  Finding,
  MissionAnalysisContext,
  PreExportAnalysisResult,
  PreExportInterpretation,
  TargetExportFormat,
  FindingCategory,
  FindingSeverity,
} from './types'
export { INTERPRETATION_LABEL, TARGET_FORMAT_LABEL, interpretScore } from './types'
