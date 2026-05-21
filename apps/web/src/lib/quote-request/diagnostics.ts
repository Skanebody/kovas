/**
 * KOVAS — auto-détection des diagnostics requis selon contexte du bien.
 *
 * Règles métier issues du Code de la construction et de l'habitation (CCH)
 * et de la réglementation diagnostic immobilier FR 2026 :
 *  - DPE : obligatoire vente + location (sauf monuments historiques) — art. L126-26 CCH
 *  - Amiante (DTA) : tout permis de construire avant 01/07/1997 — vente uniquement
 *  - Plomb (CREP) : tout bien avant 01/01/1949 — vente + location
 *  - ERP/ERRIAL : tout bien, vente + location (gratuit, en ligne préfecture)
 *  - Électricité : vente, installation > 15 ans
 *  - Gaz : vente, installation > 15 ans, présence gaz
 *  - Carrez : copropriété (lots > 8m²), vente uniquement
 *  - Boutin : location vide (résidence principale) uniquement
 *  - Termites : vente, zone arrêté préfectoral (à enrichir post-launch)
 */

export type DiagnosticCode =
  | 'DPE'
  | 'AMIANTE'
  | 'PLOMB'
  | 'GAZ'
  | 'ELEC'
  | 'TERMITES'
  | 'CARREZ'
  | 'BOUTIN'
  | 'ERP'

export type PropertyType = 'maison' | 'appartement' | 'local_commercial' | 'autre'

export type PropertySituation = 'vente' | 'location' | 'travaux' | 'audit'

export interface DiagnosticSuggestion {
  type: DiagnosticCode
  required: boolean
  reason: string
}

export interface ComputeInput {
  property_type: PropertyType
  property_situation: PropertySituation
  property_year_built?: number | null
}

/**
 * Calcule la liste des diagnostics suggérés selon la situation, l'année de construction
 * et le type de bien. `required: true` = obligation légale ; `required: false` = recommandé / conditionnel.
 *
 * Pas de doublons : chaque code n'apparaît qu'une fois (le premier match gagne).
 */
export function computeRequiredDiagnostics(input: ComputeInput): DiagnosticSuggestion[] {
  const { property_type, property_situation, property_year_built } = input
  const year = property_year_built ?? null
  const out: DiagnosticSuggestion[] = []
  const seen = new Set<DiagnosticCode>()

  function push(d: DiagnosticSuggestion): void {
    if (seen.has(d.type)) return
    seen.add(d.type)
    out.push(d)
  }

  // DPE — vente + location uniquement
  if (property_situation === 'vente' || property_situation === 'location') {
    push({
      type: 'DPE',
      required: true,
      reason: `Obligatoire pour la ${property_situation === 'vente' ? 'vente' : 'location'}`,
    })
  } else if (property_situation === 'audit') {
    push({
      type: 'DPE',
      required: true,
      reason: 'Base de l’audit énergétique',
    })
  }

  // Amiante DTA — avant 01/07/1997, vente principale
  if (year !== null && year < 1997 && property_situation === 'vente') {
    push({
      type: 'AMIANTE',
      required: true,
      reason: 'Construit avant 1997 — obligatoire pour la vente',
    })
  } else if (year !== null && year < 1997 && property_situation === 'travaux') {
    push({
      type: 'AMIANTE',
      required: true,
      reason: 'Construit avant 1997 — repérage avant travaux obligatoire',
    })
  }

  // Plomb CREP — avant 01/01/1949, vente + location
  if (year !== null && year < 1949) {
    push({
      type: 'PLOMB',
      required: true,
      reason: 'Construit avant 1949 — obligatoire',
    })
  }

  // Électricité — vente uniquement
  if (property_situation === 'vente') {
    push({
      type: 'ELEC',
      required: true,
      reason: 'Installation potentiellement >15 ans',
    })
  }

  // Gaz — recommandé vente (conditionnel à la présence)
  if (property_situation === 'vente') {
    push({
      type: 'GAZ',
      required: false,
      reason: 'Si présence de gaz dans le logement',
    })
  }

  // ERP — vente + location
  if (property_situation === 'vente' || property_situation === 'location') {
    push({
      type: 'ERP',
      required: true,
      reason: 'Obligatoire (état des risques et pollutions)',
    })
  }

  // Carrez / Boutin — selon type bien + situation
  if (property_type === 'appartement') {
    if (property_situation === 'vente') {
      push({
        type: 'CARREZ',
        required: true,
        reason: 'Copropriété — obligatoire pour la vente',
      })
    } else if (property_situation === 'location') {
      push({
        type: 'BOUTIN',
        required: true,
        reason: 'Location vide — surface habitable obligatoire',
      })
    }
  }

  // Termites — vente, recommandé (zone arrêté préfectoral à enrichir M2)
  if (property_situation === 'vente') {
    push({
      type: 'TERMITES',
      required: false,
      reason: 'Si zone à risque (arrêté préfectoral)',
    })
  }

  return out
}

/**
 * Libellés FR (UI labels) — alignés CLAUDE.md §3 (8 diagnostics standards V1).
 */
export const DIAGNOSTIC_LABEL: Record<DiagnosticCode, string> = {
  DPE: 'DPE — Performance énergétique',
  AMIANTE: 'Amiante (DTA)',
  PLOMB: 'Plomb (CREP)',
  GAZ: 'Gaz',
  ELEC: 'Électricité',
  TERMITES: 'Termites',
  CARREZ: 'Loi Carrez',
  BOUTIN: 'Loi Boutin',
  ERP: 'État des Risques (ERP)',
}
