/**
 * KOVAS — Pré-export · Analyseur 1 : conformité ADEME 3CL-DPE-2021.
 *
 * Vérifiez la présence + validité + bornes des champs obligatoires DPE 3CL.
 * Référentiel : méthode 3CL-DPE-2021 (arrêté du 31 mars 2021 modifié) et
 * cahier des charges ADEME publique. Pour Phase 1 (compagnon Liciel) on vérifie
 * la pré-condition « toutes les données métier sont là pour que le calcul
 * Liciel passe sans erreur ADEME ».
 *
 * Poids dans le score global : 40/100.
 * Score local 0-1 = 1 - (sum severity-weighted issues / total expected).
 */

import type { AnalyzerResult, Finding, MissionAnalysisContext } from './types'

/** Champs critiques pour qu'un DPE puisse être publié sur l'observatoire ADEME. */
interface FieldCheck {
  code: string
  label: string
  /** Récupère la valeur depuis le contexte. Retourner `undefined`/`null` pour manquant. */
  read: (ctx: MissionAnalysisContext) => unknown
  /** Borne min/max ou liste de valeurs admises. */
  validate?: (value: unknown) => true | string
  severity: 'critical' | 'warning'
}

const REQUIRED_FIELDS: FieldCheck[] = [
  {
    code: 'annee_construction',
    label: 'Année de construction',
    read: (ctx) => ctx.property.year_built,
    validate: (v) => {
      if (typeof v !== 'number') return 'Doit être un nombre.'
      if (v < 1700) return 'Année antérieure à 1700 atypique — confirmer.'
      const currentYear = new Date().getFullYear()
      if (v > currentYear + 1) return `Année postérieure à ${currentYear + 1} non admise.`
      return true
    },
    severity: 'critical',
  },
  {
    code: 'surface_habitable_totale_m2',
    label: 'Surface habitable totale (m²)',
    read: (ctx) => ctx.property.surface_total,
    validate: (v) => {
      if (typeof v !== 'number') return 'Doit être un nombre.'
      if (v < 8) return 'Surface inférieure à 8 m² hors champ DPE.'
      if (v > 2000) return 'Surface supérieure à 2000 m² atypique pour un logement.'
      return true
    },
    severity: 'critical',
  },
  {
    code: 'type_batiment',
    label: 'Type de bâtiment',
    read: (ctx) => ctx.property.property_type,
    validate: (v) => {
      if (typeof v !== 'string' || v.trim() === '') return 'Doit être renseigné.'
      const admis = ['maison', 'appartement', 'immeuble']
      if (!admis.includes(v.toLowerCase())) return `Valeur attendue parmi ${admis.join(', ')}.`
      return true
    },
    severity: 'critical',
  },
  {
    code: 'adresse_complete',
    label: 'Adresse complète (voie + CP + ville)',
    read: (ctx) =>
      ctx.property.address && ctx.property.postal_code && ctx.property.city
        ? `${ctx.property.address} ${ctx.property.postal_code} ${ctx.property.city}`
        : null,
    severity: 'critical',
  },
  {
    code: 'chauffage_systeme',
    label: 'Système de chauffage identifié',
    read: (ctx) => {
      // On considère "présent" si au moins une voice-note mentionne un équipement chauffage.
      const hasHeating = ctx.voiceNotes.some((v) =>
        v.transcript_structured?.equipment?.some(
          (e) => e.kind === 'chaudiere' || e.kind === 'pac' || e.kind === 'radiateur',
        ),
      )
      return hasHeating ? 'present' : null
    },
    severity: 'critical',
  },
  {
    code: 'ecs_production',
    label: "Production d'eau chaude sanitaire identifiée",
    read: (ctx) => {
      const hasEcs = ctx.voiceNotes.some((v) =>
        v.transcript_structured?.equipment?.some((e) => e.kind === 'chauffe_eau'),
      )
      return hasEcs ? 'present' : null
    },
    severity: 'critical',
  },
  {
    code: 'ventilation_type',
    label: 'Type de ventilation noté',
    read: (ctx) => {
      const hasVent = ctx.voiceNotes.some((v) =>
        v.transcript_structured?.equipment?.some((e) => e.kind === 'ventilation'),
      )
      return hasVent ? 'present' : null
    },
    severity: 'warning',
  },
  {
    code: 'fenetres_type',
    label: 'Type de vitrage (simple/double/triple)',
    read: (ctx) => {
      const hasFen = ctx.voiceNotes.some((v) =>
        v.transcript_structured?.equipment?.some((e) => e.kind === 'fenetre'),
      )
      return hasFen ? 'present' : null
    },
    severity: 'warning',
  },
  {
    code: 'isolation_present',
    label: 'Isolation décrite (murs / toiture / planchers)',
    read: (ctx) => {
      const hasIso = ctx.voiceNotes.some((v) =>
        v.transcript_structured?.equipment?.some((e) => e.kind === 'isolation'),
      )
      return hasIso ? 'present' : null
    },
    severity: 'warning',
  },
  {
    code: 'photo_facade',
    label: 'Au moins une photo générale (façade)',
    read: (ctx) => (ctx.photos.length >= 1 ? 'present' : null),
    severity: 'critical',
  },
]

