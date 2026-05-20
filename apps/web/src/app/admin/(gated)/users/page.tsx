/**
 * /admin/users — Liste paginée des utilisateurs admin.
 *
 * Server component : appelle directement createAdminClient() (déjà gated par
 * le layout (gated) qui exige isAdmin + 2FA OK). Pas de fetch HTTP interne pour
 * éviter les overheads + cookies forwarding.
 *
 * Filtres URL : ?q, ?plan, ?status, ?sort, ?page, ?limit
 * Cf. lib/admin/users-types.ts pour les types.
 */

import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { UsersFilters } from '@/components/admin/users/UsersFilters'
import { UsersListTable } from '@/components/admin/users/UsersListTable'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import {
  DEFAULT_USERS_LIMIT,
  MAX_USERS_LIMIT,
  type UserListItem,
  type UsersPlanFilter,
  type UsersSort,
  type UsersStatusFilter,
  planMonthlyCents,
} from '@/lib/admin/users-types'
import { KOVAS_TIERS } from '@/lib/stripe-config'
import { CheckCircle2, Clock, Users as UsersIcon, XCircle } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Utilisateurs',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// Types fetchers locaux (mirror de /api/admin/users)
// ============================================
interface MembershipNested {
  organization_id: string
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
}

// ============================================
// Helpers
// ============================================

