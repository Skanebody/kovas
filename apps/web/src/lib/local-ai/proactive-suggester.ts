/**
 * ProactiveSuggester — règles métier déclenchant des suggestions
 * contextuelles "à toi de décider" pendant la capture terrain.
 *
 * 100% local, déterministe, pas d'IA. Les règles sont prioritisées
 * en interne — chaque appel renvoie au maximum 1 suggestion (la plus
 * urgente) pour ne pas spammer le diagnostiqueur.
 *
 * Règles V1 (cf. spec module garde-fou) :
 *   R1 — Bien antérieur à 1997 sans amiante dans la mission → ajouter amiante (high)
 *   R2 — Bien antérieur à 1949 sans plomb CREP → ajouter plomb (critical)
 *   R3 — Classe énergétique F/G probable + pas d'audit → l'audit reste exclu V1 (n/a)
 *   R4 — Département à risque termites sans termites → ajouter termites (high)
 *   R5 — Installation gaz > 15 ans sans diag gaz → ajouter gaz (high)
 *   R6 — Installation élec > 15 ans sans diag élec → ajouter élec (high)
 *   R7 — Bien F/G en location → rappel interdiction location G depuis 01/2025
 */

import type { DiagnosticKind } from './checklists/types'

/** Priorité métier d'une suggestion. */
export type SuggestionPriority = 'critical' | 'high' | 'medium' | 'low'

/** Contexte propriété pour évaluation des règles. */
export interface PropertyContext {
  /** Année de construction (PC déposé). */
  year_built: number | null
  /** Code département (FR : '01' à '976'). */
  department_code: string | null
  /** Étiquette DPE estimée ou existante. */
  dpe_letter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null
  /** Âge installation gaz si connu (années). */
  gaz_install_age_years: number | null
  /** Âge installation électricité si connu (années). */
  elec_install_age_years: number | null
  /** Bien destiné à la location ? (impact règle G interdite). */
  is_rental: boolean
}

/** Suggestion produite par le moteur. */
export interface Suggestion {
  /** Identifiant règle (debug + analytics). */
  rule_id: string
  /** Diagnostic à ajouter / action à entreprendre (null si information seule). */
  suggested_diagnostic: DiagnosticKind | null
  /** Priorité métier. */
  priority: SuggestionPriority
  /** Titre court (≤ 50 caractères). */
  title: string
  /** Message complet (FR métier, vouvoiement, sobre). */
  message: string
  /** Action CTA suggérée (label bouton). */
  cta_label: string
  /** Si présent, indique une action purement informative. */
  info_only: boolean
}

/** Départements à risque termites (arrêtés préfectoraux fréquents). */
export const TERMITES_AT_RISK_DEPARTMENTS: ReadonlySet<string> = new Set([
  '17', // Charente-Maritime
  '24', // Dordogne
  '29', // Finistère (zones)
  '33', // Gironde
  '40', // Landes
  '44', // Loire-Atlantique
  '47', // Lot-et-Garonne
  '56', // Morbihan
  '64', // Pyrénées-Atlantiques
  '85', // Vendée
])

const CURRENT_YEAR = 2026

interface Rule {
  id: string
  evaluate: (ctx: PropertyContext, present: ReadonlySet<DiagnosticKind>) => Suggestion | null
}

