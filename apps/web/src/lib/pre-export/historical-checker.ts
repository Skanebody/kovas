/**
 * KOVAS — Pré-export · Analyseur 5 : comparaison historique du bien.
 *
 * Recherche dans `dpe_historical_cache` (cache local, TTL 30j) puis interroge
 * l'API publique ADEME (data.ademe.fr ou search.koumoul.com) à la demande pour
 * trouver un DPE existant à la même adresse.
 *
 * Si un DPE historique est trouvé + classe différente → finding `info` avec
 * contexte (changement méthode 3CL-2021, rénovations probables, etc.).
 *
 * Cet analyseur reçoit en entrée le résultat de la recherche (faite côté Edge
 * Function pour profiter du fetch HTTP sans CORS). Il NE fait pas l'appel
 * réseau lui-même — purement logique.
 *
 * Poids dans le score global : ne pénalise pas directement, mais le finding
 * éventuel s'ajoute à la qualité globale.
 */

import type {
  AnalyzerResult,
  Finding,
  MissionAnalysisContext,
} from './types'

export interface HistoricalDpe {
  ademe_number: string | null
  diagnostic_date: string | null
  diagnostician_name: string | null
  energy_class: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null
  ges_class: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null
  conso_kwh_m2_an: number | null
  ges_kgco2_m2_an: number | null
}

/**
 * Compare la classe DPE actuelle avec un DPE historique fourni par l'edge
 * function `search-historical-dpe`.
 */
export function checkHistorical(
  ctx: MissionAnalysisContext,
  historical: HistoricalDpe | null,
): AnalyzerResult {
  const findings: Finding[] = []

  if (!historical) {
    return { analyzer: 'historical-checker', findings, score: 1 }
  }

  const currentCls = ctx.property.energy_class
  const previousCls = historical.energy_class

  // Pas de comparaison possible si une des deux classes manque
  if (!currentCls || !previousCls) {
    if (previousCls) {
      findings.push({
        code: 'previous_dpe_found',
        category: 'historical',
        severity: 'info',
        title: `DPE existant trouvé (${previousCls})`,
        message: `Un DPE antérieur à cette adresse a été publié sur l'observatoire ADEME (classe ${previousCls}${
          historical.diagnostic_date ? `, ${historical.diagnostic_date}` : ''
        }). Pense à le mentionner si pertinent.`,
        context: { previous: historical },
      })
    }
    return { analyzer: 'historical-checker', findings, score: 1 }
  }

  // Comparaison de classes (ordre A=0, B=1, ..., G=6)
  const classOrder: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6 }
  const deltaClasses = (classOrder[currentCls] ?? 0) - (classOrder[previousCls] ?? 0)

  if (deltaClasses === 0) {
    findings.push({
      code: 'historical_match',
      category: 'historical',
      severity: 'info',
      title: `Classe ${currentCls} identique au DPE précédent`,
      message: `Le précédent DPE à cette adresse était également en classe ${previousCls}. Cohérent — aucun changement à signaler.`,
      context: { previous: historical },
    })
  } else if (Math.abs(deltaClasses) >= 2) {
    const directionDown = deltaClasses > 0 // currentCls plus mauvais que precedent
    findings.push({
      code: directionDown ? 'historical_worsening' : 'historical_improvement',
      category: 'historical',
      severity: 'warning',
      title: directionDown
        ? `Classe dégradée (${previousCls} → ${currentCls})`
        : `Classe améliorée (${previousCls} → ${currentCls})`,
      message: directionDown
        ? `Le bien était classé ${previousCls} précédemment, tu proposes ${currentCls} aujourd'hui. Vérifie que les données saisies n'ont pas un biais (équipements, surface) — un écart de ${Math.abs(
            deltaClasses,
          )} classes mérite un contrôle.`
        : `Le bien était classé ${previousCls} précédemment, tu proposes ${currentCls} aujourd'hui. Si des travaux ont eu lieu, pense à les documenter. Sinon, la méthode 3CL-2021 (modifiée juillet 2021) peut expliquer une partie de l'écart.`,
      suggested_action: 'Vérifier les données ou documenter les travaux',
      context: { previous: historical, delta_classes: deltaClasses },
    })
  } else {
    // Écart de 1 classe : info légère
    findings.push({
      code: 'historical_minor_change',
      category: 'historical',
      severity: 'info',
      title: `Évolution mineure ${previousCls} → ${currentCls}`,
      message: `Le précédent DPE était en classe ${previousCls}, tu proposes ${currentCls}. Variation de 1 classe — cohérent avec la révision méthode 3CL-2021 ou de petits travaux.`,
      context: { previous: historical, delta_classes: deltaClasses },
    })
  }

  return {
    analyzer: 'historical-checker',
    findings,
    score: 1,
    meta: { historical_found: true },
  }
}

/**
 * Normalise une adresse pour comparaison dans le cache.
 * Lowercase + sans accents + sans ponctuation + espaces normalisés.
 */
export function normalizeAddress(address: string, postalCode?: string | null): string {
  const base = `${address} ${postalCode ?? ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return base
}
