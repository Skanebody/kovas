/**
 * KOVAS — Module 2 — Règles statiques de suggestion paramétrique (fallback).
 *
 * Utilisé quand l'open data ADEME n'a pas assez d'échantillons (< 50) pour produire
 * une suggestion statistiquement fiable. Les règles ci-dessous sont des heuristiques
 * issues de la littérature technique métier (Cerema, ADEME, NF DTU, arrêtés
 * réglementaires). On stocke uniquement les RÉFÉRENCES, jamais le texte intégral
 * d'un arrêté ou d'une fiche (cf. CLAUDE.md §13 — interdits copyright).
 *
 * Sources réglementaires citées (URLs canoniques) :
 *
 *   • Cerema — "Performance des bâtiments — DTUs ventilation/isolation par décennie" :
 *       https://www.cerema.fr/fr/centre-ressources/boutique/performance-batiments-existants
 *   • ADEME — Bilan annuel DPE 2024 (distributions par année de construction) :
 *       https://librairie.ademe.fr/urbanisme-et-batiment/
 *   • Arrêté du 24 mars 1982 (ventilation hygiénique des logements) :
 *       https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000310578
 *   • Arrêté du 31 mars 2021 (méthode 3CL-DPE 2021) :
 *       https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043296140
 *   • NF DTU 68.3 — Installations de ventilation mécanique
 *     (référence éditeur AFNOR, lien Cerema) :
 *       https://www.cerema.fr/fr/actualites/nf-dtu-68-3-installations-ventilation-mecanique
 *
 * TODO V2 : enrichir les règles avec :
 *   - Climats (zones H1/H2/H3 de la RT 2012, futur RE2020)
 *   - Type d'immeuble (collectif vs individuel) — différences importantes en VMC
 *   - Spécificités régionales (chauffage bois en zones rurales montagneuses)
 *   - Données INSEE recensement logement par EPCI
 */

import type {
  ParameterName,
  ReglementaryReference,
  SuggestionContext,
  SuggestionOutput,
} from './parameter-types'

// ============================================================
// Références réglementaires citées (jamais de texte intégral).
// ============================================================

const REF_ARRETE_VENTILATION_1982: ReglementaryReference = {
  label: 'Arrêté du 24 mars 1982 — Aération des logements (ventilation hygiénique)',
  url: 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000310578',
  publishedAt: '1982-03-24',
}

const REF_CEREMA_VENTILATION: ReglementaryReference = {
  label: 'Cerema — NF DTU 68.3 / Installations de ventilation mécanique (synthèse)',
  url: 'https://www.cerema.fr/fr/actualites/nf-dtu-68-3-installations-ventilation-mecanique',
}

const REF_ARRETE_3CL_2021: ReglementaryReference = {
  label: 'Arrêté du 31 mars 2021 — Méthode 3CL-DPE 2021',
  url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043296140',
  publishedAt: '2021-03-31',
}

const REF_CEREMA_PERFORMANCE: ReglementaryReference = {
  label: 'Cerema — Performance des bâtiments existants (typologies par décennie)',
  url: 'https://www.cerema.fr/fr/centre-ressources/boutique/performance-batiments-existants',
}

const REF_ADEME_BILAN_DPE: ReglementaryReference = {
  label: 'ADEME — Bilan annuel DPE (distributions par année de construction)',
  url: 'https://librairie.ademe.fr/urbanisme-et-batiment/',
}

// ============================================================
// Règles par paramètre — modèle déclaratif.
// ============================================================

interface StaticRule {
  /** Prédicat sur le contexte — retourne true si la règle s'applique. */
  match: (ctx: SuggestionContext) => boolean
  /** Valeur suggérée. */
  value: string
  /** Confiance baseline (typiquement 0.5-0.75 pour une heuristique). */
  confidence: number
  /** Justification courte affichable. */
  justification: string
  /** Références réglementaires (toujours au moins 1). */
  references: ReglementaryReference[]
}

