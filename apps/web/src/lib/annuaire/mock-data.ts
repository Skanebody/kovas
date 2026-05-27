/**
 * Mock data V1 pour le dashboard annuaire — Reviews + Stats.
 *
 * Pourquoi mock ?
 * --------------
 * À date (2026-05-27) il n'existe pas de table `marketplace_reviews` ou
 * `diagnostician_reviews` dans `supabase/migrations`. La colonne
 * `diagnosticians.gmb_rating` stocke uniquement la moyenne agrégée Google My
 * Business, sans les avis détaillés.
 *
 * Plutôt que d'ajouter une nouvelle migration (interdit par la spec agent),
 * on expose ici une interface typée + données mockées calibrées sur un
 * diagnostiqueur réaliste à ~50 avis. Le jour où la table existe, on
 * remplacera l'implémentation des helpers sans changer leur signature.
 *
 * Aucune dépendance Supabase ici → utilisable en Server Component pur.
 */

export type ReviewCriterion = 'ponctualite' | 'professionnalisme' | 'qualite' | 'prix'

export interface AnnuaireReview {
  id: string
  /** Note de 1 à 5 (entier). */
  rating: 1 | 2 | 3 | 4 | 5
  /** Prénom + initiale nom — pseudonymisation type GMB. */
  authorDisplayName: string
  /** ISO date string — moment de publication. */
  publishedAt: string
  /** Texte de l'avis (peut faire +500 chars). */
  body: string
  /** Critères validés par le client lors du dépôt d'avis. */
  criteria: ReadonlyArray<ReviewCriterion>
  /** Réponse du diagnostiqueur (si répondu). null sinon. */
  response: {
    body: string
    respondedAt: string
  } | null
  /** Helper "cette semaine" (calculé côté mock pour stabilité tests). */
  isThisWeek: boolean
}

export interface ReviewsSummary {
  /** Note moyenne arrondie à 1 décimale, ou null si aucun avis. */
  averageRating: number | null
  /** Total d'avis. */
  totalCount: number
  /** Répartition par note (clé = 1..5, valeur = nombre d'avis). */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
  /** Nombre d'avis sans réponse. */
  pendingResponses: number
  /** Nombre d'avis publiés sur les 7 derniers jours. */
  thisWeekCount: number
}

export interface StatsPeriodDelta {
  /** Valeur sur la période courante. */
  value: number
  /** Valeur sur la période précédente — pour calcul variation. */
  previousValue: number
}

export interface TrafficSource {
  label: string
  visits: number
}

export interface ResponseTimeBucket {
  /** Libellé tranche : "<30min", "30min-2h", etc. */
  label: string
  /** Nombre de leads tombant dans cette tranche. */
  count: number
}

export interface ZoneBenchmark {
  label: string
  /** Décile de l'utilisateur dans sa zone : 10 = top 10%, 25 = top 25%, etc. */
  percentile: 10 | 25 | 50
  /** Valeur formatée affichée (ex: "1 240" ou "4,9★"). */
  displayValue: string
  /** Position 0..1 sur la barre (1 = meilleur). */
  positionRatio: number
}

export interface AnnuaireStatsSnapshot {
  period: AnnuaireStatsPeriod
  views: StatsPeriodDelta
  leads: StatsPeriodDelta
  conversionRate: StatsPeriodDelta
  trafficSources: ReadonlyArray<TrafficSource>
  responseTime: {
    /** Temps moyen en minutes. */
    averageMinutes: number
    distribution: ReadonlyArray<ResponseTimeBucket>
  }
  zoneBenchmark: ReadonlyArray<ZoneBenchmark>
}

export type AnnuaireStatsPeriod = '7d' | '30d' | '90d' | '1y'

export const PERIOD_LABELS: Record<AnnuaireStatsPeriod, string> = {
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
  '90d': '90 derniers jours',
  '1y': '12 derniers mois',
}

/* ------------------------------------------------------------------ */
/* MOCK DATASET                                                       */
/* ------------------------------------------------------------------ */

