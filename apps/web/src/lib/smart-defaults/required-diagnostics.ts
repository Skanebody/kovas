/**
 * Logique d'auto-détection des diagnostics obligatoires selon le contexte du bien.
 *
 * Référence réglementation FR (Phase 1, 8 diagnostics standards) :
 * - DPE : obligatoire vente + location depuis 2007 (refonte 2021)
 * - AMIANTE (DTA / DAPP) : permis de construire < juillet 1997, vente uniquement
 * - PLOMB CREP : permis de construire < 1er janvier 1949
 * - ELEC : installation > 15 ans, vente (et location depuis 2018 — appartement)
 * - GAZ : installation > 15 ans, vente (et location pour gaz collectif)
 * - TERMITES : zones définies par arrêté préfectoral, vente
 * - ERP (État des Risques) : vente + location, dans toutes les communes
 * - CARREZ : appartement en copropriété, vente uniquement
 * - BOUTIN : appartement, location vide (résidence principale)
 *
 * Cette logique est utilisée par le wizard /app/dossiers/new, le wizard devis,
 * et le form B2C public. Elle propose, l'utilisateur valide.
 */

export type PropertyType = 'maison' | 'appartement' | 'local_commercial' | 'autre'
export type Situation = 'vente' | 'location' | 'travaux' | 'audit'

export interface PropertyContext {
  type: PropertyType
  situation: Situation
  yearBuilt: number | null
}

export type DiagnosticType =
  | 'DPE'
  | 'AMIANTE'
  | 'PLOMB'
  | 'GAZ'
  | 'ELEC'
  | 'TERMITES'
  | 'CARREZ'
  | 'BOUTIN'
  | 'ERP'

export interface DiagnosticSuggestion {
  type: DiagnosticType
  required: boolean
  reason: string
}

const AMIANTE_CUTOFF_YEAR = 1997
const PLOMB_CUTOFF_YEAR = 1949

/**
 * Calcule la liste des diagnostics suggérés (avec leur niveau de recommandation).
 * Renvoie toujours la liste complète (8 + Boutin) pour que l'UI puisse afficher
 * coché/décoché selon `required`.
 */
export function computeRequiredDiagnostics(ctx: PropertyContext): DiagnosticSuggestion[] {
  const suggestions: DiagnosticSuggestion[] = []
  const isSale = ctx.situation === 'vente'
  const isRental = ctx.situation === 'location'
  const isWorks = ctx.situation === 'travaux'
  const isFlat = ctx.type === 'appartement'
  const isHouse = ctx.type === 'maison'
  const yearBuilt = ctx.yearBuilt

  // DPE — vente + location toujours
  suggestions.push({
    type: 'DPE',
    required: isSale || isRental,
    reason:
      isSale || isRental
        ? 'Obligatoire pour toute mise en vente ou location.'
        : 'Recommandé en cas de travaux énergétiques.',
  })

  // AMIANTE — permis < 1997, vente. Avant-travaux pour 'travaux'.
  if (isWorks) {
    suggestions.push({
      type: 'AMIANTE',
      required: yearBuilt !== null && yearBuilt < AMIANTE_CUTOFF_YEAR,
      reason:
        yearBuilt !== null && yearBuilt < AMIANTE_CUTOFF_YEAR
          ? 'Recherche amiante avant travaux obligatoire (bâti < 1997).'
          : 'Pas requis si construction postérieure à 1997.',
    })
  } else {
    suggestions.push({
      type: 'AMIANTE',
      required: isSale && yearBuilt !== null && yearBuilt < AMIANTE_CUTOFF_YEAR,
      reason:
        isSale && yearBuilt !== null && yearBuilt < AMIANTE_CUTOFF_YEAR
          ? 'Bâti antérieur à 1997 mis en vente.'
          : "Requis seulement pour vente d'un bâti antérieur à 1997.",
    })
  }

  // PLOMB CREP — permis < 1949
  suggestions.push({
    type: 'PLOMB',
    required: (isSale || isRental) && yearBuilt !== null && yearBuilt < PLOMB_CUTOFF_YEAR,
    reason:
      yearBuilt !== null && yearBuilt < PLOMB_CUTOFF_YEAR
        ? 'Bâti antérieur à 1949 (vente ou location).'
        : 'Requis seulement pour bâti antérieur à 1949.',
  })

  // ELEC — vente toujours (installation > 15 ans très probable)
  suggestions.push({
    type: 'ELEC',
    required: isSale,
    reason: isSale ? 'Vente : installation potentiellement > 15 ans.' : 'Optionnel hors vente.',
  })

  // GAZ — vente, si présence de gaz. On le marque optionnel par défaut.
  suggestions.push({
    type: 'GAZ',
    required: false,
    reason: isSale
      ? "À cocher si présence d'une installation gaz > 15 ans."
      : 'Optionnel hors vente.',
  })

  // TERMITES — vente, zones préfectorales
  suggestions.push({
    type: 'TERMITES',
    required: false,
    reason: isSale
      ? 'À vérifier selon arrêté préfectoral de la commune.'
      : 'Requis uniquement en zone à risque préfectoral.',
  })

  // ERP — vente + location, partout
  suggestions.push({
    type: 'ERP',
    required: isSale || isRental,
    reason:
      isSale || isRental
        ? 'État des Risques — obligatoire vente et location.'
        : 'Optionnel hors transaction.',
  })

  // CARREZ — appartement + vente
  suggestions.push({
    type: 'CARREZ',
    required: isFlat && isSale,
    reason:
      isFlat && isSale
        ? "Mesurage légal obligatoire pour vente d'appartement."
        : "Requis seulement pour vente d'un appartement en copropriété.",
  })

  // BOUTIN — appartement + location (rare hors copropriété)
  suggestions.push({
    type: 'BOUTIN',
    required: isFlat && isRental,
    reason:
      isFlat && isRental
        ? 'Mesurage Boutin pour location vide.'
        : "Requis seulement pour location d'appartement.",
  })

  // Filtre maison : pas de Carrez ni Boutin sur maison individuelle
  return suggestions.filter((s) => {
    if (isHouse && (s.type === 'CARREZ' || s.type === 'BOUTIN')) return false
    return true
  })
}

/**
 * Renvoie uniquement les diagnostics dont `required === true`.
 * Utile pour pré-cocher la liste dans un form.
 */
export function getRequiredDiagnosticTypes(ctx: PropertyContext): DiagnosticType[] {
  return computeRequiredDiagnostics(ctx)
    .filter((s) => s.required)
    .map((s) => s.type)
}

/** Labels FR pour affichage. */
export const DIAGNOSTIC_LABELS: Record<DiagnosticType, string> = {
  DPE: 'DPE',
  AMIANTE: 'Amiante',
  PLOMB: 'Plomb CREP',
  GAZ: 'Gaz',
  ELEC: 'Électricité',
  TERMITES: 'Termites',
  CARREZ: 'Loi Carrez',
  BOUTIN: 'Loi Boutin',
  ERP: 'État des Risques',
}
