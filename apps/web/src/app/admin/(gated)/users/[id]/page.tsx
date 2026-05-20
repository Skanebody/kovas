/**
 * /admin/users/[id] — Fiche détaillée utilisateur.
 *
 * Server component : charge profile + memberships + organizations + subscriptions,
 * agrège les métriques (revenue lifetime, missions ce mois, dossiers, photos,
 * coût IA), activité récente, derniers dossiers et notes admin.
 *
 * Le panneau d'actions destructives (UserActionsPanel) est un client component
 * isolé. Il appelle les routes /api/admin/users/[id]/<action>.
 */

import { UserActionsPanel } from '@/components/admin/users/UserActionsPanel'
import { UserActivity } from '@/components/admin/users/UserActivity'
import { UserDetailHeader } from '@/components/admin/users/UserDetailHeader'
import { UserDossiersList } from '@/components/admin/users/UserDossiersList'
import { UserFinancialHistory } from '@/components/admin/users/UserFinancialHistory'
import { UserMetrics } from '@/components/admin/users/UserMetrics'
import { UserNotesPanel } from '@/components/admin/users/UserNotesPanel'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import type {
  AdminNoteItem,
  UserActivityEvent,
  UserDetail,
  UserDetailMetrics,
  UserDossierSummary,
} from '@/lib/admin/users-types'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Fiche utilisateur',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// Types Supabase locaux
// ============================================

interface ProfileRow {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  locale: string
  timezone: string
  default_org_id: string | null
  last_active_at: string | null
  created_at: string
}

interface MembershipRow {
  organization_id: string
  status: string
}

interface OrgRow {
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
}

interface SubRow {
  organization_id: string
  tier: string | null
  status: string
  missions_included: number | null
  overage_price_cents: number | null
  monthly_cap_eur: number | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
}

interface DossierRow {
  id: string
  reference: string
  status: string
  created_at: string
  property_id: string | null
}

interface PropertyRow {
  id: string
  address: string | null
}

interface MissionRow {
  id: string
  status: string
  created_at: string
  completed_at: string | null
  type: string
  organization_id: string
  dossier_id: string | null
}

interface AiUsageRow {
  cost_eur: number | string | null
}

interface NoteRow {
  id: string
  note: string
  created_by: string
  created_at: string
}

interface NoteAuthorProfile {
  id: string
  email: string
}

interface AuditLogRow {
  id: string
  action_type: string
  target_label: string | null
  created_at: string
}

