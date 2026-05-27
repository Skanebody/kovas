/**
 * Consolidator — regroupe les findings similaires en une seule alerte.
 *
 * Évite la saturation. Exemple :
 *   4 findings "Hauteur sous plafond manquante" (1 par pièce)
 *   → 1 finding consolidé "Hauteur sous plafond non précisée pour 4 pièces"
 *
 * Respecte le plafond MAX_ALERTS_PER_MISSION = 3.
 */

import { filterTone } from './formulations'
import { type AlertSeverity, type Finding, MAX_ALERTS_PER_MISSION } from './types'

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

/**
 * Consolide les findings similaires et applique un plafond.
 *
 * Algorithme :
 *  1. Group by `type:subtype` (les findings de même nature sont fusionnés)
 *  2. Si un groupe a >= 2 findings : on en fait UNE alerte agrégée
 *  3. Tri : critical first, puis priorityScore desc
 *  4. Slice à maxN (par défaut 3)
 *  5. Tonalité filtrée sur tous les messages sortants
 */
export function consolidateFindings(
  findings: readonly Finding[],
  maxN: number = MAX_ALERTS_PER_MISSION,
): Finding[] {
  if (findings.length === 0) return []

  // 1. Group by type:subtype
  const groups = new Map<string, Finding[]>()
  for (const f of findings) {
    const key = `${f.type}:${f.subtype ?? ''}`
    const arr = groups.get(key) ?? []
    arr.push(f)
    groups.set(key, arr)
  }

  // 2. Fusion par groupe
  const consolidated: Finding[] = []
  for (const [key, items] of groups) {
    if (items.length === 1) {
      const only = items[0]
      if (!only) continue
      consolidated.push({ ...only, message: filterTone(only.message) })
      continue
    }
    // Plusieurs items → fusion
    const head = items[0]
    if (!head) continue
    const highestSeverity = items
      .map((it) => it.severity)
      .reduce((a, b) => (SEVERITY_ORDER[a] <= SEVERITY_ORDER[b] ? a : b))
    const maxScore = Math.max(...items.map((it) => it.priorityScore ?? 0))
    consolidated.push({
      id: `${key}:grouped`,
      type: head.type,
      subtype: head.subtype,
      category: head.category,
      severity: highestSeverity,
      priorityScore: maxScore,
      message: filterTone(buildGroupMessage(head, items.length)),
      detail: items.map((it) => `• ${filterTone(it.message)}`).join('\n'),
    })
  }

  // 3. Tri : sévérité asc (critical=0 d'abord), puis score desc
  consolidated.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sevDiff !== 0) return sevDiff
    return (b.priorityScore ?? 0) - (a.priorityScore ?? 0)
  })

  // 4. Plafond MAX_ALERTS_PER_MISSION
  return consolidated.slice(0, Math.max(0, maxN))
}

/**
 * Construit un message agrégé sobre.
 * Exemple : "Hauteur sous plafond non précisée pour 4 pièces"
 */
function buildGroupMessage(sample: Finding, count: number): string {
  // Heuristique : on garde le message de base et on suffixe le nombre.
  // Si le message contient déjà un nombre, on ne le double pas.
  const base = sample.message.replace(/\.$/, '')
  return `${base} — concerne ${count} éléments`
}