const MOCK_REVIEWS: ReadonlyArray<AnnuaireReview> = [
  {
    id: 'rev-001',
    rating: 5,
    authorDisplayName: 'Sophie M.',
    publishedAt: '2026-05-24T10:14:00Z',
    body: 'Diagnostic DPE réalisé sur notre maison à Dieppe. Très ponctuel, explications claires, rapport reçu dès le lendemain. Je recommande sans hésiter, prestation très professionnelle et tarif honnête.',
    criteria: ['ponctualite', 'professionnalisme', 'qualite', 'prix'],
    response: null,
    isThisWeek: true,
  },
  {
    id: 'rev-002',
    rating: 5,
    authorDisplayName: 'Jean-Paul R.',
    publishedAt: '2026-05-22T09:00:00Z',
    body: 'Intervention pour un pack DPE + amiante + plomb avant vente. Tout a été fait en une seule visite, gain de temps appréciable. Rapport très complet et bien documenté avec photos.',
    criteria: ['ponctualite', 'professionnalisme', 'qualite'],
    response: {
      body: "Merci Jean-Paul pour votre retour. Le pack groupé est en effet la solution la plus efficace pour les ventes. Au plaisir d'intervenir à nouveau si besoin.",
      respondedAt: '2026-05-22T18:30:00Z',
    },
    isThisWeek: true,
  },
  {
    id: 'rev-003',
    rating: 5,
    authorDisplayName: 'Claire D.',
    publishedAt: '2026-05-18T14:42:00Z',
    body: 'Excellent travail sur le diagnostic plomb. Très pédagogue, a pris le temps de tout expliquer à mes parents âgés. Tarif transparent annoncé dès le devis, aucune mauvaise surprise.',
    criteria: ['ponctualite', 'professionnalisme', 'qualite', 'prix'],
    response: null,
    isThisWeek: true,
  },
  {
    id: 'rev-004',
    rating: 4,
    authorDisplayName: 'Marc L.',
    publishedAt: '2026-05-10T11:20:00Z',
    body: 'Bonne prestation pour le DPE de mon appartement. Petit retard de 20 minutes le jour du rendez-vous mais sinon rien à redire. Rapport reçu rapidement.',
    criteria: ['professionnalisme', 'qualite'],
    response: {
      body: 'Merci Marc. Je note le retard, dû à un client précédent qui a souhaité plus de détails. La prochaine fois je préviendrai par SMS, promis.',
      respondedAt: '2026-05-10T19:05:00Z',
    },
    isThisWeek: false,
  },
  {
    id: 'rev-005',
    rating: 5,
    authorDisplayName: 'Isabelle T.',
    publishedAt: '2026-05-05T08:55:00Z',
    body: 'Diagnostic ERP et état des risques pour location saisonnière. Très réactif, devis le jour même, intervention sous 48h. Parfait.',
    criteria: ['ponctualite', 'professionnalisme', 'prix'],
    response: null,
    isThisWeek: false,
  },
  {
    id: 'rev-006',
    rating: 5,
    authorDisplayName: 'Pierre B.',
    publishedAt: '2026-04-28T16:10:00Z',
    body: 'Pack DPE + amiante + termites pour la vente de la maison familiale. Tout est nickel, photos très propres, schémas clairs. Le notaire a tout validé sans aucune réserve.',
    criteria: ['ponctualite', 'professionnalisme', 'qualite', 'prix'],
    response: {
      body: 'Merci Pierre. Bonne suite pour la vente.',
      respondedAt: '2026-04-28T20:00:00Z',
    },
    isThisWeek: false,
  },
  {
    id: 'rev-007',
    rating: 4,
    authorDisplayName: 'Nathalie F.',
    publishedAt: '2026-04-20T13:30:00Z',
    body: "Diagnostic gaz et électricité réalisé sérieusement. J'aurais aimé un peu plus de pédagogie sur les points de non-conformité relevés, mais le rapport écrit compense bien.",
    criteria: ['professionnalisme', 'qualite'],
    response: null,
    isThisWeek: false,
  },
  {
    id: 'rev-008',
    rating: 5,
    authorDisplayName: 'Olivier C.',
    publishedAt: '2026-04-12T09:45:00Z',
    body: "Très satisfait. Le diagnostiqueur est arrivé pile à l'heure, équipement professionnel, méthodique. Le rapport DPE est très lisible et j'ai apprécié les recommandations de travaux personnalisées.",
    criteria: ['ponctualite', 'professionnalisme', 'qualite', 'prix'],
    response: {
      body: "Merci Olivier. Pour les recommandations travaux, n'hésitez pas si vous souhaitez un accompagnement complémentaire avant de lancer un devis MAR.",
      respondedAt: '2026-04-12T22:30:00Z',
    },
    isThisWeek: false,
  },
  {
    id: 'rev-009',
    rating: 5,
    authorDisplayName: 'Aurélie V.',
    publishedAt: '2026-04-03T11:00:00Z',
    body: 'Carrez/Boutin pour mise en location. Mesures précises, rapport envoyé le soir même. Tarif aligné sur la concurrence et qualité supérieure. Je rappellerai pour mes autres biens.',
    criteria: ['ponctualite', 'professionnalisme', 'qualite', 'prix'],
    response: null,
    isThisWeek: false,
  },
  {
    id: 'rev-010',
    rating: 5,
    authorDisplayName: 'Thomas G.',
    publishedAt: '2026-03-28T15:20:00Z',
    body: 'Pack complet avant vente. Communication impeccable du devis au rapport final. Je recommande à tous mes proches qui ont des projets immobiliers.',
    criteria: ['ponctualite', 'professionnalisme', 'qualite'],
    response: {
      body: 'Merci Thomas pour la confiance et les recommandations. À bientôt.',
      respondedAt: '2026-03-29T08:15:00Z',
    },
    isThisWeek: false,
  },
]

