import { AppPageHeader } from '@/components/app-page-header'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { Metadata } from 'next'
import { LeadsFocalClient } from './leads-focal-client'
import type { LeadItem } from './leads-types'

export const metadata: Metadata = { title: 'Leads' }

/**
 * Page Leads — file d'attente focale 1 lead à la fois.
 *
 * AUDIT-B (2026-05-23) : refonte schéma. La table `lead_assignments` existe
 * en prod mais avec un schéma différent (lead_id, diagnostician_id, status,
 * notified_at, expires_at, ...). Le contenu lead est dans `quote_requests`
 * (table jointe). On joint user.id -> diagnosticians.claimed_by_user_id ->
 * diagnosticians.id -> lead_assignments.diagnostician_id (status='pending').
 */
async function fetchPendingLeads(userId: string): Promise<LeadItem[]> {
  const { supabase } = await getCurrentUser()

  try {
    // biome-ignore lint/suspicious/noExplicitAny: types DB en attente régénération
    const sb = supabase as any

    // 1. Diagnostician claimé par cet user (V1 : 1 user = 1 diag)
    const { data: diags } = await sb
      .from('diagnosticians')
      .select('id')
      .eq('claimed_by_user_id', userId)

    const diagRows = (diags ?? []) as Array<{ id: string }>
    if (diagRows.length === 0) return []
    const diagIds = diagRows.map((d) => d.id)

    // 2. Assignments en attente, joints aux quote_requests
    const { data, error } = await sb
      .from('lead_assignments')
      .select(
        'id, status, notified_at, expires_at, lead:quote_requests(requester_first_name, requester_last_name, requester_phone, property_address, property_city, property_postal_code, property_type, property_surface_m2, property_year_built, diagnostics_requested)',
      )
      .in('diagnostician_id', diagIds)
      .eq('status', 'pending')
      .order('notified_at', { ascending: true })
      .limit(50)

    if (error) {
      return []
    }

    const rows = (data ?? []) as unknown as RawLeadAssignmentRow[]
    return rows.map(normalizeLead)
  } catch {
    return []
  }
}

interface RawLeadAssignmentRow {
  id: string
  status: string | null
  notified_at: string | null
  expires_at: string | null
  lead:
    | {
        requester_first_name: string | null
        requester_last_name: string | null
        requester_phone: string | null
        property_address: string | null
        property_city: string | null
        property_postal_code: string | null
        property_type: string | null
        property_surface_m2: number | null
        property_year_built: number | null
        diagnostics_requested: string[] | null
      }
    | {
        requester_first_name: string | null
        requester_last_name: string | null
        requester_phone: string | null
        property_address: string | null
        property_city: string | null
        property_postal_code: string | null
        property_type: string | null
        property_surface_m2: number | null
        property_year_built: number | null
        diagnostics_requested: string[] | null
      }[]
    | null
}

function normalizeLead(row: RawLeadAssignmentRow): LeadItem {
  const status: LeadItem['status'] =
    row.status === 'responded' || row.status === 'accepted'
      ? 'responded'
      : row.status === 'expired'
        ? 'expired'
        : 'pending'
  const lead = Array.isArray(row.lead) ? row.lead[0] : row.lead
  const displayName = lead
    ? [lead.requester_first_name, lead.requester_last_name].filter(Boolean).join(' ').trim() ||
      'Contact à confirmer'
    : 'Contact à confirmer'
  return {
    id: row.id,
    status,
    receivedAt: row.notified_at ?? new Date().toISOString(),
    clientDisplayName: displayName,
    clientPhone: lead?.requester_phone ?? null,
    propertyAddress: lead?.property_address ?? 'Adresse à confirmer',
    propertyCity: lead?.property_city ?? null,
    propertyPostalCode: lead?.property_postal_code ?? null,
    propertyType: lead?.property_type ?? null,
    propertySurface: lead?.property_surface_m2 ?? null,
    propertyYearBuilt: lead?.property_year_built ?? null,
    missionTypes: (lead?.diagnostics_requested ?? []) as LeadItem['missionTypes'],
    urgency: null,
  }
}

export default async function LeadsPage() {
  const { user } = await getCurrentUser()
  const leads = await fetchPendingLeads(user.id)
  const count = leads.length

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <AppPageHeader
        title="Tes"
        accent="leads"
        description={
          count > 0
            ? `${count} lead${count > 1 ? 's' : ''} en attente · traite le plus ancien d'abord`
            : "Demandes entrantes des particuliers via l'annuaire KOVAS"
        }
      />

      <LeadsFocalClient leads={leads} />
    </div>
  )
}