function startOfThisMonthIso(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

interface PageProps {
  searchParams: Promise<{
    q?: string
    plan?: string
    status?: string
    sort?: string
    page?: string
    limit?: string
  }>
}

interface UsersStats {
  total: number
  activeThisMonth: number
  trialing: number
  suspended: number
}

interface UsersListResult {
  paged: UserListItem[]
  total: number
  page: number
  limit: number
  stats: UsersStats
  filters: {
    q: string
    plan: UsersPlanFilter
    status: UsersStatusFilter
    sort: UsersSort
  }
}

async function fetchUsersList(
  searchParams: Awaited<PageProps['searchParams']>,
): Promise<UsersListResult> {
  const supabase = createAdminClient()
  const monthIso = startOfThisMonthIso()

  const q = (searchParams.q ?? '').trim()
  const planParam = (searchParams.plan ?? 'all') as UsersPlanFilter
  const statusParam = (searchParams.status ?? 'all') as UsersStatusFilter
  const sortParam = (searchParams.sort ?? 'created_at_desc') as UsersSort

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

  const page = Math.max(1, Number.parseInt(searchParams.page ?? '1', 10) || 1)
  const rawLimit = Number.parseInt(searchParams.limit ?? `${DEFAULT_USERS_LIMIT}`, 10)
  const limit = Math.min(
    MAX_USERS_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) ? rawLimit : DEFAULT_USERS_LIMIT),
  )

  const [profilesRes, subsRes, missionsRes, invoicesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        `id, email, full_name, avatar_url, created_at, last_active_at, default_org_id,
         memberships:memberships!user_id (
           organization_id, status,
           organizations:organizations (
             id, name, plan, plan_status, suspended_at
           )
         )`,
      )
      .order('created_at', { ascending: false }),
    supabase.from('subscriptions').select('organization_id, status, tier'),
    supabase
      .from('missions')
      .select('organization_id')
      .gte('created_at', monthIso)
      .is('deleted_at', null),
    supabase.from('invoices').select('organization_id, amount_ttc').eq('status', 'paid'),
  ])

  const profiles = (profilesRes.data ?? []) as unknown as ProfileWithMemberships[]
  const subs = (subsRes.data ?? []) as SubscriptionLite[]
  const missions = (missionsRes.data ?? []) as MissionCountRow[]
  const invoices = (invoicesRes.data ?? []) as unknown as InvoiceLite[]

  const subByOrg = new Map<string, SubscriptionLite>()
  for (const s of subs) subByOrg.set(s.organization_id, s)

  const missionCountByOrg = new Map<string, number>()
  for (const m of missions) {
    missionCountByOrg.set(m.organization_id, (missionCountByOrg.get(m.organization_id) ?? 0) + 1)
  }

  const revenueByOrg = new Map<string, number>()
  for (const inv of invoices) {
    revenueByOrg.set(
      inv.organization_id,
      (revenueByOrg.get(inv.organization_id) ?? 0) + Math.round((inv.amount_ttc ?? 0) * 100),
    )
  }

  const items: UserListItem[] = profiles.map((p) => {
    const primaryMembership =
      p.memberships.find((m) => m.organization_id === p.default_org_id) ??
      p.memberships.find((m) => m.status === 'active') ??
      p.memberships[0] ??
      null

    const org = primaryMembership?.organizations ?? null
    const orgId = org?.id ?? null
    const sub = orgId ? subByOrg.get(orgId) : undefined
    const finalStatus = sub?.status ?? org?.plan_status ?? 'trialing'

    return {
      user_id: p.id,
      email: p.email,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      created_at: p.created_at,
      last_active_at: p.last_active_at,
      organization_id: orgId,
      organization_name: org?.name ?? null,
      plan: org?.plan ?? 'decouverte',
      plan_status: finalStatus,
      suspended: Boolean(org?.suspended_at),
      missions_this_month: orgId ? (missionCountByOrg.get(orgId) ?? 0) : 0,
      lifetime_revenue_cents: orgId ? (revenueByOrg.get(orgId) ?? 0) : 0,
    }
  })

  // Stats globales (avant filtrage q/plan/status, sur l'univers complet)
  const stats: UsersStats = {
    total: items.length,
    activeThisMonth: items.filter((i) => i.missions_this_month > 0).length,
    trialing: items.filter((i) => !i.suspended && i.plan_status === 'trialing').length,
    suspended: items.filter((i) => i.suspended).length,
  }

  // Filtres
  const qLower = q.toLowerCase()
  let filtered = items
  if (qLower) {
    filtered = filtered.filter(
      (i) =>
        i.email.toLowerCase().includes(qLower) ||
        (i.full_name?.toLowerCase().includes(qLower) ?? false) ||
        (i.organization_name?.toLowerCase().includes(qLower) ?? false),
    )
  }
  if (plan !== 'all') filtered = filtered.filter((i) => i.plan === plan)
  if (status !== 'all') {
    if (status === 'suspended') filtered = filtered.filter((i) => i.suspended)
    else filtered = filtered.filter((i) => !i.suspended && i.plan_status === status)
  }

  // Tri
  filtered.sort((a, b) => {
    switch (sort) {
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
  const start = (page - 1) * limit
  const paged = filtered.slice(start, start + limit)

  return { paged, total, page, limit, stats, filters: { q, plan, status, sort } }
}

// ============================================
// Page
// ============================================

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const data = await fetchUsersList(sp)

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          👥 Utilisateurs · {data.stats.total} total
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Utilisateurs.
        </h1>
        <p className="text-sm text-ink-mute max-w-xl">
          Recherche, filtres, tri · cliquez une ligne pour ouvrir la fiche détaillée.
        </p>
      </div>

      {/* Stats */}
      <section
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Statistiques utilisateurs"
      >
        <AdminMetricCard
          eyebrow="Total"
          value={String(data.stats.total)}
          hint="Tous comptes confondus"
          icon={UsersIcon}
        />
        <AdminMetricCard
          eyebrow="Actifs ce mois"
          value={String(data.stats.activeThisMonth)}
          hint="≥ 1 mission ce mois"
          icon={CheckCircle2}
        />
        <AdminMetricCard
          eyebrow="En essai"
          value={String(data.stats.trialing)}
          hint="Trialing en cours"
          icon={Clock}
        />
        <AdminMetricCard
          eyebrow="Suspendus"
          value={String(data.stats.suspended)}
          hint="Organisations gelées"
          icon={XCircle}
        />
      </section>

      {/* Filtres */}
      <section aria-label="Filtres" className="rounded-xl border border-rule bg-paper p-4">
        <UsersFilters
          initialQ={data.filters.q}
          initialPlan={data.filters.plan}
          initialStatus={data.filters.status}
        />
      </section>

      {/* Tableau */}
      <UsersListTable
        users={data.paged}
        total={data.total}
        page={data.page}
        limit={data.limit}
        sort={data.filters.sort}
      />
    </div>
  )
}
