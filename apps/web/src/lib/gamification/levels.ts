/**
 * Définition des 7 statuts professionnels KOVAS.
 *
 * AVATAR CLIENT — cf. docs/avatar-client.md :
 *   diagnostiqueur 43 ans, ex-cadre reconverti, ton SOBRE PROFESSIONNEL.
 *   JAMAIS gaming/lifestyle/millennial.
 *   Vocabulaire : « Professionnel », « Sénior », « Confirmé » — pas « Hero/Légende ».
 *
 * Aucune récompense tarifaire — uniquement reconnaissance d'engagement.
 * La progression est calculée par `progression-engine.ts`.
 */

export type LevelId = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type LevelLabel =
  | 'Utilisateur Pro'
  | 'Confirmé'
  | 'Sénior'
  | 'Premium'
  | 'Ambassadeur'
  | 'Fidèle'
  | 'Expert'

export interface LevelCriteria {
  /** Missions cumulées (total_missions) */
  missions?: number
  /** Ancienneté d'abonnement en jours */
  subscriptionDays?: number
  /** Filleuls payants (status='paid_invoice_1' ou 'rewarded') */
  referralsPaid?: number
  /** Score ADEME export 0..1 (ratio dossiers conformes) */
  ademeScore?: number
  /** Si true, TOUS les critères définis doivent être satisfaits (AND).
   *  Sinon : OU (un seul suffit). */
  requireAll?: boolean
}

export interface Level {
  id: LevelId
  label: LevelLabel
  description: string
  unlockCriteria: LevelCriteria
  /** Couleur du ring/icône — palette KOVAS V5 stricte */
  iconColor: 'navy' | 'ink-soft' | 'ink-mute' | 'chartreuse' | 'chartreuse-deep'
}

export const LEVELS: readonly Level[] = [
  {
    id: 1,
    label: 'Utilisateur Pro',
    description: 'Statut attribué à la création de votre compte. Vous démarrez votre parcours sur KOVAS.',
    unlockCriteria: {},
    iconColor: 'ink-mute',
  },
  {
    id: 2,
    label: 'Confirmé',
    description: 'Vous avez pris vos repères sur la plateforme. 10 missions ou 30 jours d\'usage suffisent.',
    unlockCriteria: { missions: 10, subscriptionDays: 30 },
    iconColor: 'ink-soft',
  },
  {
    id: 3,
    label: 'Sénior',
    description: 'Votre pratique de KOVAS est solidement établie. 50 missions ou 6 mois d\'abonnement.',
    unlockCriteria: { missions: 50, subscriptionDays: 180 },
    iconColor: 'navy',
  },
  {
    id: 4,
    label: 'Premium',
    description: 'Vous figurez parmi les diagnostiqueurs les plus actifs. 150 missions ou 12 mois d\'abonnement.',
    unlockCriteria: { missions: 150, subscriptionDays: 365 },
    iconColor: 'chartreuse',
  },
  {
    id: 5,
    label: 'Ambassadeur',
    description: 'Vous contribuez au réseau KOVAS. 300 missions, ou 3 filleuls ayant payé leur 1re facture.',
    unlockCriteria: { missions: 300, referralsPaid: 3 },
    iconColor: 'chartreuse',
  },
  {
    id: 6,
    label: 'Fidèle',
    description: 'Vous accompagnez KOVAS depuis 18 mois consécutifs. Une marque de confiance durable.',
    unlockCriteria: { subscriptionDays: 540 },
    iconColor: 'chartreuse-deep',
  },
  {
    id: 7,
    label: 'Expert',
    description: 'Maîtrise confirmée du métier et de la plateforme. 500+ missions, 24+ mois d\'abonnement, score ADEME ≥ 95 %.',
    unlockCriteria: {
      missions: 500,
      subscriptionDays: 730,
      ademeScore: 0.95,
      requireAll: true,
    },
    iconColor: 'chartreuse-deep',
  },
]

/**
 * Retourne le niveau le plus élevé satisfait par les compteurs courants.
 * Pour les niveaux à critères multiples sans `requireAll`, OU logique :
 * un seul critère suffit. Avec `requireAll=true` (Expert) : AND.
 */
export function highestLevelFor(stats: {
  totalMissions: number
  subscriptionDays: number
  totalReferralsPaid: number
  ademeExportScore: number | null
}): Level {
  // On parcourt du plus élevé au plus bas
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (matchesCriteria(LEVELS[i], stats)) {
      return LEVELS[i]
    }
  }
  return LEVELS[0]
}

export function matchesCriteria(
  level: Level,
  stats: {
    totalMissions: number
    subscriptionDays: number
    totalReferralsPaid: number
    ademeExportScore: number | null
  },
): boolean {
  const c = level.unlockCriteria

  // Niveau 1 — toujours satisfait
  if (Object.keys(c).filter((k) => k !== 'requireAll').length === 0) return true

  const checks: boolean[] = []
  if (c.missions !== undefined) {
    checks.push(stats.totalMissions >= c.missions)
  }
  if (c.subscriptionDays !== undefined) {
    checks.push(stats.subscriptionDays >= c.subscriptionDays)
  }
  if (c.referralsPaid !== undefined) {
    checks.push(stats.totalReferralsPaid >= c.referralsPaid)
  }
  if (c.ademeScore !== undefined) {
    checks.push((stats.ademeExportScore ?? 0) >= c.ademeScore)
  }

  if (checks.length === 0) return false

  return c.requireAll === true ? checks.every(Boolean) : checks.some(Boolean)
}

/**
 * Retourne le niveau juste au-dessus du `current`, ou null si Expert atteint.
 */
export function nextLevel(currentId: LevelId): Level | null {
  if (currentId >= 7) return null
  return LEVELS[currentId] ?? null
}

export function getLevelById(id: number): Level | null {
  if (id < 1 || id > 7) return null
  return LEVELS[id - 1] ?? null
}
