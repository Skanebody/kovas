/**
 * GET  /api/admin/users/[id]     → fiche complète
 * PATCH /api/admin/users/[id]    → update metadata profile (full_name, phone, locale)
 *
 * Gate verifyAdminAccess() + service_role.
 *
 * Le PATCH ne touche QUE des champs profile non sensibles (full_name, phone).
 * Toute action destructive (suspend, cap, plan, credit, note, email) a sa
 * propre route sous /api/admin/users/[id]/<action> avec audit wrapper.
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import type {
  AdminNoteItem,
  UserActivityEvent,
  UserDetail,
  UserDetailMetrics,
  UserDossierSummary,
} from '@/lib/admin/users-types'
import { NextResponse } from 'next/server'

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
  role: string
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

function startOfThisMonthIso(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const { id: userId } = await params
  const supabase = createAdminClient()

  // 1. Profile
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, avatar_url, phone, locale, timezone, default_org_id, last_active_at, created_at',
    )
    .eq('id', userId)
    .maybeSingle<ProfileRow>()

  if (profileErr) {
    console.error('[api/admin/users/:id] profile fetch failed', profileErr)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
  if (!profile) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 2. Memberships pour trouver org primaire
  const { data: memberships } = await supabase
    .from('memberships')
    .select('organization_id, role, status')
    .eq('user_id', userId)

  const mems = (memberships ?? []) as MembershipRow[]
  const primaryOrgId =
    profile.default_org_id ?? mems.find((m) => m.status === 'active')?.organization_id ?? null

  // 3. Org + subscription
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

  // 4. Métriques agrégées (en parallèle)
  const orgFilterId = primaryOrgId ?? '00000000-0000-0000-0000-000000000000'

  const [dossiersRes, missionsThisMonthRes, photosCountRes, aiCostRes, lifetimeRevenueRes] =
    await Promise.all([
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
    ])

  const recentDossiers = (dossiersRes.data ?? []) as DossierRow[]
  const propertyIds = recentDossiers
    .map((d) => d.property_id)
    .filter((p): p is string => p !== null)

  let propertyById = new Map<string, string | null>()
  if (propertyIds.length > 0) {
    const { data: properties } = await supabase
      .from('properties')
      .select('id, address')
      .in('id', propertyIds)
    const props = (properties ?? []) as PropertyRow[]
    propertyById = new Map(props.map((p) => [p.id, p.address]))
  }

  const dossiers: UserDossierSummary[] = recentDossiers.map((d) => ({
    id: d.id,
    reference: d.reference,
    status: d.status,
    property_address: d.property_id ? (propertyById.get(d.property_id) ?? null) : null,
    created_at: d.created_at,
  }))

  // Compte total dossiers
  const { count: dossiersTotal } = await supabase
    .from('dossiers')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgFilterId)
    .is('deleted_at', null)

  const aiRows = (aiCostRes.data ?? []) as AiUsageRow[]
  const aiCostEur = aiRows.reduce((acc, r) => acc + Number.parseFloat(String(r.cost_eur ?? '0')), 0)

  const invoiceRows = (lifetimeRevenueRes.data ?? []) as unknown as { amount_ttc: number | null }[]
  const lifetimeRevenueCents = invoiceRows.reduce(
    (acc, r) => acc + Math.round((r.amount_ttc ?? 0) * 100),
    0,
  )

  const metrics: UserDetailMetrics = {
    lifetime_revenue_cents: lifetimeRevenueCents,
    missions_this_month: missionsThisMonthRes.count ?? 0,
    dossiers_total: dossiersTotal ?? 0,
    photos_total: photosCountRes.count ?? 0,
    ai_cost_this_month_eur: aiCostEur,
    nps_score: null,
  }

  // 5. Activité récente : 10 derniers événements (missions/dossiers/audit)
  const [recentMissions, recentDossiersForActivity, auditEntries] = await Promise.all([
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
    // audit_log entries où target = ce user
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
                limit: (n: number) => Promise<{
                  data:
                    | {
                        id: string
                        action_type: string
                        target_label: string | null
                        created_at: string
                      }[]
                    | null
                  error: { message: string } | null
                }>
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

  for (const m of (recentMissions.data ?? []) as MissionRow[]) {
    if (m.completed_at) {
      events.push({
        id: `mission_done_${m.id}`,
        kind: 'mission_completed',
        title: `Mission ${m.type} terminée`,
        subtitle: m.dossier_id ?? null,
        occurred_at: m.completed_at,
      })
    } else {
      events.push({
        id: `mission_created_${m.id}`,
        kind: 'mission_created',
        title: `Mission ${m.type} créée`,
        subtitle: m.dossier_id ?? null,
        occurred_at: m.created_at,
      })
    }
  }
  for (const d of (recentDossiersForActivity.data ?? []) as DossierRow[]) {
    events.push({
      id: `dossier_${d.id}`,
      kind: 'dossier_created',
      title: `Dossier ${d.reference}`,
      subtitle: `Statut ${d.status}`,
      occurred_at: d.created_at,
    })
  }
  for (const a of auditEntries.data ?? []) {
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

  // 6. Admin notes du user
  const { data: noteRows } = (await supabase
    .from('admin_notes')
    .select('id, note, created_by, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)) as unknown as { data: NoteRow[] | null }

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

  return NextResponse.json(detail, { headers: { 'Cache-Control': 'no-store' } })
}

// ============================================
// PATCH — update profile metadata (full_name, phone, locale, timezone)
// ============================================

interface PatchBody {
  full_name?: string | null
  phone?: string | null
  locale?: string
  timezone?: string
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const { id: userId } = await params
  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const update: PatchBody = {}
  if (typeof body.full_name === 'string' || body.full_name === null)
    update.full_name = body.full_name
  if (typeof body.phone === 'string' || body.phone === null) update.phone = body.phone
  if (typeof body.locale === 'string') update.locale = body.locale
  if (typeof body.timezone === 'string') update.timezone = body.timezone

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: 'user_profile_updated',
      targetType: 'user',
      targetId: userId,
      payload: update as Record<string, unknown>,
    },
    async () => {
      const { error } = await supabase.from('profiles').update(update).eq('id', userId)
      if (error) throw new Error(error.message)
    },
  )

  return NextResponse.json({ ok: true })
}