// ────────────────────────────────────────────────────────────
// Ventilation par décennie de construction (maisons + appartements).
// Sources : NF DTU 68.3, arrêté 1982, Cerema.
// ────────────────────────────────────────────────────────────
const RULES_VENTILATION: StaticRule[] = [
  {
    match: (ctx) => typeof ctx.yearBuilt === 'number' && ctx.yearBuilt < 1969,
    value: 'naturelle',
    confidence: 0.65,
    justification: 'Logement antérieur à 1969 : ventilation naturelle par défaut (pas d\'obligation VMC avant arrêté 1982).',
    references: [REF_CEREMA_VENTILATION, REF_ARRETE_VENTILATION_1982],
  },
  {
    match: (ctx) =>
      typeof ctx.yearBuilt === 'number' && ctx.yearBuilt >= 1969 && ctx.yearBuilt < 1982,
    value: 'vmc_simple_flux',
    confidence: 0.55,
    justification: 'Logement 1969-1982 : transition obligation ventilation mécanique. VMC SF la plus probable.',
    references: [REF_ARRETE_VENTILATION_1982, REF_CEREMA_VENTILATION],
  },
  {
    match: (ctx) =>
      typeof ctx.yearBuilt === 'number' && ctx.yearBuilt >= 1982 && ctx.yearBuilt < 2000,
    value: 'vmc_simple_flux',
    confidence: 0.75,
    justification: 'Logement 1982-2000 : arrêté 1982 impose VMC SF, standard largement diffusé.',
    references: [REF_ARRETE_VENTILATION_1982, REF_CEREMA_VENTILATION],
  },
  {
    match: (ctx) =>
      typeof ctx.yearBuilt === 'number' && ctx.yearBuilt >= 2000 && ctx.yearBuilt < 2012,
    value: 'vmc_hygro_a',
    confidence: 0.6,
    justification: 'Logement 2000-2012 : montée en gamme des VMC, VMC hygro A fréquente en construction neuve.',
    references: [REF_CEREMA_VENTILATION, REF_CEREMA_PERFORMANCE],
  },
  {
    match: (ctx) => typeof ctx.yearBuilt === 'number' && ctx.yearBuilt >= 2012,
    value: 'vmc_hygro_b',
    confidence: 0.7,
    justification: 'Logement post-RT 2012 : VMC hygro B ou double-flux dominantes pour respecter le bouclage règlementaire.',
    references: [REF_ARRETE_3CL_2021, REF_CEREMA_VENTILATION],
  },
]

// ────────────────────────────────────────────────────────────
// Chauffage par décennie (très simplifié — distribution moyenne ADEME).
// ────────────────────────────────────────────────────────────
const RULES_CHAUFFAGE: StaticRule[] = [
  {
    match: (ctx) =>
      typeof ctx.yearBuilt === 'number' &&
      ctx.yearBuilt < 1980 &&
      ctx.buildingType === 'maison',
    value: 'fioul',
    confidence: 0.4,
    justification: 'Maison construite avant 1980 : fioul ou chaudière gaz sont les configurations historiques majoritaires.',
    references: [REF_ADEME_BILAN_DPE, REF_CEREMA_PERFORMANCE],
  },
  {
    match: (ctx) =>
      typeof ctx.yearBuilt === 'number' &&
      ctx.yearBuilt >= 1980 &&
      ctx.yearBuilt < 2005 &&
      ctx.buildingType === 'maison',
    value: 'gaz',
    confidence: 0.5,
    justification: 'Maison 1980-2005 : chaudière gaz devient majoritaire en zone urbaine raccordée.',
    references: [REF_ADEME_BILAN_DPE],
  },
  {
    match: (ctx) => typeof ctx.yearBuilt === 'number' && ctx.yearBuilt >= 2012,
    value: 'pac',
    confidence: 0.55,
    justification: 'Logement RT 2012+ : pompe à chaleur (PAC) air-eau ou air-air en très forte progression.',
    references: [REF_ARRETE_3CL_2021, REF_ADEME_BILAN_DPE],
  },
  {
    match: (ctx) => ctx.buildingType === 'appartement' && typeof ctx.floors === 'number' && ctx.floors > 5,
    value: 'electrique',
    confidence: 0.5,
    justification: 'Appartement en immeuble haut : chauffage électrique individuel très courant (conventions chauffage collectif rares).',
    references: [REF_ADEME_BILAN_DPE],
  },
]

// ────────────────────────────────────────────────────────────
// ECS par décennie (eau chaude sanitaire).
// ────────────────────────────────────────────────────────────
const RULES_ECS: StaticRule[] = [
  {
    match: (ctx) => typeof ctx.yearBuilt === 'number' && ctx.yearBuilt >= 2012,
    value: 'thermodynamique',
    confidence: 0.5,
    justification: 'Logement post-RT 2012 : chauffe-eau thermodynamique ou solaire dominants.',
    references: [REF_ARRETE_3CL_2021, REF_ADEME_BILAN_DPE],
  },
  {
    match: (ctx) =>
      typeof ctx.yearBuilt === 'number' &&
      ctx.yearBuilt >= 1990 &&
      ctx.yearBuilt < 2012,
    value: 'electrique',
    confidence: 0.6,
    justification: 'Logement 1990-2012 : chauffe-eau électrique à accumulation dominant en France.',
    references: [REF_ADEME_BILAN_DPE],
  },
]