function startOfThisMonthIso(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

async function fetchUserDetail(userId: string): Promise<UserDetail | null> {
  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, avatar_url, phone, locale, timezone, default_org_id, last_active_at, created_at',
    )
    .eq('id', userId)
    .maybeSingle<ProfileRow>()

  if (!profile) return null

  const { data: memberships } = await supabase
    .from('memberships')
    .select('organization_id, status')
    .eq('user_id', userId)
  const mems = (memberships ?? []) as MembershipRow[]
  const primaryOrgId =
    profile.default_org_id ?? mems.find((m) => m.status === 'active')?.organization_id ?? null

  let org: OrgRow | null = null
  let sub: SubRow | null = null
  if (primaryOrgId) {
    const { data: orgData } = await supabase
      .from('organizations')
      .select(
        'id, name, siret, city, plan, plan_status, suspended_at, suspension_reason, ai_cap_daily_cents, ai_cap_monthly_cents, trial_ends_at, current_period_end',
      )
      .eq('id', primaryOrgId)
      .maybeSingle<OrgRow>()
    org = orgData ?? null

    const { data: subData } = await supabase
      .from('subscriptions')
      .select(
        'organization_id, tier, status, missions_included, overage_price_cents, monthly_cap_eur, current_period_start, current_period_end, cancel_at_period_end',
      )
      .eq('organization_id', primaryOrgId)
      .maybeSingle<SubRow>()
    sub = subData ?? null
  }

  const monthIso = startOfThisMonthIso()
  const orgFilterId = primaryOrgId ?? '00000000-0000-0000-0000-000000000000'

  const [
    dossiersRes,
    missionsThisMonthRes,
    photosCountRes,
    aiCostRes,
    invoicesRes,
    dossiersTotalRes,
  ] = await Promise.all([
    supabase
      .from('dossiers')
      .select('id, reference, status, created_at, property_id')
      .eq('organization_id', orgFilterId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('missions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgFilterId)
      .gte('created_at', monthIso)
      .is('deleted_at', null),

    supabase
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgFilterId),

    supabase
      .from('ai_usage')
      .select('cost_eur')
      .eq('organization_id', orgFilterId)
      .gte('created_at', monthIso),

    supabase
      .from('invoices')
      .select('amount_ttc')
      .eq('organization_id', orgFilterId)
      .eq('status', 'paid'),

    supabase
      .from('dossiers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgFilterId)
      .is('deleted_at', null),
  ])

  const recentDossiers = (dossiersRes.data ?? []) as DossierRow[]
  const propertyIds = recentDossiers
    .map((d) => d.property_id)
    .filter((p): p is string => p !== null)

  let propertyByIdMap = new Map<string, string | null>()
  if (propertyIds.length > 0) {
    const { data: properties } = await supabase
      .from('properties')
      .select('id, address')
      .in('id', propertyIds)
    const props = (properties ?? []) as PropertyRow[]
    propertyByIdMap = new Map(props.map((p) => [p.id, p.address]))
  }

  const dossiers: UserDossierSummary[] = recentDossiers.map((d) => ({
    id: d.id,
    reference: d.reference,
    status: d.status,
    property_address: d.property_id ? (propertyByIdMap.get(d.property_id) ?? null) : null,
    created_at: d.created_at,
  }))

  const aiRows = (aiCostRes.data ?? []) as AiUsageRow[]
  const aiCostEur = aiRows.reduce((acc, r) => acc + Number.parseFloat(String(r.cost_eur ?? '0')), 0)
  const invoiceRows = (invoicesRes.data ?? []) as unknown as { amount_ttc: number | null }[]
  const lifetimeRevenueCents = invoiceRows.reduce(
    (acc, r) => acc + Math.round((r.amount_ttc ?? 0) * 100),
    0,
  )

  const metrics: UserDetailMetrics = {
    lifetime_revenue_cents: lifetimeRevenueCents,
    missions_this_month: missionsThisMonthRes.count ?? 0,
    dossiers_total: dossiersTotalRes.count ?? 0,
    photos_total: photosCountRes.count ?? 0,
    ai_cost_this_month_eur: aiCostEur,
    nps_score: null,
  }

  // Activité récente : missions + dossiers + audit
  const [recentMissionsRes, recentDossiersActRes, auditEntriesRes] = await Promise.all([
    supabase
      .from('missions')
      .select('id, status, created_at, completed_at, type, organization_id, dossier_id')
      .eq('organization_id', orgFilterId)
      .order('created_at', { ascending: false })
      .limit(10) as unknown as Promise<{ data: MissionRow[] | null }>,
    supabase
      .from('dossiers')
      .select('id, reference, status, created_at, property_id')
      .eq('organization_id', orgFilterId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10),
    (
      supabase.from('admin_audit_log') as unknown as {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            eq: (
              col: string,
              val: string,
            ) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{ data: AuditLogRow[] | null }>
              }
            }
          }
        }
      }
    )
      .select('id, action_type, target_label, created_at')
      .eq('target_type', 'user')
      .eq('target_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const events: UserActivityEvent[] = []
  for (const m of (recentMissionsRes.data ?? []) as MissionRow[]) {
    if (m.completed_at) {
      events.push({
        id: `mission_done_${m.id}`,
        kind: 'mission_completed',
        title: `Mission ${m.type} terminée`,
        subtitle: m.dossier_id,
        occurred_at: m.completed_at,
      })
    } else {
      events.push({
        id: `mission_created_${m.id}`,
        kind: 'mission_created',
        title: `Mission ${m.type} créée`,
        subtitle: m.dossier_id,
        occurred_at: m.created_at,
      })
    }
  }
  for (const d of (recentDossiersActRes.data ?? []) as DossierRow[]) {
    events.push({
      id: `dossier_${d.id}`,
      kind: 'dossier_created',
      title: `Dossier ${d.reference}`,
      subtitle: `Statut ${d.status}`,
      occurred_at: d.created_at,
    })
  }
  for (const a of auditEntriesRes.data ?? []) {
    events.push({
      id: `audit_${a.id}`,
      kind: 'admin_action',
      title: `Admin · ${a.action_type}`,
      subtitle: a.target_label,
      occurred_at: a.created_at,
    })
  }
  events.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
  const topEvents = events.slice(0, 10)

  // Notes
  const { data: noteRows } = await (
    supabase.from('admin_notes') as unknown as {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (n: number) => Promise<{ data: NoteRow[] | null }>
          }
        }
      }
    }
  )
    .select('id, note, created_by, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  const notes = noteRows ?? []
  let notesEnriched: AdminNoteItem[] = []
  if (notes.length > 0) {
    const authorIds = Array.from(new Set(notes.map((n) => n.created_by)))
    const { data: authors } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', authorIds)
    const authorMap = new Map<string, string>()
    for (const a of (authors ?? []) as NoteAuthorProfile[]) {
      authorMap.set(a.id, a.email)
    }
    notesEnriched = notes.map((n) => ({
      id: n.id,
      note: n.note,
      created_by_email: authorMap.get(n.created_by) ?? null,
      created_at: n.created_at,
    }))
  }

  const detail: UserDetail = {
    user_id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
    phone: profile.phone,
    locale: profile.locale,
    timezone: profile.timezone,
    created_at: profile.created_at,
    last_active_at: profile.last_active_at,
    organization: org
      ? {
          id: org.id,
          name: org.name,
          siret: org.siret,
          city: org.city,
          plan: org.plan,
          plan_status: org.plan_status,
          suspended_at: org.suspended_at,
          suspension_reason: org.suspension_reason,
          ai_cap_daily_cents: org.ai_cap_daily_cents,
          ai_cap_monthly_cents: org.ai_cap_monthly_cents,
          trial_ends_at: org.trial_ends_at,
          current_period_end: org.current_period_end,
        }
      : null,
    subscription: sub
      ? {
          tier: sub.tier,
          status: sub.status,
          missions_included: sub.missions_included,
          overage_price_cents: sub.overage_price_cents,
          monthly_cap_eur: sub.monthly_cap_eur,
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
          cancel_at_period_end: sub.cancel_at_period_end,
        }
      : null,
    metrics,
    activity: topEvents,
    dossiers,
    notes: notesEnriched,
  }

  return detail
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { id } = await params
  const user = await fetchUserDetail(id)
  if (!user) {
    notFound()
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Breadcrumb retour */}
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-mute hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Retour à la liste
      </Link>

      {/* Header + Actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div className="flex-1 min-w-0">
          <UserDetailHeader user={user} />
        </div>
        <div className="lg:sticky lg:top-20 shrink-0">
          <UserActionsPanel user={user} />
        </div>
      </div>

      {/* Metrics grid */}
      <UserMetrics metrics={user.metrics} />

      {/* Activity + Financial */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <UserActivity events={user.activity} />
        <UserFinancialHistory user={user} />
      </section>

      {/* Dossiers + Notes */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <UserDossiersList dossiers={user.dossiers} />
        <UserNotesPanel userId={user.user_id} notes={user.notes} />
      </section>
    </div>
  )
}