/* ------------------------------------------------------------------ */
/* PUBLIC HELPERS — signatures stables pour migration future          */
/* ------------------------------------------------------------------ */

/**
 * Récupère la liste des avis pour le diagnostiqueur courant.
 *
 * V1 = mock. V1.5+ = SELECT depuis `marketplace_reviews` filtré par
 * `diagnostician_id`. Filtre `filter` côté serveur via query param.
 */
export async function getReviewsForDiagnostician(
  _diagnosticianId: string | null,
  filter: ReviewFilter = 'all',
): Promise<ReadonlyArray<AnnuaireReview>> {
  // Tri du plus récent au plus ancien (déjà ordonné dans le mock).
  const all = [...MOCK_REVIEWS]
  if (filter === 'pending') {
    return all.filter((r) => r.response === null)
  }
  if (filter === 'this-week') {
    return all.filter((r) => r.isThisWeek)
  }
  return all
}

export type ReviewFilter = 'all' | 'pending' | 'this-week'

export function isReviewFilter(value: string | undefined): value is ReviewFilter {
  return value === 'all' || value === 'pending' || value === 'this-week'
}

/**
 * Résumé agrégé des avis (note moyenne, distribution, pending).
 *
 * Toujours basé sur l'ensemble du dataset (pas filtré) — l'utilisateur veut
 * voir sa note globale même quand il filtre "sans réponse".
 */
export async function getReviewsSummary(_diagnosticianId: string | null): Promise<ReviewsSummary> {
  const all = [...MOCK_REVIEWS]
  const totalCount = all.length

  if (totalCount === 0) {
    return {
      averageRating: null,
      totalCount: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      pendingResponses: 0,
      thisWeekCount: 0,
    }
  }

  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let sumRatings = 0
  let pendingResponses = 0
  let thisWeekCount = 0

  for (const review of all) {
    distribution[review.rating] += 1
    sumRatings += review.rating
    if (review.response === null) pendingResponses += 1
    if (review.isThisWeek) thisWeekCount += 1
  }

  return {
    averageRating: Math.round((sumRatings / totalCount) * 10) / 10,
    totalCount,
    distribution,
    pendingResponses,
    thisWeekCount,
  }
}

/* ------------------------------------------------------------------ */
/* STATS                                                              */
/* ------------------------------------------------------------------ */

export function isAnnuaireStatsPeriod(value: string | undefined): value is AnnuaireStatsPeriod {
  return value === '7d' || value === '30d' || value === '90d' || value === '1y'
}

/**
 * Récupère le snapshot stats annuaire pour une période donnée.
 *
 * V1 = mock calibré sur un Diagnostiqueur Boost-tier moyen (~1200 vues/mo).
 * Variations cohérentes par période pour donner un sentiment réaliste.
 */
