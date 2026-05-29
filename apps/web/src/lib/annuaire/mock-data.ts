/**
 * Data-access annuaire dashboard — Reviews + Stats.
 *
 * Historique
 * ----------
 * Ce fichier exposait jusqu'au 2026-06-28 des données 100% mockées (avis
 * "Sophie M.", stats générées par multiplicateurs). Bloc C l'a rebranché sur
 * de VRAIES données du diagnostiqueur connecté :
 *  - Reviews : table `marketplace_reviews` (migration 20260628400000) +
 *    synthèse Google agrégée (`diagnosticians.gmb_rating` / `gmb_review_count`).
 *  - Stats   : `diagnosticians.view_count` / `quote_request_count`,
 *    `lead_assignments` (leads reçus / acceptés), `marketplace_reviews` (note).
 *
 * Le nom de fichier (`mock-data.ts`) est conservé pour ne pas casser les imports
 * existants (reviews/page.tsx + stats/page.tsx). Les signatures des helpers
 * publics restent stables (mêmes noms), mais prennent désormais le client
 * Supabase en premier argument pour interroger la base.
 *
 * Honnêteté des données (cf. spec Bloc C)
 * ---------------------------------------
 * Certaines métriques n'existent pas en base et ne sont donc PAS inventées :
 *  - séries temporelles / variation période N-1 : pas d'historique snapshot →
 *    `previousValue` retourné = `value` (variation 0 %, marquée "Bientôt" en UI).
 *  - sources de trafic détaillées : pas de tracking par source → retiré.
 *  - benchmark zone précis : pas d'agrégat par département en base → retiré.
 *  - temps de réponse moyen aux leads : pas de mesure fiable → retiré.
 * Cf. AnnuaireStatsSnapshot ci-dessous (champs supprimés vs ancien mock).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// Le type Database n'est pas régénéré pour `marketplace_reviews` (migration non
// encore appliquée). On utilise un client non typé localisé plutôt qu'un `any`
// global — chaque requête caste explicitement la shape attendue.
// biome-ignore lint/suspicious/noExplicitAny: types DB Supabase en attente de régénération (migration 20260628400000 non appliquée)
type UntypedSupabase = SupabaseClient<any, any, any>

/* ------------------------------------------------------------------ */
/* TYPES — Reviews                                                    */
/* ------------------------------------------------------------------ */

export type ReviewCriterion = 'ponctualite' | 'professionnalisme' | 'qualite' | 'prix'

/** Provenance d'un avis natif. */
export type ReviewSource = 'kovas' | 'google' | 'import'

export interface AnnuaireReview {
  id: string
  /** Note de 1 à 5 (entier). */
  rating: 1 | 2 | 3 | 4 | 5
  /** Prénom + initiale nom — pseudonymisation type GMB. */
  authorDisplayName: string
  /** Ville déclarée par l'auteur (peut être null). */
  authorCity: string | null
  /** Provenance (kovas / google / import). */
  source: ReviewSource
  /** ISO date string — moment de publication. */
  publishedAt: string
  /** Texte de l'avis. */
  body: string
  /**
   * Critères validés par le client. La table `marketplace_reviews` ne stocke
   * pas (encore) ce détail → tableau vide en V1. Conservé dans le type pour ne
   * pas casser le rendu existant.
   */
  criteria: ReadonlyArray<ReviewCriterion>
  /** Réponse du diagnostiqueur (si répondu). null sinon. */
  response: {
    body: string
    respondedAt: string
  } | null
  /** Helper "cette semaine" (calculé depuis publishedAt). */
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
  /**
   * Synthèse Google agrégée (depuis diagnosticians.gmb_*), affichée en
   * complément des avis natifs. null si la fiche n'a pas de données GMB.
   */
  google: {
    rating: number
    reviewCount: number
  } | null
}

export type ReviewFilter = 'all' | 'pending' | 'this-week'

export function isReviewFilter(value: string | undefined): value is ReviewFilter {
  return value === 'all' || value === 'pending' || value === 'this-week'
}

/* ------------------------------------------------------------------ */
/* TYPES — Stats                                                      */
/* ------------------------------------------------------------------ */

export interface StatsPeriodDelta {
  /** Valeur sur la période courante. */
  value: number
  /**
   * Valeur sur la période précédente. En V1 aucun historique snapshot n'est
   * stocké → vaut `value` (variation = 0 %, signalée "Bientôt" côté UI).
   */
  previousValue: number
}

