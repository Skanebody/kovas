/**
 * GET /api/admin/users
 *
 * Liste paginée des utilisateurs avec filtres + tri + agrégats (missions ce mois,
 * lifetime revenue). Gate verifyAdminAccess() puis service_role pour bypass RLS.
 *
 * Query params :
 *   - q       : recherche email / full_name / org name (ilike trigram)
 *   - plan    : 'all' | 'decouverte' | 'standard' | 'volume' | 'founder' | 'cabinet'
 *   - status  : 'all' | 'active' | 'trialing' | 'cancelled' | 'past_due' | 'suspended'
 *   - sort    : 'created_at_desc' | 'created_at_asc' | 'missions_desc' | 'mrr_desc' | 'last_activity_desc'
 *   - page    : 1-indexed
 *   - limit   : default 50, max 200
 *
 * Stratégie V1 (volumes attendus < 500 users à M12) :
 *   - 1 query profiles + nested memberships(organizations(subscriptions))
 *   - 1 query missions count par org_id (ce mois)
 *   - 1 query lifetime revenue (somme cents par org_id, depuis invoices ou stub V1)
 *   - Tri + filtres en mémoire JS (déjà OK < 1000 rows)
 *
 * V2 si > 1000 users : vue matérialisée admin_users_summary + RPC dédié.
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import {
  DEFAULT_USERS_LIMIT,
  MAX_USERS_LIMIT,
  type UserListItem,
  type UsersListQuery,
  type UsersListResponse,
  type UsersPlanFilter,
  type UsersSort,
  type UsersStatusFilter,
  planMonthlyCents,
} from '@/lib/admin/users-types'
import { KOVAS_TIERS } from '@/lib/stripe-config'
import { NextResponse } from 'next/server'

interface MembershipNested {
  organization_id: string
  role: string
  status: string
  organizations: {
    id: string
    name: string
    plan: string
    plan_status: string
    suspended_at: string | null
  } | null
}

interface ProfileWithMemberships {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  last_active_at: string | null
  default_org_id: string | null
  memberships: MembershipNested[]
}

interface SubscriptionLite {
  organization_id: string
  status: string
  tier: string | null
}

interface MissionCountRow {
  organization_id: string
}

interface InvoiceLite {
  organization_id: string
  amount_ttc: number | null
  status: string | null
}

function startOfThisMonthIso(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

function parseQuery(url: URL): UsersListQuery {
  const q = url.searchParams.get('q')?.trim() ?? ''
  const planParam = (url.searchParams.get('plan') ?? 'all') as UsersPlanFilter
  const statusParam = (url.searchParams.get('status') ?? 'all') as UsersStatusFilter
  const sortParam = (url.searchParams.get('sort') ?? 'created_at_desc') as UsersSort

  const allowedPlans: UsersPlanFilter[] = [
    'all',
    'decouverte',
    'standard',
    'volume',
    'founder',
    'cabinet',
  ]
  const allowedStatuses: UsersStatusFilter[] = [
    'all',
    'active',
    'trialing',
    'cancelled',
    'past_due',
    'suspended',
  ]
  const allowedSorts: UsersSort[] = [
    'created_at_desc',
    'created_at_asc',
    'missions_desc',
    'mrr_desc',
    'last_activity_desc',
  ]

  const plan = allowedPlans.includes(planParam) ? planParam : 'all'
  const status = allowedStatuses.includes(statusParam) ? statusParam : 'all'
  const sort = allowedSorts.includes(sortParam) ? sortParam : 'created_at_desc'

  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? `${DEFAULT_USERS_LIMIT}`, 10)
  const limit = Math.min(
    MAX_USERS_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) ? rawLimit : DEFAULT_USERS_LIMIT),
  )

  return { q, plan, status, sort, page, limit }
}

export async function GET(request: Request) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const url = new URL(request.url)
  const query = parseQuery(url)

  const supabase = createAdminClient()
  const monthIso = startOfThisMonthIso()

  // 1. Tous les profiles + nested memberships + organizations
  //    Note : on charge tout puis on agrège en mémoire (V1 — petits volumes).
  const profilesQuery = supabase
    .from('profiles')
    .select(
      `id, email, full_name, avatar_url, created_at, last_active_at, default_org_id,
       memberships:memberships!user_id (
         organization_id, role, status,
         organizations:organizations (
           id, name, plan, plan_status, suspended_at
         )
       )`,
    )
    .order('created_at', { ascending: false })

  // 2. Subscriptions actives (par org_id)
  const subsQuery = supabase.from('subscriptions').select('organization_id, status, tier')

  // 3. Missions ce mois (par org_id) — on récupère juste org_id pour count en mémoire
  const missionsQuery = supabase
    .from('missions')
    .select('organization_id')
    .gte('created_at', monthIso)
    .is('deleted_at', null)

  // 4. Invoices payées (lifetime revenue) — graceful si table vide
  // Note : invoices.amount_ttc est un float en EUR (pas cents). On le convertit
  // en cents pour homogénéité avec l'UI (formatEur(cents / 100)).
  const invoicesQuery = supabase
    .from('invoices')
    .select('organization_id, amount_ttc, status')
    .eq('status', 'paid')

  const [profilesRes, subsRes, missionsRes, invoicesRes] = await Promise.all([
    profilesQuery,
    subsQuery,
    missionsQuery,
    invoicesQuery,
  ])

  if (profilesRes.error) {
    console.error('[api/admin/users] profiles query failed', profilesRes.error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const profiles = (profilesRes.data ?? []) as unknown as ProfileWithMemberships[]
  const subs = (subsRes.data ?? []) as SubscriptionLite[]
  const missions = (missionsRes.data ?? []) as MissionCountRow[]
  const invoices = (invoicesRes.data ?? []) as unknown as InvoiceLite[]

  // Indexes par org_id
  const subByOrg = new Map<string, SubscriptionLite>()
  for (const s of subs) subByOrg.set(s.organization_id, s)

  const missionCountByOrg = new Map<string, number>()
  for (const m of missions) {
    missionCountByOrg.set(m.organization_id, (missionCountByOrg.get(m.organization_id) ?? 0) + 1)
  }

  const revenueByOrg = new Map<string, number>()
  for (const inv of invoices) {
    // amount_ttc en EUR → cents
    const cents = Math.round((inv.amount_ttc ?? 0) * 100)
    revenueByOrg.set(inv.organization_id, (revenueByOrg.get(inv.organization_id) ?? 0) + cents)
  }

  // Build items
  const items: UserListItem[] = profiles.map((p) => {
    // Org primaire : default_org_id, sinon première membership active
    const primaryMembership =
      p.memberships.find((m) => m.organization_id === p.default_org_id) ??
      p.memberships.find((m) => m.status === 'active') ??
      p.memberships[0] ??
      null

    const org = primaryMembership?.organizations ?? null
    const orgId = org?.id ?? null
    const orgName = org?.name ?? null
    const orgPlan = org?.plan ?? 'decouverte'
    const orgPlanStatus = org?.plan_status ?? 'trialing'
    const suspended = Boolean(org?.suspended_at)

    const sub = orgId ? subByOrg.get(orgId) : undefined
    const finalStatus = sub?.status ?? orgPlanStatus

    return {
      user_id: p.id,
      email: p.email,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      created_at: p.created_at,
      last_active_at: p.last_active_at,
      organization_id: orgId,
      organization_name: orgName,
      plan: orgPlan,
      plan_status: finalStatus,
      suspended,
      missions_this_month: orgId ? (missionCountByOrg.get(orgId) ?? 0) : 0,
      lifetime_revenue_cents: orgId ? (revenueByOrg.get(orgId) ?? 0) : 0,
    }
  })

  // Filtres
  const qLower = query.q.toLowerCase()
  let filtered = items
  if (qLower) {
    filtered = filtered.filter(
      (i) =>
        i.email.toLowerCase().includes(qLower) ||
        (i.full_name?.toLowerCase().includes(qLower) ?? false) ||
        (i.organization_name?.toLowerCase().includes(qLower) ?? false),
    )
  }
  if (query.plan !== 'all') {
    filtered = filtered.filter((i) => i.plan === query.plan)
  }
  if (query.status !== 'all') {
    if (query.status === 'suspended') {
      filtered = filtered.filter((i) => i.suspended)
    } else {
      filtered = filtered.filter((i) => !i.suspended && i.plan_status === query.status)
    }
  }

  // Tri
  filtered.sort((a, b) => {
    switch (query.sort) {
      case 'created_at_asc':
        return a.created_at.localeCompare(b.created_at)
      case 'missions_desc':
        return b.missions_this_month - a.missions_this_month
      case 'mrr_desc':
        return planMonthlyCents(b.plan, KOVAS_TIERS) - planMonthlyCents(a.plan, KOVAS_TIERS)
      case 'last_activity_desc': {
        const aTs = a.last_active_at ?? a.created_at
        const bTs = b.last_active_at ?? b.created_at
        return bTs.localeCompare(aTs)
      }
      default:
        return b.created_at.localeCompare(a.created_at)
    }
  })

  const total = filtered.length
  const start = (query.page - 1) * query.limit
  const paged = filtered.slice(start, start + query.limit)

  const response: UsersListResponse = {
    users: paged,
    total,
    page: query.page,
    limit: query.limit,
  }

  return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } })
}
