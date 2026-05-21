import { AppPageHeader } from '@/components/app-page-header'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { Metadata } from 'next'
import { LeadsFocalClient } from './leads-focal-client'
import type { LeadItem } from './leads-types'

export const metadata: Metadata = { title: 'Leads' }

/**
 * Page Leads — file d'attente focale 1 lead à la fois.
 *
 * NB : la table `lead_assignments` (Phase E) n'est pas encore déployée.
 * Le fetch est volontairement défensif : si la table n'existe pas, la page
 * affiche un empty state pédagogique sans planter le rendu.
 */
async function fetchPendingLeads(orgId: string): Promise<LeadItem[]> {
  const { supabase } = await getCurrentUser()

  // Try : si la table `lead_assignments` est présente, on l'utilise.
  // Sinon (Phase E non encore migrée), on retombe sur une liste vide.
  try {
    const { data, error } = await supabase
      .from('lead_assignments' as never)
      .select(
        'id, status, received_at, response_note, urgency, client_display_name, client_phone, property_address, property_city, property_postal_code, property_type, property_surface, property_year_built, mission_types',
      )
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .order('received_at', { ascending: true })
      .limit(50)

    if (error) {
      // Table inexistante → on renvoie [] silencieusement
      return []
    }

    const rows = (data ?? []) as unknown as RawLeadRow[]
    return rows.map(normalizeLead)
  } catch {
    return []
  }
}

interface RawLeadRow {
  id: string
  status: string | null
  received_at: string
  urgency: string | null
  client_display_name: string | null
  client_phone: string | null
  property_address: string | null
  property_city: string | null
  property_postal_code: string | null
  property_type: string | null
  property_surface: number | null
  property_year_built: number | null
  mission_types: string[] | null
}

function normalizeLead(row: RawLeadRow): LeadItem {
  const status: LeadItem['status'] =
    row.status === 'responded' || row.status === 'expired' ? row.status : 'pending'
  return {
    id: row.id,
    status,
    receivedAt: row.received_at,
    clientDisplayName: row.client_display_name ?? 'Contact à confirmer',
    clientPhone: row.client_phone,
    propertyAddress: row.property_address ?? 'Adresse à confirmer',
    propertyCity: row.property_city,
    propertyPostalCode: row.property_postal_code,
    propertyType: row.property_type,
    propertySurface: row.property_surface,
    propertyYearBuilt: row.property_year_built,
    missionTypes: (row.mission_types ?? []) as LeadItem['missionTypes'],
    urgency: row.urgency,
  }
}

export default async function LeadsPage() {
  const { orgId } = await getCurrentUser()
  const leads = await fetchPendingLeads(orgId)
  const count = leads.length

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <AppPageHeader
        title="Vos"
        accent="leads"
        description={
          count > 0
            ? `${count} lead${count > 1 ? 's' : ''} en attente · traitez le plus ancien d'abord`
            : 'Demandes entrantes des particuliers via l\'annuaire KOVAS'
        }
      />

      <LeadsFocalClient leads={leads} />
    </div>
  )
}
