/**
 * /api/prescribers — liste des prescripteurs de l'organisation (CRM).
 *
 * GET ?tier=...&silentDays=...&sort=revenue|missions|silence
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import {
  PRESCRIBER_TIERS,
  type PrescriberContact,
  type PrescriberRelationshipRow,
  type PrescriberRowWithContact,
  type PrescriberTier,
} from '@/lib/prescribers/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

interface PrescribersTable {
  select: (cols: string) => {
    eq: (col: string, val: string) => PrescribersQueryChain
  }
}

type PrescribersQueryChain = {
  eq: (col: string, val: string) => PrescribersQueryChain
  in: (col: string, values: readonly string[]) => PrescribersQueryChain
  gte: (col: string, val: number) => PrescribersQueryChain
  order: (col: string, opts: { ascending: boolean; nullsFirst?: boolean }) => PrescribersQueryChain
  limit: (n: number) => Promise<{
    data: PrescriberRelationshipRow[] | null
    error: { message: string } | null
  }>
}

interface ContactsTable {
  select: (cols: string) => {
    in: (
      col: string,
      values: string[],
    ) => Promise<{
      data: PrescriberContact[] | null
      error: { message: string } | null
    }>
  }
}

function prescribersTable(supabase: SupabaseClient): PrescribersTable {
  return (supabase as unknown as { from(t: 'prescriber_relationships'): PrescribersTable }).from(
    'prescriber_relationships',
  )
}
function contactsTable(supabase: SupabaseClient): ContactsTable {
  return (supabase as unknown as { from(t: 'contacts'): ContactsTable }).from('contacts')
}

interface PrescribersResponse {
  prescribers: PrescriberRowWithContact[]
  total: number
}

const VALID_SORTS = ['revenue', 'missions', 'silence', 'tier'] as const
type SortKey = (typeof VALID_SORTS)[number]

export async function GET(
  request: Request,
): Promise<NextResponse<PrescribersResponse | { error: string }>> {
  const { supabase, orgId } = await getCurrentUser()
  const url = new URL(request.url)

  const tierFilter = url.searchParams.get('tier')
  const silentDaysParam = url.searchParams.get('silentDays')
  const sortParam = (url.searchParams.get('sort') ?? 'revenue') as SortKey
  const sort = VALID_SORTS.includes(sortParam) ? sortParam : 'revenue'

  let q = prescribersTable(supabase)
    .select(
      'id, organization_id, contact_id, user_id, tier, revenue_12m_eur, missions_12m_count, acceptance_rate, avg_basket_eur, last_mission_at, last_contact_at, silent_since_days, notes, next_action_at, next_action_type, created_at, updated_at',
    )
    .eq('organization_id', orgId)

  if (tierFilter && (PRESCRIBER_TIERS as readonly string[]).includes(tierFilter)) {
    q = q.eq('tier', tierFilter as PrescriberTier)
  }
  if (silentDaysParam) {
    const days = Number.parseInt(silentDaysParam, 10)
    if (Number.isFinite(days) && days > 0) {
      q = q.gte('silent_since_days', days)
    }
  }

  // Tri.
  switch (sort) {
    case 'missions':
      q = q.order('missions_12m_count', { ascending: false })
      break
    case 'silence':
      q = q.order('silent_since_days', { ascending: false, nullsFirst: false })
      break
    case 'tier':
      q = q.order('tier', { ascending: true }).order('revenue_12m_eur', { ascending: false })
      break
    default:
      q = q.order('revenue_12m_eur', { ascending: false })
  }

  const { data: rows, error } = await q.limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = rows ?? []
  const contactIds = list.map((r) => r.contact_id)
  let contacts: PrescriberContact[] = []
  if (contactIds.length > 0) {
    const res = await contactsTable(supabase)
      .select('id, display_name, kind, email, phone, company_name')
      .in('id', contactIds)
    if (res.error) {
      return NextResponse.json({ error: res.error.message }, { status: 500 })
    }
    contacts = res.data ?? []
  }
  const contactById = new Map(contacts.map((c) => [c.id, c]))

  const prescribers: PrescriberRowWithContact[] = list.map((row) => ({
    ...row,
    contact: contactById.get(row.contact_id) ?? null,
  }))

  return NextResponse.json(
    { prescribers, total: prescribers.length },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
