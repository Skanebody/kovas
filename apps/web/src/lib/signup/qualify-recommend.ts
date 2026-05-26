/**
 * KOVAS — Logique de recommandation du tunnel signup Tugan v3.0.
 *
 * Quiz 3 questions (taille équipe / volume mensuel / éditeur actuel) →
 * recommandation chiffrée de plan + ROI personnalisé.
 *
 * Plans cibles V1 (logiciel uniquement, sans bundle) :
 *   - Solo     29 €/mo · 40 missions
 *   - Pro      79 €/mo · 100 missions
 *   - Cabinet  199 €/mo · 300 missions · 5 users
 *   - Cabinet+ 499 €/mo · 1000 missions · 15 users
 *
 * Le tunnel pré-remplit le plan recommandé puis route vers /signup?plan=X.
 *
 * Cf. docs Tugan §6 Étape 2-3 (quiz + recommandation personnalisée chiffrée).
 */

import type { LogicielPlanCode } from '@/lib/pricing-plans'

/** Taille de la structure. */
export type TeamSizeBand = 'solo' | 'small_cabinet' | 'structured_cabinet' | 'network'

/** Éditeur principal aujourd'hui (utile pour copy "import depuis…"). */
export type CurrentEditor = 'liciel' | 'oris' | 'obbc' | 'none' | 'other'

export interface QuizAnswers {
  /** Taille équipe (Q1). */
  teamSize: TeamSizeBand
  /** Missions / mois (Q2). Slider 5-500, clampé. */
  monthlyMissions: number
  /** Éditeur principal actuel (Q3). */
  currentEditor: CurrentEditor
}

export interface PlanRecommendation {
  /** Code du plan recommandé. */
  planCode: LogicielPlanCode
  /** Nom commercial pour l'UI ("Solo", "Pro", "Cabinet", "Cabinet+"). */
  planName: string
  /** Prix mensuel HT affiché (€). */
  monthlyPriceEur: number
  /** Cap missions inclus dans le plan. */
  missionsCap: number
  /** Surplus €/mission au-dela du cap. */
  overagePriceEur: number
  /** Volume mensuel pris en compte (clampé). */
  monthlyMissions: number
  /** Heures gagnees par mois (35 min/mission * volume). */
  hoursSavedPerMonth: number
  /** Valorisation horaire utilisee dans le calcul (€/h). */
  hourlyRateEur: number
  /** Revenue potentiel additionnel mensuel (heures * tarif). */
  monthlyRevenueUpsideEur: number
  /** Multiple ROI (revenue / abonnement). */
  roiMultiple: number
  /** Raison "humaine" qui justifie la reco (a afficher sous le prix). */
  rationale: string
}

/**
 * Bornes des plans (centimes en EUR, mais on travaille en EUR ici pour
 * le copy frontend). Source de verite : pricing-plans.ts.
 */
const PLAN_TABLE = [
  {
    code: 'solo_light' as LogicielPlanCode,
    name: 'Solo',
    monthlyPriceEur: 29,
    missionsCap: 40,
    overagePriceEur: 0.99,
    maxUsers: 1,
  },
  {
    code: 'solo_pro' as LogicielPlanCode,
    name: 'Pro',
    monthlyPriceEur: 79,
    missionsCap: 100,
    overagePriceEur: 0.79,
    maxUsers: 1,
  },
  {
    code: 'cabinet' as LogicielPlanCode,
    name: 'Cabinet',
    monthlyPriceEur: 199,
    missionsCap: 300,
    overagePriceEur: 0.59,
    maxUsers: 5,
  },
  {
    code: 'cabinet_plus' as LogicielPlanCode,
    name: 'Cabinet+',
    monthlyPriceEur: 499,
    missionsCap: 1000,
    overagePriceEur: 0.29,
    maxUsers: 15,
  },
] as const

/** Gain estime par mission KOVAS : 35 min (CLAUDE.md §3). */
const MINUTES_SAVED_PER_MISSION = 35

/**
 * Tarif horaire diagnostiqueur par defaut pour la valorisation. 60 €/h
 * est conservateur (le marche FR est plutot 70-90 €/h).
 */
const DEFAULT_HOURLY_RATE_EUR = 60

/** Clamp volume entre 1 et 1500. */
export function clampMonthlyMissions(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  return Math.min(1500, Math.max(1, Math.round(value)))
}

/**
 * Recommande le plan optimal en fonction des reponses du quiz.
 *
 * Algorithme :
 *   1. Equipes >= 6 personnes (`structured_cabinet`/`network`) → Cabinet+.
 *   2. Equipes 2-5 (`small_cabinet`)                            → Cabinet.
 *   3. Solo : choix volume-driven entre Solo (<= 40) / Pro (41-130) /
 *      Cabinet (131-400) / Cabinet+ au-dela.
 *
 * Marge de manoeuvre 30% volonté Tugan : on pousse legerement vers
 * le tier au-dessus pour eviter le user qui sature instantanément.
 */
