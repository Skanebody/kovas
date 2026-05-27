/**
 * KOVAS — Système 8 : Lead scoring temps réel (visiteurs site marketing).
 *
 * Types et helpers pour modéliser le comportement d'un visiteur sur le site
 * marketing kovas.fr (pages publiques + landing). Différent de l'algo
 * A1.3.5 (`lib/algos/lead-scoring.ts`) qui couvre les `quote_requests` B2C
 * de l'annuaire : ici on score les visiteurs (anonymes ou identifiés) pour
 * personnaliser le messaging affiché et déclencher des actions auto.
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §11 (Lead scoring temps réel).
 *
 * Pure data layer, zéro IO. La persistence du `VisitorBehavior` (cookies,
 * localStorage, Supabase `visitor_sessions`) est faite par le caller.
 */

export type VisitorSource =
  | 'organic_search'
  | 'linkedin'
  | 'direct'
  | 'referral'
  | 'paid_ads'
  | 'tiktok'
  | 'newsletter'
  | 'press'
  | 'unknown'

export type VisitorDevice = 'mobile' | 'tablet' | 'desktop'

export interface VisitorBehavior {
  /** ID de session (cookie KOVAS_SID ou auth user_id si identifié) */
  session_id: string
  /** True si user connecté (lien avec `auth.users`) */
  is_authenticated: boolean
  /** Visiteur déjà venu (≥ 2 sessions historiques) */
  is_returning_visitor: boolean
  /** Nombre de sessions historiques (1 = premier passage) */
  sessions_count: number

  /** Source de trafic (utm_source canonisé) */
  utm_source: VisitorSource
  /** Campagne UTM si applicable (ex : "linkedin-Q2-diagnostiqueurs") */
  utm_campaign: string | null

  /** Pages visitées dans la session (dédupliquées) */
  pages_viewed: ReadonlyArray<string>
  /** Nombre de pages distinctes visitées */
  page_count: number
  /** A visité /tarifs (intent commercial) */
  has_visited_pricing: boolean
  /** A visité /fonctionnalites */
  has_visited_features: boolean
  /** A visité /blog/* ou /guide/* */
  has_visited_blog_or_guides: boolean
  /** A visité /a-propos (parcours Benjamin + témoignages) */
  has_visited_testimonials: boolean
  /** A visité /calculateur-dpe-gratuit */
  has_visited_calculator: boolean
  /** A visité /observatoire */
  has_visited_observatory: boolean
  /** A visité /trouver-un-diagnostiqueur/* */
  has_visited_annuaire: boolean

  /** Temps cumulé sur le site (secondes) */
  time_on_site_seconds: number
  /** Profondeur de scroll max observée toutes pages confondues (0-100) */
  scroll_depth_max: number
  /** Vidéos regardées (lecture > 25%) */
  videos_watched_count: number

  /** A soumis le formulaire newsletter */
  has_signed_up_newsletter: boolean
  /** A cliqué "Démarrer mon essai" (entrée flow signup) */
  has_started_signup_flow: boolean
  /** A entamé le signup mais l'a abandonné (drop-off) */
  has_abandoned_signup_flow: boolean
  /** A complété le calculateur DPE jusqu'au résultat */
  has_used_calculator_to_completion: boolean
  /** A soumis une demande de devis (annuaire B2C) */
  has_submitted_quote_request: boolean

  /** Device détecté (proxy : viewport + user-agent côté caller) */
  device: VisitorDevice
  /** 9h-18h FR (UTC+1/+2) — intent pro */
  is_business_hours: boolean
  /** 0=dimanche, 1=lundi, ..., 6=samedi */
  day_of_week: number
}

/**
 * State initial vide pour un nouveau visiteur. Tous les booleans à false,
 * tous les counts à 0, source `unknown` par défaut.
 */
