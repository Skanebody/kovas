/**
 * Helper Insights IA contextuels — Section 5 du Dashboard Home.
 *
 * V1 : mocks statiques (3 insights pertinents pour le profil diagnostiqueur typique).
 * V2 (futur) : remplacer `getUserInsights` par un SELECT sur la table `daily_insights`
 *              alimentée par un cron Edge Function + génération Claude Sonnet à partir
 *              du contexte org (planning, missions, quota, météo, season, streak).
 *
 * Authority : section 5 spec « KOVAS — TABLEAU DE BORD (HOME DASHBOARD) ».
 * Avatar : ton SOBRE PROFESSIONNEL, vouvoiement, pas d'emoji, pas de gaming.
 */

export type InsightType =
  /** Lead matching planning libre (créneau ouvert + zone demandée). */
  | 'opportunity'
  /** Client > 5 missions / 6 mois — fidélité à valoriser. */
  | 'recurring_client'
  /** > 85% quota mensuel atteint — anticiper upgrade ou plafond. */
  | 'quota_warning'
  /** Erreurs récurrentes détectées (cohérence pré-export). */
  | 'pattern_anomaly'
  /** Pic saisonnier MaPrimeRénov (rentrée, fin d'année). */
  | 'season_maprenov'
  /** Météo défavorable + missions extérieures planifiées. */
  | 'weather'
  /** Jalon streak (30 j consécutifs, 100ème mission, etc.). */
  | 'streak_milestone'

export type InsightIconKey = 'calendar' | 'users' | 'gauge' | 'trending-up' | 'flame' | 'cloud-rain'

export interface InsightCta {
  label: string
  href: string
}

export interface DashboardInsight {
  id: string
  type: InsightType
  title: string
  message: string
  ctaPrimary: InsightCta
  ctaSecondary?: InsightCta
  iconKey: InsightIconKey
}

/**
 * Renvoie 2 à 4 insights actionnables pour l'organisation donnée.
 *
 * V1 : 3 mocks statiques, déterministes (pas de random) pour stabilité E2E.
 * V2 : interroger `daily_insights` (id, type, payload, dismissed_at, expires_at),
 *      filtrer expired/dismissed, classer par priorité (opportunity > quota > pattern).
 */
export async function getUserInsights(_orgId: string): Promise<DashboardInsight[]> {
  // Mocks V1 — 3 insights variés, ton sobre, CTAs vers pages existantes.
  return [
    {
      id: 'mock-opp-1',
      type: 'opportunity',
      title: 'Vous avez 2 h de libre demain matin',
      message:
        'Plusieurs demandes de DPE rapides arrivent régulièrement sur votre zone. Ce créneau pourrait accueillir une ou deux missions supplémentaires.',
      ctaPrimary: { label: 'Voir mes leads', href: '/dashboard/leads/incoming' },
      ctaSecondary: { label: 'Plus tard', href: '#' },
      iconKey: 'calendar',
    },
    {
      id: 'mock-recurring-1',
      type: 'recurring_client',
      title: 'Agence Martin & Co : 6 missions ce semestre',
      message:
        "C'est l'un de vos clients les plus fidèles. Un message de remerciement ou une remise sur le prochain dossier peut consolider la relation.",
      ctaPrimary: { label: 'Ouvrir la fiche client', href: '/dashboard/clients' },
      ctaSecondary: { label: 'Plus tard', href: '#' },
      iconKey: 'users',
    },
    {
      id: 'mock-quota-1',
      type: 'quota_warning',
      title: 'Vous approchez de votre quota mensuel',
      message:
        '87 missions effectuées sur 100 incluses dans votre forfait Pro. Les missions au-delà seront facturées 0,79 € pièce.',
      ctaPrimary: { label: 'Voir mon forfait', href: '/dashboard/compte/tarifs' },
      ctaSecondary: { label: 'Plus tard', href: '#' },
      iconKey: 'gauge',
    },
  ]
}