export function recommendPlan(answers: QuizAnswers): PlanRecommendation {
  const monthlyMissions = clampMonthlyMissions(answers.monthlyMissions)

  // Plan choisi en fonction taille équipe puis volume
  let pick: (typeof PLAN_TABLE)[number]
  if (answers.teamSize === 'network' || answers.teamSize === 'structured_cabinet') {
    pick = PLAN_TABLE[3] // Cabinet+
  } else if (answers.teamSize === 'small_cabinet') {
    pick = PLAN_TABLE[2] // Cabinet
  } else {
    // Solo : choix volume-driven avec 30% marge
    if (monthlyMissions <= 35) pick = PLAN_TABLE[0]
    else if (monthlyMissions <= 130) pick = PLAN_TABLE[1]
    else if (monthlyMissions <= 400) pick = PLAN_TABLE[2]
    else pick = PLAN_TABLE[3]
  }

  const hoursSavedPerMonth = Math.round((monthlyMissions * MINUTES_SAVED_PER_MISSION) / 60)
  const monthlyRevenueUpsideEur = hoursSavedPerMonth * DEFAULT_HOURLY_RATE_EUR
  const roiMultiple =
    pick.monthlyPriceEur > 0 ? Math.round(monthlyRevenueUpsideEur / pick.monthlyPriceEur) : 0

  const rationale = buildRationale({
    answers,
    monthlyMissions,
    pick,
  })

  return {
    planCode: pick.code,
    planName: pick.name,
    monthlyPriceEur: pick.monthlyPriceEur,
    missionsCap: pick.missionsCap,
    overagePriceEur: pick.overagePriceEur,
    monthlyMissions,
    hoursSavedPerMonth,
    hourlyRateEur: DEFAULT_HOURLY_RATE_EUR,
    monthlyRevenueUpsideEur,
    roiMultiple,
    rationale,
  }
}

function buildRationale(params: {
  answers: QuizAnswers
  monthlyMissions: number
  pick: (typeof PLAN_TABLE)[number]
}): string {
  const { answers, monthlyMissions, pick } = params
  const teamLabel =
    answers.teamSize === 'solo'
      ? 'en solo'
      : answers.teamSize === 'small_cabinet'
        ? 'en cabinet de 2 à 5 personnes'
        : answers.teamSize === 'structured_cabinet'
          ? 'en cabinet structuré de 6 à 15 personnes'
          : 'en franchise ou réseau (15+ personnes)'

  const editorLabel =
    answers.currentEditor === 'liciel'
      ? 'Liciel'
      : answers.currentEditor === 'oris'
        ? 'ORIS'
        : answers.currentEditor === 'obbc'
          ? 'OBBC'
          : answers.currentEditor === 'other'
            ? 'un autre éditeur'
            : null

  const editorSentence = editorLabel
    ? ` Tu restes sur ${editorLabel} pour le calcul et l'envoi ADEME — KOVAS s'installe en couche au-dessus pour la capture terrain et la pré-vérification.`
    : " KOVAS te donne le squelette complet (capture, pré-vérification, exports) ; tu choisis ensuite ton moteur certifié pour l'envoi ADEME."

  return `Tu fais ${monthlyMissions} mission${monthlyMissions > 1 ? 's' : ''} par mois ${teamLabel}. Le plan ${pick.name} est calibré pour ${pick.missionsCap} missions ${
    pick.missionsCap === 1000 ? 'incluses' : 'mensuelles'
  } incluses${
    pick.maxUsers > 1 ? ` et ${pick.maxUsers} utilisateurs` : ''
  }, avec un surplus à ${pick.overagePriceEur.toFixed(2).replace('.', ',')} €/mission si tu débordes.${editorSentence}`
}

/**
 * Décode des reponses quiz depuis searchParams URL. Tolere les valeurs
 * absentes (defaults sains pour fallback page reload). Utilise pour la
 * route /signup/recommendation?team=...&volume=...&editor=...
 */
export function decodeQuizAnswersFromSearchParams(
  params: Record<string, string | string[] | undefined>,
): QuizAnswers {
  const teamRaw = typeof params.team === 'string' ? params.team : 'solo'
  const volumeRaw = typeof params.volume === 'string' ? Number(params.volume) : 30
  const editorRaw = typeof params.editor === 'string' ? params.editor : 'liciel'

  const validTeams: ReadonlyArray<TeamSizeBand> = [
    'solo',
    'small_cabinet',
    'structured_cabinet',
    'network',
  ]
  const validEditors: ReadonlyArray<CurrentEditor> = ['liciel', 'oris', 'obbc', 'none', 'other']

  const teamSize = validTeams.includes(teamRaw as TeamSizeBand) ? (teamRaw as TeamSizeBand) : 'solo'
  const currentEditor = validEditors.includes(editorRaw as CurrentEditor)
    ? (editorRaw as CurrentEditor)
    : 'liciel'
  const monthlyMissions = clampMonthlyMissions(Number.isFinite(volumeRaw) ? volumeRaw : 30)

  return { teamSize, monthlyMissions, currentEditor }
}

/**
 * Encode les réponses du quiz pour passer à la page recommendation.
 */
export function encodeQuizAnswersToSearchParams(answers: QuizAnswers): string {
  const sp = new URLSearchParams({
    team: answers.teamSize,
    volume: String(answers.monthlyMissions),
    editor: answers.currentEditor,
  })
  return sp.toString()
}
