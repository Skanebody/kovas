/**
 * KOVAS — Pré-export · Analyseur 2 : cohérence interne des données.
 *
 * Règles métier sans IA. Vérifiez que les données saisies entre elles sont
 * cohérentes (somme surfaces vs total, équipements vs année, étiquette vs
 * bâti). Réutilise une partie de `lib/coherence-validation.ts` mais avec
 * granularité supplémentaire pour le contexte pré-export.
 *
 * Poids dans le score global : 20/100.
 */

import type {
  AnalyzerResult,
  Finding,
  MissionAnalysisContext,
} from './types'

/** Tolérance entre somme surfaces pièces et surface totale (5%). */
const SURFACE_TOLERANCE_RATIO = 0.05

/** Tolérance hauteur sous plafond entre pièces (cm). */
const CEILING_TOLERANCE_CM = 50

interface CoherenceRule {
  code: string
  evaluate: (ctx: MissionAnalysisContext) => Finding | null
}

const RULES: CoherenceRule[] = [
  // Règle 1 : somme surfaces pièces vs surface totale
  {
    code: 'sum_rooms_vs_total',
    evaluate: (ctx) => {
      const roomSurfaces = ctx.rooms
        .map((r) => r.surface_m2)
        .filter((s): s is number => typeof s === 'number' && s > 0)
      if (roomSurfaces.length === 0 || !ctx.property.surface_total) return null
      const sum = roomSurfaces.reduce((a, b) => a + b, 0)
      const total = ctx.property.surface_total
      const ratio = Math.abs(sum - total) / total
      if (ratio <= SURFACE_TOLERANCE_RATIO) return null
      return {
        code: 'sum_rooms_vs_total',
        category: 'coherence',
        severity: ratio > 0.2 ? 'warning' : 'suggestion',
        title: 'Somme des surfaces pièces ≠ surface totale',
        message: `La somme des surfaces des pièces (${sum.toFixed(
          1,
        )} m²) diffère de la surface totale (${total.toFixed(
          1,
        )} m²) de ${(ratio * 100).toFixed(0)}%. Vous pourriez vérifier les mesures pour éviter une remontée ADEME.`,
        suggested_action: 'Recompter ou ajuster une mesure pièce',
        context: { sum_rooms: sum, total, ratio },
      }
    },
  },

  // Règle 2 : PAC déclarée dans un bâti antérieur à 1949 → information
  {
    code: 'pac_in_old_building',
    evaluate: (ctx) => {
      const year = ctx.property.year_built
      if (!year || year >= 1949) return null
      const hasPac = ctx.voiceNotes.some((v) =>
        v.transcript_structured?.equipment?.some((e) => e.kind === 'pac'),
      )
      if (!hasPac) return null
      return {
        code: 'pac_in_old_building',
        category: 'coherence',
        severity: 'info',
        title: 'PAC sur bâti ancien',
        message: `Une pompe à chaleur est mentionnée pour un bâti de ${year}. Pas anormal en soi, mais vérifiez que l'isolation est cohérente avec ce choix (sinon le coefficient de performance restera bas).`,
        context: { year_built: year },
      }
    },
  },

  // Règle 3 : Maison passive + convecteurs électriques = anomalie
  {
    code: 'passive_house_electric_resistors',
    evaluate: (ctx) => {
      const energyClass = ctx.property.energy_class
      if (!energyClass || (energyClass !== 'A' && energyClass !== 'B')) return null
      const hasConvecteurs = ctx.voiceNotes.some((v) =>
        v.transcript_structured?.equipment?.some(
          (e) => e.kind === 'radiateur' && /convecteur/i.test(e.notes ?? ''),
        ),
      )
      if (!hasConvecteurs) return null
      return {
        code: 'passive_house_electric_resistors',
        category: 'coherence',
        severity: 'warning',
        title: 'Étiquette A/B avec convecteurs électriques',
        message: `Une étiquette ${energyClass} avec des convecteurs électriques classiques est très peu probable. Vérifiez le type de chauffage ou l'étiquette proposée.`,
        suggested_action: 'Revoir le système de chauffage ou la classe DPE',
      }
    },
  },

  // Règle 4 : Hauteur sous plafond entre pièces — écart > 50 cm
  {
    code: 'ceiling_height_inconsistent',
    evaluate: (ctx) => {
      const heights = ctx.rooms
        .map((r) => r.ceiling_height_m)
        .filter((h): h is number => typeof h === 'number' && h > 0)
      if (heights.length < 2) return null
      const min = Math.min(...heights)
      const max = Math.max(...heights)
      const deltaCm = (max - min) * 100
      if (deltaCm <= CEILING_TOLERANCE_CM) return null
      return {
        code: 'ceiling_height_inconsistent',
        category: 'coherence',
        severity: 'suggestion',
        title: 'Hauteurs sous plafond très différentes',
        message: `Les pièces affichent des hauteurs sous plafond entre ${min.toFixed(
          2,
        )} m et ${max.toFixed(
          2,
        )} m (écart ${deltaCm.toFixed(0)} cm). Vérifiez si c'est volontaire (combles, sous-pente).`,
        context: { min, max, delta_cm: deltaCm },
      }
    },
  },

  // Règle 5 : Isolation déclarée vs année du bâti
  {
    code: 'isolation_vs_year',
    evaluate: (ctx) => {
      const year = ctx.property.year_built
      if (!year) return null
      const isolationNote = ctx.voiceNotes
        .flatMap((v) => v.transcript_structured?.equipment ?? [])
        .find((e) => e.kind === 'isolation')
      if (!isolationNote) return null
      // Avant 1948, la présence d'isolation moderne (laine, polystyrène) est possible seulement
      // si rénovation. Pas une erreur, juste un point d'attention.
      if (year < 1948) {
        return {
          code: 'isolation_vs_year_old',
          category: 'coherence',
          severity: 'info',
          title: 'Isolation moderne sur bâti ancien',
          message: `Vous mentionnez "${isolationNote.notes ?? 'isolation'}" sur un bâti de ${year}. Cela suppose une rénovation lourde. Vérifiez la date des travaux pour le calcul 3CL.`,
        }
      }
      return null
    },
  },

  // Règle 6 : Type fenêtres vs année (double vitrage standardisé après 1985)
  {
    code: 'double_glazing_old_house',
    evaluate: (ctx) => {
      const year = ctx.property.year_built
      if (!year || year >= 1985) return null
      const windowsNote = ctx.voiceNotes
        .flatMap((v) => v.transcript_structured?.equipment ?? [])
        .find((e) => e.kind === 'fenetre' && /double|triple/i.test(e.notes ?? ''))
      if (!windowsNote) return null
      return {
        code: 'double_glazing_old_house',
        category: 'coherence',
        severity: 'info',
        title: 'Double vitrage sur bâti pré-1985',
        message: `Vous mentionnez du double vitrage sur un bâti de ${year}. C'est probable (remplacement des menuiseries), pensez à noter l'année des travaux si tu l'as.`,
      }
    },
  },

  // Règle 7 : Bâti RT2012/RE2020 + classe F/G = incohérent réglementairement
  {
    code: 'recent_building_low_class',
    evaluate: (ctx) => {
      const year = ctx.property.year_built
      const cls = ctx.property.energy_class
      if (!year || !cls) return null
      if (year >= 2012 && (cls === 'F' || cls === 'G')) {
        return {
          code: 'recent_building_low_class',
          category: 'coherence',
          severity: 'critical',
          title: `Bâti ${year} (RT2012/RE2020) en classe ${cls}`,
          message: `Un bâti construit après 2012 est soumis à la RT2012 puis RE2020. Une classe ${cls} est incohérente réglementairement. Vérifiez le calcul avant publication.`,
          suggested_action: 'Revoir le calcul DPE',
        }
      }
      return null
    },
  },
]

export function validateDataCoherence(ctx: MissionAnalysisContext): AnalyzerResult {
  const findings: Finding[] = []
  for (const rule of RULES) {
    const f = rule.evaluate(ctx)
    if (f) findings.push(f)
  }

  // Score : 1 - (critical * 0.4 + warning * 0.2 + suggestion * 0.1 + info * 0.05) plafonné à 0.
  const penalty = findings.reduce((acc, f) => {
    switch (f.severity) {
      case 'critical':
        return acc + 0.4
      case 'warning':
        return acc + 0.2
      case 'suggestion':
        return acc + 0.1
      default:
        return acc + 0.05
    }
  }, 0)
  const score = Math.max(0, Math.min(1, 1 - penalty))

  return {
    analyzer: 'data-coherence-validator',
    findings,
    score,
  }
}
