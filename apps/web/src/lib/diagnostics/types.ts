/**
 * Référentiel typé des 9 diagnostics immobiliers couverts par KOVAS.
 *
 * Source canonique pour :
 *  - pages programmatiques /diagnostic/[type]/[ville], /prix/[type]/[ville],
 *    /comparatif/[type]/[ville]
 *  - guides /guide/[type]
 *  - composants annuaire diagnostiqueurs
 *
 * 8 diagnostics standards (92% du volume métier FR — cf. CLAUDE.md §3) +
 * audit énergétique (obligatoire F/G depuis 04/2023, E depuis 01/2025).
 */

export type DiagnosticType =
  | 'dpe'
  | 'amiante'
  | 'plomb'
  | 'gaz'
  | 'electricite'
  | 'termites'
  | 'carrez'
  | 'erp'
  | 'audit-energetique'

export const DIAGNOSTIC_TYPES: ReadonlyArray<DiagnosticType> = [
  'dpe',
  'amiante',
  'plomb',
  'gaz',
  'electricite',
  'termites',
  'carrez',
  'erp',
  'audit-energetique',
]

/** Libellé court (titre H1 + nav). */
export const DIAGNOSTIC_LABELS: Record<DiagnosticType, string> = {
  dpe: 'DPE',
  amiante: 'Amiante',
  plomb: 'Plomb (CREP)',
  gaz: 'Gaz',
  electricite: 'Électricité',
  termites: 'Termites',
  carrez: 'Loi Carrez',
  erp: 'ERP',
  'audit-energetique': 'Audit énergétique',
}

/** Libellé long (sous-titre + JSON-LD). */
export const DIAGNOSTIC_LONG_LABELS: Record<DiagnosticType, string> = {
  dpe: 'Diagnostic de performance énergétique',
  amiante: 'Diagnostic amiante (DAPP / DTA)',
  plomb: 'Constat de risque d’exposition au plomb (CREP)',
  gaz: 'Diagnostic gaz',
  electricite: 'Diagnostic électricité',
  termites: 'État relatif à la présence de termites',
  carrez: 'Mesurage Loi Carrez / Boutin',
  erp: 'État des risques et pollutions',
  'audit-energetique': 'Audit énergétique réglementaire',
}

/** Description neutre 1 phrase pour meta + intros. */
export const DIAGNOSTIC_DESCRIPTIONS: Record<DiagnosticType, string> = {
  dpe: 'Évaluation de la performance énergétique et climatique d’un logement (classes A à G), obligatoire pour toute vente ou location.',
  amiante:
    'Repérage des matériaux et produits contenant de l’amiante dans les bâtiments construits avant le 1er juillet 1997.',
  plomb:
    'Repérage du plomb dans les revêtements des logements construits avant 1949, obligatoire pour vente et location.',
  gaz: 'État de l’installation intérieure de gaz pour les installations de plus de 15 ans, obligatoire vente et location.',
  electricite:
    'État de l’installation électrique intérieure pour les installations de plus de 15 ans.',
  termites:
    'Diagnostic obligatoire dans les zones d’infestation déclarées par arrêté préfectoral.',
  carrez:
    'Mesurage de la superficie privative pour la vente d’un lot de copropriété ou de la surface habitable pour la location (loi Boutin).',
  erp: 'Information de l’acquéreur ou du locataire sur les risques naturels, miniers, technologiques, sismiques, radon et pollution des sols.',
  'audit-energetique':
    'Audit énergétique réglementaire obligatoire à la vente pour les logements classés F et G (depuis 04/2023) et E (depuis 01/2025).',
}

/** Fourchette de prix indicative en euros TTC (référence marché FR 2026). */
export interface PriceRange {
  readonly min: number
  readonly max: number
  readonly median: number
}

export const DIAGNOSTIC_PRICE_RANGES: Record<DiagnosticType, PriceRange> = {
  dpe: { min: 110, max: 250, median: 145 },
  amiante: { min: 90, max: 180, median: 130 },
  plomb: { min: 130, max: 280, median: 180 },
  gaz: { min: 110, max: 160, median: 130 },
  electricite: { min: 100, max: 160, median: 125 },
  termites: { min: 100, max: 180, median: 130 },
  carrez: { min: 70, max: 130, median: 90 },
  erp: { min: 20, max: 60, median: 35 },
  'audit-energetique': { min: 500, max: 1200, median: 800 },
}

/** Validité du diagnostic en mois. */
export const DIAGNOSTIC_VALIDITY_MONTHS: Record<DiagnosticType, number> = {
  dpe: 120,
  amiante: 999,
  plomb: 12,
  gaz: 36,
  electricite: 36,
  termites: 6,
  carrez: 999,
  erp: 6,
  'audit-energetique': 60,
}

/** Année charnière qui déclenche l'obligation (parc bâti FR). */
export const DIAGNOSTIC_TRIGGER_YEAR: Record<DiagnosticType, number | null> = {
  dpe: null,
  amiante: 1997,
  plomb: 1949,
  gaz: null,
  electricite: null,
  termites: null,
  carrez: null,
  erp: null,
  'audit-energetique': null,
}

/** Vérifie qu'une string est un DiagnosticType valide. */
export function isDiagnosticType(value: string): value is DiagnosticType {
  return (DIAGNOSTIC_TYPES as ReadonlyArray<string>).includes(value)
}