// ────────────────────────────────────────────────────────────
// Isolation murs par décennie.
// ────────────────────────────────────────────────────────────
const RULES_ISOLATION_MURS: StaticRule[] = [
  {
    match: (ctx) => typeof ctx.yearBuilt === 'number' && ctx.yearBuilt < 1975,
    value: 'non_isole',
    confidence: 0.7,
    justification: 'Logement antérieur à 1975 (1ère RT) : murs non isolés à l\'origine (sauf rénovation déclarée).',
    references: [REF_CEREMA_PERFORMANCE, REF_ADEME_BILAN_DPE],
  },
  {
    match: (ctx) =>
      typeof ctx.yearBuilt === 'number' && ctx.yearBuilt >= 1975 && ctx.yearBuilt < 2005,
    value: 'iti',
    confidence: 0.6,
    justification: 'Logement 1975-2005 : isolation thermique par l\'intérieur (ITI) standard, R ≈ 2.5-3.5.',
    references: [REF_CEREMA_PERFORMANCE],
  },
  {
    match: (ctx) => typeof ctx.yearBuilt === 'number' && ctx.yearBuilt >= 2012,
    value: 'ite',
    confidence: 0.55,
    justification: 'Logement post-RT 2012 : ITE en forte progression, R ≥ 4.5 attendu.',
    references: [REF_ARRETE_3CL_2021, REF_CEREMA_PERFORMANCE],
  },
]

// ────────────────────────────────────────────────────────────
// Menuiseries par décennie.
// ────────────────────────────────────────────────────────────
const RULES_MENUISERIES: StaticRule[] = [
  {
    match: (ctx) => typeof ctx.yearBuilt === 'number' && ctx.yearBuilt < 1990,
    value: 'simple_vitrage',
    confidence: 0.5,
    justification: 'Logement antérieur 1990 : simple vitrage à l\'origine (remplacement double vitrage fréquent depuis).',
    references: [REF_CEREMA_PERFORMANCE],
  },
  {
    match: (ctx) =>
      typeof ctx.yearBuilt === 'number' && ctx.yearBuilt >= 1990 && ctx.yearBuilt < 2012,
    value: 'double_vitrage',
    confidence: 0.75,
    justification: 'Logement 1990-2012 : double vitrage devenu standard, Uw ≈ 1.8-2.6.',
    references: [REF_CEREMA_PERFORMANCE],
  },
  {
    match: (ctx) => typeof ctx.yearBuilt === 'number' && ctx.yearBuilt >= 2012,
    value: 'double_vitrage',
    confidence: 0.8,
    justification: 'Logement post-RT 2012 : double vitrage à isolation renforcée majoritaire, triple vitrage < 5%.',
    references: [REF_ARRETE_3CL_2021, REF_CEREMA_PERFORMANCE],
  },
]

// ────────────────────────────────────────────────────────────
// Map paramètre → règles.
// ────────────────────────────────────────────────────────────

const RULES_BY_PARAMETER: Partial<Record<ParameterName, StaticRule[]>> = {
  type_ventilation: RULES_VENTILATION,
  type_chauffage: RULES_CHAUFFAGE,
  type_ecs: RULES_ECS,
  type_isolation_murs: RULES_ISOLATION_MURS,
  type_menuiseries: RULES_MENUISERIES,
}

// ============================================================
// API publique : suggestFromStaticRules
// ============================================================

export function suggestFromStaticRules(
  parameterName: ParameterName,
  context: SuggestionContext,
  cacheKey: string,
): SuggestionOutput | null {
  const rules = RULES_BY_PARAMETER[parameterName]
  if (!rules || rules.length === 0) return null
  // Première règle dont le prédicat match (ordre = priorité éditoriale).
  const matched = rules.find((r) => r.match(context))
  if (!matched) return null

  return {
    parameterName,
    suggestedValue: matched.value,
    confidenceScore: matched.confidence,
    alternatives: [],
    justification: matched.justification,
    reglementaryReferences: matched.references,
    similarCasesCount: 0,
    source: 'static_rule',
    cacheKey,
    computedAt: new Date().toISOString(),
  }
}