export async function getAnnuaireStatsSnapshot(
  _diagnosticianId: string | null,
  period: AnnuaireStatsPeriod,
): Promise<AnnuaireStatsSnapshot> {
  // Multiplicateurs simulant le passage 7d -> 30d -> 90d -> 1y
  const periodMultiplier: Record<AnnuaireStatsPeriod, number> = {
    '7d': 0.25,
    '30d': 1,
    '90d': 3.1,
    '1y': 11.4,
  }
  const mult = periodMultiplier[period]

  const viewsCurrent = Math.round(1248 * mult)
  const viewsPrevious = Math.round(1116 * mult)
  const leadsCurrent = Math.round(34 * mult)
  const leadsPrevious = Math.round(28 * mult)
  // Conversion en % (0-100, 1 décimale conservée *10 pour précision)
  const conversionCurrent = Math.round((leadsCurrent / Math.max(viewsCurrent, 1)) * 1000) / 10
  const conversionPrevious = Math.round((leadsPrevious / Math.max(viewsPrevious, 1)) * 1000) / 10

  return {
    period,
    views: { value: viewsCurrent, previousValue: viewsPrevious },
    leads: { value: leadsCurrent, previousValue: leadsPrevious },
    conversionRate: { value: conversionCurrent, previousValue: conversionPrevious },
    trafficSources: [
      { label: 'Recherche Google', visits: Math.round(viewsCurrent * 0.48) },
      { label: 'Annuaire KOVAS', visits: Math.round(viewsCurrent * 0.29) },
      { label: 'Google My Business', visits: Math.round(viewsCurrent * 0.16) },
      { label: 'Accès direct', visits: Math.round(viewsCurrent * 0.07) },
    ],
    responseTime: {
      averageMinutes: 42,
      distribution: [
        { label: 'Moins de 30 min', count: Math.round(leadsCurrent * 0.45) },
        { label: '30 min à 2 h', count: Math.round(leadsCurrent * 0.32) },
        { label: '2 h à 24 h', count: Math.round(leadsCurrent * 0.18) },
        { label: 'Plus de 24 h', count: Math.round(leadsCurrent * 0.05) },
      ],
    },
    zoneBenchmark: [
      {
        label: 'Vues fiche',
        percentile: 25,
        displayValue: viewsCurrent.toLocaleString('fr-FR'),
        positionRatio: 0.78,
      },
      {
        label: 'Note moyenne',
        percentile: 10,
        displayValue: '4,9 / 5',
        positionRatio: 0.94,
      },
      {
        label: 'Réactivité',
        percentile: 10,
        displayValue: '42 min',
        positionRatio: 0.91,
      },
      {
        label: 'Conversion',
        percentile: 25,
        displayValue: `${conversionCurrent.toLocaleString('fr-FR')} %`,
        positionRatio: 0.74,
      },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* SHARED UTILITIES                                                   */
/* ------------------------------------------------------------------ */

const CRITERION_LABELS: Record<ReviewCriterion, string> = {
  ponctualite: 'Ponctualité',
  professionnalisme: 'Professionnalisme',
  qualite: 'Qualité',
  prix: 'Prix',
}

export function getCriterionLabel(c: ReviewCriterion): string {
  return CRITERION_LABELS[c]
}

const FR_MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const

/** Format date FR "Avril 2026" pour l'auteur d'avis. */
export function formatReviewDate(isoDate: string): string {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return ''
  return `${FR_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** Calcul variation % entre deux valeurs (positive ou négative). */
export function computeVariation(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100
  return Math.round(((current - previous) / previous) * 1000) / 10
}

/** Helper : récupère le diagnostician_id réclamé par l'user courant (V1 = null OK pour mock). */
export async function getClaimedDiagnosticianId(
  // biome-ignore lint/suspicious/noExplicitAny: Supabase typed client en attente regen
  supabase: any,
  userId: string,
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('diagnosticians')
      .select('id')
      .eq('claimed_by_user_id', userId)
      .limit(1)
      .maybeSingle()
    return (data?.id as string | undefined) ?? null
  } catch {
    return null
  }
}