export function buildEmptyBehavior(session_id: string): VisitorBehavior {
  return {
    session_id,
    is_authenticated: false,
    is_returning_visitor: false,
    sessions_count: 1,

    utm_source: 'unknown',
    utm_campaign: null,

    pages_viewed: [],
    page_count: 0,
    has_visited_pricing: false,
    has_visited_features: false,
    has_visited_blog_or_guides: false,
    has_visited_testimonials: false,
    has_visited_calculator: false,
    has_visited_observatory: false,
    has_visited_annuaire: false,

    time_on_site_seconds: 0,
    scroll_depth_max: 0,
    videos_watched_count: 0,

    has_signed_up_newsletter: false,
    has_started_signup_flow: false,
    has_abandoned_signup_flow: false,
    has_used_calculator_to_completion: false,
    has_submitted_quote_request: false,

    device: 'desktop',
    is_business_hours: false,
    day_of_week: 1,
  }
}

/**
 * Détection des routes — mapping pathname → booleans `has_visited_*`.
 *
 * Routes reconnues (case-insensitive, supporte trailing slash) :
 *   - /tarifs | /pricing                       → has_visited_pricing
 *   - /fonctionnalites | /features             → has_visited_features
 *   - /blog/* | /guide/*                       → has_visited_blog_or_guides
 *   - /a-propos | /about                       → has_visited_testimonials
 *   - /calculateur-dpe-gratuit                 → has_visited_calculator
 *   - /observatoire                            → has_visited_observatory
 *   - /trouver-un-diagnostiqueur/*             → has_visited_annuaire
 */
function detectRouteFlags(pathname: string): Partial<VisitorBehavior> {
  const normalized = pathname.toLowerCase().replace(/\/+$/, '') || '/'

  if (normalized === '/tarifs' || normalized === '/pricing') {
    return { has_visited_pricing: true }
  }
  if (normalized === '/fonctionnalites' || normalized === '/features') {
    return { has_visited_features: true }
  }
  if (normalized.startsWith('/blog/') || normalized.startsWith('/guide/')) {
    return { has_visited_blog_or_guides: true }
  }
  if (normalized === '/a-propos' || normalized === '/about') {
    return { has_visited_testimonials: true }
  }
  if (normalized === '/calculateur-dpe-gratuit') {
    return { has_visited_calculator: true }
  }
  if (normalized === '/observatoire') {
    return { has_visited_observatory: true }
  }
  if (normalized.startsWith('/trouver-un-diagnostiqueur/')) {
    return { has_visited_annuaire: true }
  }
  return {}
}

/**
 * Merge une nouvelle pageview dans le behavior courant.
 *
 * - Ajoute le pathname à `pages_viewed` (dédupliqué)
 * - Met à jour `page_count` = pages_viewed.length
 * - Cumule `time_on_site_seconds`
 * - `scroll_depth_max` = max(current, new_scroll), clamp 0-100
 * - Active les booleans `has_visited_*` selon le pathname
 *
 * Immutable — retourne un nouvel objet.
 */
export function mergeBehaviorWithPageView(
  current: VisitorBehavior,
  new_pathname: string,
  time_spent_seconds: number,
  scroll_depth: number,
): VisitorBehavior {
  const normalized = new_pathname.toLowerCase().replace(/\/+$/, '') || '/'
  const already_visited = current.pages_viewed.includes(normalized)
  const pages_viewed = already_visited
    ? current.pages_viewed
    : [...current.pages_viewed, normalized]

  const safe_time = Math.max(0, time_spent_seconds)
  const safe_scroll = Math.max(0, Math.min(100, scroll_depth))

  const flags = detectRouteFlags(new_pathname)

  return {
    ...current,
    pages_viewed,
    page_count: pages_viewed.length,
    time_on_site_seconds: current.time_on_site_seconds + safe_time,
    scroll_depth_max: Math.max(current.scroll_depth_max, safe_scroll),
    has_visited_pricing: current.has_visited_pricing || flags.has_visited_pricing === true,
    has_visited_features: current.has_visited_features || flags.has_visited_features === true,
    has_visited_blog_or_guides:
      current.has_visited_blog_or_guides || flags.has_visited_blog_or_guides === true,
    has_visited_testimonials:
      current.has_visited_testimonials || flags.has_visited_testimonials === true,
    has_visited_calculator: current.has_visited_calculator || flags.has_visited_calculator === true,
    has_visited_observatory:
      current.has_visited_observatory || flags.has_visited_observatory === true,
    has_visited_annuaire: current.has_visited_annuaire || flags.has_visited_annuaire === true,
  }
}
