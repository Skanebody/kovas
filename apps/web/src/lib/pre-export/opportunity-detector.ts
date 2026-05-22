/**
 * KOVAS — Pré-export · Analyseur 4 : opportunités commerciales.
 *
 * Détecte les services/diagnostics complémentaires qui pourraient être proposés
 * au client en fonction du contexte du bien. Findings de catégorie `opportunity`,
 * sévérité `suggestion` (jamais bloquant).
 *
 * N'impacte PAS le score global (poids 0). Sert uniquement à enrichir l'UI avec
 * une section "Opportunités" — ce n'est pas un défaut de la mission.
 */

import type {
  AnalyzerResult,
  Finding,
  MissionAnalysisContext,
} from './types'

/** Liste indicative des départements à arrêté préfectoral termites (au 2026). */
const TERMITE_DEPARTMENTS = new Set([
  '13', '17', '24', '30', '31', '32', '33', '34', '40', '47', '49',
  '50', '64', '66', '67', '68', '81', '82', '83', '85', '92', '94',
])

interface OpportunityRule {
  code: string
  evaluate: (ctx: MissionAnalysisContext) => Finding | null
}

const RULES: OpportunityRule[] = [
  // F/G + vente → audit énergétique réglementaire
  {
    code: 'audit_energetique_fg_vente',
    evaluate: (ctx) => {
      const cls = ctx.property.energy_class
      if (!cls || (cls !== 'F' && cls !== 'G')) return null
      if (ctx.transaction_type !== 'vente') return null
      return {
        code: 'audit_energetique_fg_vente',
        category: 'opportunity',
        severity: 'suggestion',
        title: 'Audit énergétique requis (vente F/G)',
        message: `Pour la vente d'un bien classé ${cls}, un audit énergétique réglementaire est obligatoire depuis le 1er avril 2023. Vous pouvez orienter le propriétaire vers un partenaire ou un confrère certifié (prestation 400-800 €).`,
        suggested_action: 'Informer le propriétaire de l\'obligation',
      }
    },
  },

  // F/G + location → mention interdiction G depuis 2025
  {
    code: 'location_g_interdite',
    evaluate: (ctx) => {
      const cls = ctx.property.energy_class
      if (cls !== 'G') return null
      if (ctx.transaction_type !== 'location') return null
      return {
        code: 'location_g_interdite',
        category: 'opportunity',
        severity: 'warning',
        title: 'Logement G : interdiction location depuis 01/2025',
        message: `Les logements classés G sont interdits à la location depuis le 1er janvier 2025 (décret tertiaire). Informe le bailleur qu'un projet de rénovation est nécessaire avant remise en location.`,
        suggested_action: 'Mention obligatoire dans le rapport',
      }
    },
  },

  // Bien <1997 sans amiante → DAPP recommandé
  {
    code: 'dapp_recommande',
    evaluate: (ctx) => {
      const year = ctx.property.year_built
      if (!year || year >= 1997) return null
      // On regarde si la mission elle-même est un amiante (auquel cas pas pertinent)
      if (/amiante/i.test(ctx.mission.type)) return null
      return {
        code: 'dapp_recommande',
        category: 'opportunity',
        severity: 'suggestion',
        title: 'DAPP recommandé (bâti antérieur à 1997)',
        message: `Le bâti est antérieur à 1997. Un Dossier Amiante Parties Privatives (DAPP) est recommandé voire obligatoire selon le contexte (location, parties communes). Prestation 90-150 € HT.`,
        suggested_action: 'Proposer le DAPP au propriétaire',
      }
    },
  },

  // Bien <1949 sans plomb → CREP obligatoire en vente/location
  {
    code: 'crep_obligatoire',
    evaluate: (ctx) => {
      const year = ctx.property.year_built
      if (!year || year >= 1949) return null
      if (/plomb|crep/i.test(ctx.mission.type)) return null
      return {
        code: 'crep_obligatoire',
        category: 'opportunity',
        severity: 'warning',
        title: 'CREP obligatoire (bâti antérieur à 1949)',
        message: `Le bâti est antérieur à 1949. Le Constat de Risque d'Exposition au Plomb (CREP) est obligatoire pour toute vente/location. Vérifiez qu'il a bien été commandé.`,
        suggested_action: 'Proposer le CREP si pas déjà au dossier',
      }
    },
  },

  // Département termites + diagnostic non commandé
  {
    code: 'termites_zone_concernee',
    evaluate: (ctx) => {
      const dept = ctx.property.departement_code
      if (!dept || !TERMITE_DEPARTMENTS.has(dept)) return null
      if (/termite/i.test(ctx.mission.type)) return null
      return {
        code: 'termites_zone_concernee',
        category: 'opportunity',
        severity: 'suggestion',
        title: `Département ${dept} : zone à risque termites`,
        message: `Le département ${dept} fait l'objet d'un arrêté préfectoral termites. Un état parasitaire est obligatoire pour la vente. Pensez à le proposer si pas déjà commandé.`,
        suggested_action: 'Proposer le diagnostic termites',
      }
    },
  },

  // F/G → potentiel rénovation MaPrimeRénov'
  {
    code: 'maprimerenov_potential',
    evaluate: (ctx) => {
      const cls = ctx.property.energy_class
      if (!cls || (cls !== 'F' && cls !== 'G')) return null
      return {
        code: 'maprimerenov_potential',
        category: 'opportunity',
        severity: 'info',
        title: 'Potentiel rénovation MaPrimeRénov\'',
        message: `Un passage de ${cls} à C demande environ 25 000 € de travaux, en grande partie éligibles MaPrimeRénov'. Le propriétaire peut être intéressé par un accompagnement (audit + suivi MAR).`,
        suggested_action: 'Orienter vers un MAR partenaire',
      }
    },
  },

  // DPE expirant — programmer relance 10 ans (n/a en pré-export, on omet)
]

export function detectOpportunities(ctx: MissionAnalysisContext): AnalyzerResult {
  const findings: Finding[] = []
  for (const rule of RULES) {
    const f = rule.evaluate(ctx)
    if (f) findings.push(f)
  }
  // Pas d'impact sur le score (opportunités ≠ défauts).
  return {
    analyzer: 'opportunity-detector',
    findings,
    score: 1,
  }
}
