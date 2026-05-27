/**
 * KOVAS — Configuration visuelle de la zone d'intervention selon le tier
 * d'abonnement Annuaire (Track Annuaire 19/39/79 €).
 *
 * Authority : CLAUDE.md §4 (Track Annuaire) + Design System v5 (sage `#F5F7F4`,
 * navy `#0F1419`, accent UNIQUE chartreuse `#D4F542`).
 *
 * Mapping tier → rendu Leaflet :
 *   - `free`      → cercle navy discret, rayon par défaut (fiche non revendiquée).
 *   - `presence`  → cercle navy plus marqué, rayon précis renseigné par le diag.
 *   - `boost`     → cercle chartreuse animé (pulse), rayon département complet.
 *   - `premium`   → 3 cercles concentriques chartreuse + markers des 3 villes
 *                   principales mises en avant par l'abonné.
 *
 * Aucun effet animé sous `prefers-reduced-motion` (cf. composant `DiagMap`).
 */

export type AnnuaireTier = 'free' | 'presence' | 'boost' | 'premium'

export interface InterventionVisualConfig {
  /** Couleur principale (HEX, sans alpha). */
  primaryColor: string
  /** Opacité du fill (`0..1`). */
  fillOpacity: number
  /** Épaisseur de la bordure (px). */
  borderWeight: number
  /** Active l'animation pulse (désactivée si `prefers-reduced-motion`). */
  pulseAnimation: boolean
  /** Affiche le périmètre du département (pour Boost). */
  showDepartmentBoundary: boolean
  /** Affiche les 3 markers des villes mises en avant (Premium). */
  showHighlightedCities: boolean
  /** Nombre de cercles concentriques (1 par défaut, 3 pour Premium). */
  concentricRings: number
}

/** Tokens KOVAS Design System v5 — source vérité pour cohérence visuelle carte. */
const TOKEN = {
  navy: '#0F1419',
  chartreuse: '#D4F542',
} as const

/**
 * Retourne la config visuelle d'un tier donné. Function pure, déterministe,
 * facile à tester. Default = `free`.
 */
export function getInterventionVisualConfig(tier: AnnuaireTier): InterventionVisualConfig {
  switch (tier) {
    case 'presence':
      return {
        primaryColor: TOKEN.navy,
        fillOpacity: 0.1,
        borderWeight: 2,
        pulseAnimation: false,
        showDepartmentBoundary: false,
        showHighlightedCities: false,
        concentricRings: 1,
      }
    case 'boost':
      return {
        primaryColor: TOKEN.chartreuse,
        fillOpacity: 0.12,
        borderWeight: 3,
        pulseAnimation: true,
        showDepartmentBoundary: true,
        showHighlightedCities: false,
        concentricRings: 1,
      }
    case 'premium':
      return {
        primaryColor: TOKEN.chartreuse,
        fillOpacity: 0.08,
        borderWeight: 3,
        pulseAnimation: true,
        showDepartmentBoundary: true,
        showHighlightedCities: true,
        concentricRings: 3,
      }
    case 'free':
    default:
      return {
        primaryColor: TOKEN.navy,
        fillOpacity: 0.06,
        borderWeight: 1,
        pulseAnimation: false,
        showDepartmentBoundary: false,
        showHighlightedCities: false,
        concentricRings: 1,
      }
  }
}
