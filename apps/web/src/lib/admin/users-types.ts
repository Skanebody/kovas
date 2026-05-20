/**
 * Types partagés pour la section Utilisateurs admin.
 *
 * Tables Supabase utilisées : profiles + memberships + organizations + subscriptions.
 * Les counts (missions_this_month, dossiers_total, lifetime_revenue_cents) sont
 * agrégés côté route handler — pas de vue matérialisée V1.
 */

import type { KovasTier } from '@/lib/stripe-config'

// ============================================
// Filtres + tri liste utilisateurs
// ============================================

export type UsersPlanFilter = 'all' | 'decouverte' | 'standard' | 'volume' | 'founder' | 'cabinet'
export type UsersStatusFilter =
  | 'all'
  | 'active'
  | 'trialing'
  | 'cancelled'
  | 'past_due'
  | 'suspended'

export type UsersSort =
  | 'created_at_desc'
  | 'created_at_asc'
  | 'missions_desc'
  | 'mrr_desc'
  | 'last_activity_desc'

export const DEFAULT_USERS_LIMIT = 50
export const MAX_USERS_LIMIT = 200

export interface UsersListQuery {
  q: string
  plan: UsersPlanFilter
  status: UsersStatusFilter
  sort: UsersSort
  page: number
  limit: number
}

// ============================================
// Item ligne (liste)
// ============================================

export interface UserListItem {
  user_id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  last_active_at: string | null
  // Org primaire (default_org_id, fallback première membership)
  organization_id: string | null
  organization_name: string | null
  // Plan tier
  plan: string // 'decouverte' | 'standard' | 'volume' | 'founder' | 'cabinet'
  plan_status: string // 'active' | 'trialing' | 'past_due' | 'cancelled'
  suspended: boolean
  // Métriques (agrégées)
  missions_this_month: number
  lifetime_revenue_cents: number
}

export interface UsersListResponse {
  users: UserListItem[]
  total: number
  page: number
  limit: number
}

// ============================================
// Fiche détaillée
// ============================================

export interface UserDetailMetrics {
  lifetime_revenue_cents: number
  missions_this_month: number
  dossiers_total: number
  photos_total: number
  ai_cost_this_month_eur: number
  nps_score: number | null // null V1 (pas encore collecté)
}

export interface UserActivityEvent {
  id: string
  kind: 'dossier_created' | 'mission_created' | 'mission_completed' | 'admin_action' | 'audit'
  title: string
  subtitle: string | null
  occurred_at: string
}

export interface UserDossierSummary {
  id: string
  reference: string
  status: string
  property_address: string | null
  created_at: string
}

export interface AdminNoteItem {
  id: string
  note: string
  created_by_email: string | null
  created_at: string
}

export interface UserDetail {
  user_id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  locale: string
  timezone: string
  created_at: string
  last_active_at: string | null

  organization: {
    id: string
    name: string
    siret: string | null
    city: string | null
    plan: string
    plan_status: string
    suspended_at: string | null
    suspension_reason: string | null
    ai_cap_daily_cents: number | null
    ai_cap_monthly_cents: number | null
    trial_ends_at: string | null
    current_period_end: string | null
  } | null

  subscription: {
    tier: string | null
    status: string
    missions_included: number | null
    overage_price_cents: number | null
    monthly_cap_eur: number | null
    current_period_start: string | null
    current_period_end: string | null
    cancel_at_period_end: boolean
  } | null

  metrics: UserDetailMetrics
  activity: UserActivityEvent[]
  dossiers: UserDossierSummary[]
  notes: AdminNoteItem[]
}

// ============================================
// Helpers UI (label + variants Badge)
// ============================================

export interface PlanBadgeMeta {
  label: string
  variant:
    | 'default'
    | 'outline'
    | 'muted'
    | 'blue'
    | 'green'
    | 'red'
    | 'orange'
    | 'yellow'
    | 'amber'
}

export function planBadge(plan: string): PlanBadgeMeta {
  switch (plan) {
    case 'decouverte':
      return { label: 'Découverte', variant: 'outline' }
    case 'standard':
      return { label: 'Standard', variant: 'default' }
    case 'volume':
      return { label: 'Volume', variant: 'blue' }
    case 'founder':
      return { label: 'Founder', variant: 'amber' }
    case 'cabinet':
      return { label: 'Cabinet', variant: 'green' }
    default:
      return { label: plan, variant: 'muted' }
  }
}

export interface StatusBadgeMeta {
  label: string
  variant:
    | 'default'
    | 'outline'
    | 'muted'
    | 'blue'
    | 'green'
    | 'red'
    | 'orange'
    | 'yellow'
    | 'amber'
}

export function statusBadge(status: string, suspended: boolean): StatusBadgeMeta {
  if (suspended) return { label: 'Suspendu', variant: 'red' }
  switch (status) {
    case 'active':
      return { label: 'Actif', variant: 'green' }
    case 'trialing':
      return { label: 'Essai', variant: 'blue' }
    case 'past_due':
      return { label: 'Impayé', variant: 'orange' }
    case 'cancelled':
    case 'canceled':
      return { label: 'Résilié', variant: 'muted' }
    case 'unpaid':
      return { label: 'Non payé', variant: 'red' }
    default:
      return { label: status, variant: 'muted' }
  }
}

// ============================================
// Estimation MRR (centimes) à partir du plan
// ============================================

export function planMonthlyCents(plan: string, tiers: KovasTier[]): number {
  // Mapping rapide tier-id Supabase → cents.
  // Note : `subscriptions.tier` peut contenir 'discovery' (anglais Stripe) ou
  // 'decouverte' (français legacy organizations.plan). On lookup les deux.
  const lookup: Record<string, KovasTier['id']> = {
    decouverte: 'discovery',
    discovery: 'discovery',
    standard: 'standard',
    volume: 'volume',
    founder: 'standard', // founder = Standard à 49€ — on map sur standard
    cabinet: 'volume', // approximation V1 (cabinet ≈ volume)
  }
  const mappedId = lookup[plan]
  if (!mappedId) return 0
  const tier = tiers.find((t) => t.id === mappedId)
  return tier ? tier.priceMonthlyCents : 0
}