const RULES: ReadonlyArray<Rule> = [
  // R2 — Plomb CREP (avant 1949) — CRITIQUE
  {
    id: 'r2_plomb_pre_1949',
    evaluate: (ctx, present) => {
      if (!ctx.year_built || ctx.year_built >= 1949) return null
      if (present.has('plomb')) return null
      return {
        rule_id: 'r2_plomb_pre_1949',
        suggested_diagnostic: 'plomb',
        priority: 'critical',
        title: 'CREP plomb obligatoire',
        message: `Le bien date de ${ctx.year_built}, antérieur à 1949. Le Constat de Risque d'Exposition au Plomb (CREP) est obligatoire pour la vente ou la location.`,
        cta_label: 'Ajouter le CREP plomb',
        info_only: false,
      }
    },
  },
  // R1 — Amiante (avant 1997) — HIGH
  {
    id: 'r1_amiante_pre_1997',
    evaluate: (ctx, present) => {
      if (!ctx.year_built || ctx.year_built >= 1997) return null
      if (present.has('amiante')) return null
      return {
        rule_id: 'r1_amiante_pre_1997',
        suggested_diagnostic: 'amiante',
        priority: 'high',
        title: 'Repérage amiante recommandé',
        message: `Le permis de construire de ${ctx.year_built} est antérieur au 1er juillet 1997. Un repérage amiante (DAPP ou DTA) est obligatoire selon le type de transaction.`,
        cta_label: 'Ajouter le diagnostic amiante',
        info_only: false,
      }
    },
  },
  // R4 — Termites départemental — HIGH
  {
    id: 'r4_termites_at_risk',
    evaluate: (ctx, present) => {
      if (!ctx.department_code) return null
      if (!TERMITES_AT_RISK_DEPARTMENTS.has(ctx.department_code)) return null
      if (present.has('termites')) return null
      return {
        rule_id: 'r4_termites_at_risk',
        suggested_diagnostic: 'termites',
        priority: 'high',
        title: 'Zone termites — diagnostic recommandé',
        message: `Le département ${ctx.department_code} est sous arrêté préfectoral termites. Un état parasitaire est requis pour la vente.`,
        cta_label: 'Ajouter le diagnostic termites',
        info_only: false,
      }
    },
  },
  // R5 — Gaz > 15 ans — HIGH
  {
    id: 'r5_gaz_over_15y',
    evaluate: (ctx, present) => {
      if (ctx.gaz_install_age_years === null) return null
      if (ctx.gaz_install_age_years < 15) return null
      if (present.has('gaz')) return null
      return {
        rule_id: 'r5_gaz_over_15y',
        suggested_diagnostic: 'gaz',
        priority: 'high',
        title: 'Installation gaz > 15 ans',
        message: `L'installation gaz a ${ctx.gaz_install_age_years} ans. Un diagnostic gaz est obligatoire pour la vente (validité 3 ans) ou la location (validité 6 ans).`,
        cta_label: 'Ajouter le diagnostic gaz',
        info_only: false,
      }
    },
  },
  // R6 — Électricité > 15 ans — HIGH
  {
    id: 'r6_elec_over_15y',
    evaluate: (ctx, present) => {
      if (ctx.elec_install_age_years === null) return null
      if (ctx.elec_install_age_years < 15) return null
      if (present.has('electricite')) return null
      return {
        rule_id: 'r6_elec_over_15y',
        suggested_diagnostic: 'electricite',
        priority: 'high',
        title: 'Installation élec > 15 ans',
        message: `L'installation électrique a ${ctx.elec_install_age_years} ans. Un diagnostic électrique est obligatoire pour la vente ou la location.`,
        cta_label: 'Ajouter le diagnostic électricité',
        info_only: false,
      }
    },
  },
  // R7 — Location passoire thermique (info seule)
  {
    id: 'r7_rental_g_forbidden',
    evaluate: (ctx) => {
      if (!ctx.is_rental) return null
      if (ctx.dpe_letter !== 'G') return null
      return {
        rule_id: 'r7_rental_g_forbidden',
        suggested_diagnostic: null,
        priority: 'medium',
        title: 'Location interdite (passoire G)',
        message: `Depuis le 1er janvier 2025, les logements classés G ne peuvent plus être proposés à la location en résidence principale. Travaux de rénovation requis avant remise sur le marché.`,
        cta_label: 'Compris',
        info_only: true,
      }
    },
  },
  // R3-bis — F/G en location (rappel anticipation 2028)
  {
    id: 'r3_rental_f_anticipation',
    evaluate: (ctx) => {
      if (!ctx.is_rental) return null
      if (ctx.dpe_letter !== 'F') return null
      return {
        rule_id: 'r3_rental_f_anticipation',
        suggested_diagnostic: null,
        priority: 'low',
        title: 'Location F — interdiction 2028',
        message: `Le logement est classé F. Anticiper l'interdiction de mise en location au 1er janvier 2028 (classe F interdite). Travaux d'amélioration énergétique conseillés.`,
        cta_label: 'Compris',
        info_only: true,
      }
    },
  },
]

// CURRENT_YEAR exporté pour tests (et pour usage UI éventuel).
export { CURRENT_YEAR }

/**
 * Renvoie toutes les suggestions applicables pour un contexte, triées par
 * priorité (critical → high → medium → low) puis par ordre déclaratif.
 */
export function getAllSuggestions(
  context: PropertyContext,
  presentDiagnostics: readonly DiagnosticKind[],
): Suggestion[] {
  const set = new Set(presentDiagnostics)
  const all: Suggestion[] = []
  for (const rule of RULES) {
    const sugg = rule.evaluate(context, set)
    if (sugg) all.push(sugg)
  }
  const order: Record<SuggestionPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }
  return all.sort((a, b) => order[a.priority] - order[b.priority])
}

/** Renvoie LA suggestion la plus prioritaire (la plus urgente) ou null. */
export function getTopSuggestion(
  context: PropertyContext,
  presentDiagnostics: readonly DiagnosticKind[],
): Suggestion | null {
  const all = getAllSuggestions(context, presentDiagnostics)
  return all[0] ?? null
}