export interface AnnuaireStatsSnapshot {
  period: AnnuaireStatsPeriod
  /** Vues de la fiche (diagnosticians.view_count, cumul). */
  views: StatsPeriodDelta
  /** Leads reçus (count lead_assignments du diagnostiqueur). */
  leads: StatsPeriodDelta
  /** Demandes de devis (diagnosticians.quote_request_count, cumul). */
  quoteRequests: StatsPeriodDelta
  /** Leads acceptés (status='accepted'). */
  acceptedLeads: number
  /**
   * Taux de conversion leads acceptés / leads reçus, en % (0-100, 1 décimale).
   * null si aucun lead reçu (non calculable, affiché "—").
   */
  acceptanceRate: number | null
  /** Note moyenne avis natifs KOVAS (null si 0 avis). */
  averageRating: number | null
  /** Nombre d'avis natifs KOVAS. */
  reviewsCount: number
  /**
   * true si la métrique correspondante repose sur un cumul non historisé
   * (vues / devis). Permet à l'UI d'être honnête : pas de variation période.
   */
  isCumulative: boolean
}

export type AnnuaireStatsPeriod = '7d' | '30d' | '90d' | '1y'

export const PERIOD_LABELS: Record<AnnuaireStatsPeriod, string> = {
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
  '90d': '90 derniers jours',
  '1y': '12 derniers mois',
}

export function isAnnuaireStatsPeriod(value: string | undefined): value is AnnuaireStatsPeriod {
  return value === '7d' || value === '30d' || value === '90d' || value === '1y'
}

/* ------------------------------------------------------------------ */
/* HELPERS INTERNES                                                   */
/* ------------------------------------------------------------------ */

/** Borne une note brute (int) dans 1..5 pour satisfaire le type littéral. */
function clampRating(raw: number): 1 | 2 | 3 | 4 | 5 {
  const r = Math.round(raw)
  if (r <= 1) return 1
  if (r >= 5) return 5
  return r as 2 | 3 | 4
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function isWithinLastWeek(isoDate: string): boolean {
  const t = new Date(isoDate).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t <= SEVEN_DAYS_MS
}

/** Borne d'ancienneté (ISO) correspondant à une période, ou null pour '1y'+. */
function periodSinceIso(period: AnnuaireStatsPeriod): string {
  const days: Record<AnnuaireStatsPeriod, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }
  return new Date(Date.now() - days[period] * 24 * 60 * 60 * 1000).toISOString()
}

/** Shape brute d'une ligne marketplace_reviews (sélection partielle). */
interface RawReviewRow {
  id: string
  rating: number | null
  author_name: string | null
  author_city: string | null
  source: string | null
  comment: string | null
  reply: string | null
  reply_at: string | null
  created_at: string
}

function normalizeReview(row: RawReviewRow): AnnuaireReview {
  const source: ReviewSource =
    row.source === 'google' || row.source === 'import' ? row.source : 'kovas'
  return {
    id: row.id,
    rating: clampRating(row.rating ?? 0),
    authorDisplayName: row.author_name?.trim() || 'Client',
    authorCity: row.author_city?.trim() || null,
    source,
    publishedAt: row.created_at,
    body: row.comment?.trim() || '',
    criteria: [],
    response: row.reply ? { body: row.reply, respondedAt: row.reply_at ?? row.created_at } : null,
    isThisWeek: isWithinLastWeek(row.created_at),
  }
}

/* ------------------------------------------------------------------ */
/* PUBLIC — Reviews                                                   */
/* ------------------------------------------------------------------ */

/**
 * Liste des avis publiés du diagnostiqueur, du plus récent au plus ancien.
 * Filtre optionnel : 'pending' (sans réponse) | 'this-week'.
 * Retourne un tableau vide si la fiche n'est pas réclamée (id null) ou en cas
 * d'erreur / table absente (RLS isole déjà les avis du propriétaire).
 */
export async function getReviewsForDiagnostician(
  supabase: UntypedSupabase,
  diagnosticianId: string | null,
  filter: ReviewFilter = 'all',
): Promise<ReadonlyArray<AnnuaireReview>> {
  if (!diagnosticianId) return []

  try {
    const { data, error } = await supabase
      .from('marketplace_reviews')
      .select('id, rating, author_name, author_city, source, comment, reply, reply_at, created_at')
      .eq('diagnostician_id', diagnosticianId)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error || !data) return []

    const all = (data as RawReviewRow[]).map(normalizeReview)
    if (filter === 'pending') return all.filter((r) => r.response === null)
    if (filter === 'this-week') return all.filter((r) => r.isThisWeek)
    return all
  } catch {
    return []
  }
}

/**
 * Résumé agrégé des avis natifs (note moyenne, distribution, pending) +
 * synthèse Google (gmb_rating / gmb_review_count) en complément.
 *
 * Toujours basé sur l'ensemble des avis publiés (pas filtré).
 */