/** Champs optionnels (n'affectent que la borne `exhaustivity`, pas la conformité). */
const OPTIONAL_FIELDS: FieldCheck[] = [
  {
    code: 'surface_carrez',
    label: 'Surface Carrez',
    read: (ctx) => ctx.property.surface_carrez,
    severity: 'warning',
  },
  {
    code: 'etiquette_dpe',
    label: 'Étiquette DPE proposée (A-G)',
    read: (ctx) => ctx.property.energy_class,
    validate: (v) => {
      if (!v) return true
      if (typeof v !== 'string' || !/^[A-G]$/.test(v)) return 'Doit être une lettre A-G.'
      return true
    },
    severity: 'warning',
  },
  {
    code: 'etiquette_ges',
    label: 'Étiquette GES proposée (A-G)',
    read: (ctx) => ctx.property.ges_class,
    severity: 'warning',
  },
  {
    code: 'conso_5_usages',
    label: 'Conso 5 usages (kWh/m²/an)',
    read: (ctx) => ctx.property.conso_5_usages_kwh_m2_an,
    severity: 'warning',
  },
]

/**
 * Vérifiez la conformité ADEME du dossier mission.
 *
 * @returns sous-score 0-1 (1 = parfait) + findings + couples conformité/exhaustivité
 *   utilisés par l'orchestrateur pour calculer les colonnes dédiées du score global.
 */
export function checkAdemeConformity(ctx: MissionAnalysisContext): AnalyzerResult & {
  meta: {
    required_total: number
    required_present: number
    optional_total: number
    optional_present: number
  }
} {
  const findings: Finding[] = []

  let requiredPresent = 0
  for (const field of REQUIRED_FIELDS) {
    const value = field.read(ctx)
    const isPresent = value !== null && value !== undefined && value !== ''
    if (!isPresent) {
      findings.push({
        code: `missing_${field.code}`,
        category: 'conformity',
        severity: field.severity === 'critical' ? 'critical' : 'warning',
        title: `${field.label} manquant`,
        message:
          field.severity === 'critical'
            ? `Le champ « ${field.label} » est obligatoire pour publier le DPE sur l'observatoire ADEME. Vous pourriez vérifier ce point avant export.`
            : `Le champ « ${field.label} » devrait être renseigné. Vérifiez qu'il n'a pas été oublié pendant la visite.`,
        suggested_action: 'Ajouter cette donnée à la mission',
        related_field: field.code,
      })
      continue
    }
    if (field.validate) {
      const v = field.validate(value)
      if (v !== true) {
        findings.push({
          code: `invalid_${field.code}`,
          category: 'conformity',
          severity: field.severity === 'critical' ? 'critical' : 'warning',
          title: `${field.label} hors bornes`,
          message: `${v} La valeur saisie pourrait être rejetée par l'observatoire ADEME.`,
          suggested_action: 'Vérifier la valeur saisie',
          related_field: field.code,
          context: { value },
        })
        continue
      }
    }
    requiredPresent += 1
  }

  let optionalPresent = 0
  for (const field of OPTIONAL_FIELDS) {
    const value = field.read(ctx)
    const isPresent = value !== null && value !== undefined && value !== ''
    if (isPresent) {
      optionalPresent += 1
      if (field.validate) {
        const v = field.validate(value)
        if (v !== true) {
          findings.push({
            code: `invalid_${field.code}`,
            category: 'conformity',
            severity: 'warning',
            title: `${field.label} hors bornes`,
            message: `${v} La valeur saisie pourrait être rejetée par l'observatoire ADEME.`,
            related_field: field.code,
            context: { value },
          })
        }
      }
    }
  }

  const requiredTotal = REQUIRED_FIELDS.length
  const optionalTotal = OPTIONAL_FIELDS.length
  const score = requiredTotal === 0 ? 1 : requiredPresent / requiredTotal

  return {
    analyzer: 'ademe-conformity-checker',
    findings,
    score,
    meta: {
      required_total: requiredTotal,
      required_present: requiredPresent,
      optional_total: optionalTotal,
      optional_present: optionalPresent,
    },
  }
}
