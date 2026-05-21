/**
 * /api/prescribers/[id] — détail d'un prescripteur (relation + contact joint).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import type {
  PrescriberContact,
  PrescriberRelationshipRow,
  PrescriberRowWithContact,
} from '@/lib/prescribers/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

interface PrescribersTable {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      eq: (
        col: string,
        val: string,
      ) => {
        single: () => Promise<{
          data: PrescriberRelationshipRow | null
          error: { message: string } | null
        }>
      }
    }
  }
}
interface ContactsTable {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      single: () => Promise<{ data: PrescriberContact | null; error: { message: string } | null }>
    }
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ prescriber: PrescriberRowWithContact } | { error: string }>> {
  const { supabase, orgId } = await getCurrentUser()
  const { id } = await params

  const { data: row, error } = await prescribersTable(supabase)
    .select(
      'id, organization_id, contact_id, user_id, tier, revenue_12m_eur, missions_12m_count, acceptance_rate, avg_basket_eur, last_mission_at, last_contact_at, silent_since_days, notes, next_action_at, next_action_type, created_at, updated_at',
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (error || !row) {
    return NextResponse.json(
      { error: error?.message ?? 'Prescripteur introuvable' },
      { status: 404 },
    )
  }

  const contactRes = await contactsTable(supabase)
    .select('id, display_name, kind, email, phone, company_name')
    .eq('id', row.contact_id)
    .single()

  return NextResponse.json({
    prescriber: { ...row, contact: contactRes.data ?? null },
  })
}