export async function getReviewsSummary(
  supabase: UntypedSupabase,
  diagnosticianId: string | null,
): Promise<ReviewsSummary> {
  const empty = (): ReviewsSummary => ({
    averageRating: null,
    totalCount: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    pendingResponses: 0,
    thisWeekCount: 0,
    google: null,
  })

  if (!diagnosticianId) return empty()

  let google: ReviewsSummary['google'] = null
  try {
    const { data: diag } = await supabase
      .from('diagnosticians')
      .select('gmb_rating, gmb_review_count')
      .eq('id', diagnosticianId)
      .maybeSingle()

    const gmbRating =
      typeof diag?.gmb_rating === 'number' ? diag.gmb_rating : Number(diag?.gmb_rating)
    const gmbCount = typeof diag?.gmb_review_count === 'number' ? diag.gmb_review_count : 0
    if (Number.isFinite(gmbRating) && gmbRating > 0 && gmbCount > 0) {
      google = { rating: gmbRating, reviewCount: gmbCount }
    }
  } catch {
    google = null
  }

  let rows: RawReviewRow[] = []
  try {
    const { data } = await supabase
      .from('marketplace_reviews')
      .select('id, rating, author_name, author_city, source, comment, reply, reply_at, created_at')
      .eq('diagnostician_id', diagnosticianId)
      .eq('status', 'published')
      .limit(500)
    rows = (data as RawReviewRow[] | null) ?? []
  } catch {
    rows = []
  }

  const reviews = rows.map(normalizeReview)
  const totalCount = reviews.length

  if (totalCount === 0) {
    return { ...empty(), google }
  }

  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let sumRatings = 0
  let pendingResponses = 0
  let thisWeekCount = 0

  for (const review of reviews) {
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
    google,
  }
}

/* ------------------------------------------------------------------ */
/* PUBLIC — Stats                                                     */
/* ------------------------------------------------------------------ */

/**
 * Snapshot stats annuaire branché sur de VRAIES données :
 *  - views / quoteRequests : compteurs cumulés `diagnosticians`.
 *  - leads / acceptedLeads : count `lead_assignments` (filtré période pour les
 *    leads reçus via notified_at).
 *  - averageRating / reviewsCount : `marketplace_reviews`.
 *
 * Aucune valeur n'est inventée : faute d'historique snapshot, `previousValue`
 * vaut `value` (l'UI marque alors "Bientôt" plutôt qu'une fausse variation).
 */
export async function getAnnuaireStatsSnapshot(
  supabase: UntypedSupabase,
  diagnosticianId: string | null,
  period: AnnuaireStatsPeriod,
): Promise<AnnuaireStatsSnapshot> {
  const empty = (): AnnuaireStatsSnapshot => ({
    period,
    views: { value: 0, previousValue: 0 },
    leads: { value: 0, previousValue: 0 },
    quoteRequests: { value: 0, previousValue: 0 },
    acceptedLeads: 0,
    acceptanceRate: null,
    averageRating: null,
    reviewsCount: 0,
    isCumulative: true,
  })

  if (!diagnosticianId) return empty()

  // 1. Compteurs cumulés de la fiche (vues + demandes de devis).
  let views = 0
  let quoteRequests = 0
  try {
    const { data: diag } = await supabase
      .from('diagnosticians')
      .select('view_count, quote_request_count')
      .eq('id', diagnosticianId)
      .maybeSingle()
    views = typeof diag?.view_count === 'number' ? diag.view_count : 0
    quoteRequests = typeof diag?.quote_request_count === 'number' ? diag.quote_request_count : 0
  } catch {
    /* laisse 0 */
  }

  // 2. Leads reçus sur la période (lead_assignments.notified_at >= since).
  const since = periodSinceIso(period)
  let leadsReceived = 0
  let acceptedLeads = 0
  try {
    const { count: receivedCount } = await supabase
      .from('lead_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('diagnostician_id', diagnosticianId)
      .gte('notified_at', since)
    leadsReceived = receivedCount ?? 0

    const { count: acceptedCount } = await supabase
      .from('lead_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('diagnostician_id', diagnosticianId)
      .eq('status', 'accepted')
      .gte('notified_at', since)
    acceptedLeads = acceptedCount ?? 0
  } catch {
    leadsReceived = 0
    acceptedLeads = 0
  }

  const acceptanceRate =
    leadsReceived > 0 ? Math.round((acceptedLeads / leadsReceived) * 1000) / 10 : null

  // 3. Note moyenne + nb avis natifs.
  const summary = await getReviewsSummary(supabase, diagnosticianId)

  return {
    period,
    views: { value: views, previousValue: views },
    leads: { value: leadsReceived, previousValue: leadsReceived },
    quoteRequests: { value: quoteRequests, previousValue: quoteRequests },
    acceptedLeads,
    acceptanceRate,
    averageRating: summary.averageRating,
    reviewsCount: summary.totalCount,
    isCumulative: true,
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

/** Helper : récupère le diagnostician_id réclamé par l'user courant. */
export async function getClaimedDiagnosticianId(
  supabase: UntypedSupabase,
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
