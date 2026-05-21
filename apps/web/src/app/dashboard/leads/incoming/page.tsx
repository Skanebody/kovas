/**
 * /dashboard/leads/incoming — Vue diagnostiqueur : leads recus a repondre.
 *
 * Server Component : charge les lead_assignments lies au diagnostician
 * claime par l'user courant. Anonymisation cote serveur tant que le diag
 * n'a pas accepte (last_name reduit a l'initiale, email/phone masques).
 *
 * Pattern : verrouillage par status. Une fois `accepted`, les coordonnees
 * sont debloquees via la Server Action `acceptLeadAssignment`.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { getCurrentUser } from '@/lib/auth/current-user'
import { asUntyped } from '@/lib/diagnosticians/supabase-untyped'
import type { Metadata } from 'next'
import {
  type AssignmentStatus,
  type IncomingLeadAssignment,
  IncomingLeadsList,
} from './IncomingLeadsList'

export const metadata: Metadata = { title: 'Leads recus' }

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface DiagRow {
  id: string
}

interface QuoteRequestNested {
  id: string
  requester_first_name: string | null
  requester_last_name: string | null
  property_city: string | null
  property_postal_code: string | null
  property_surface_m2: number | null
  property_type: string | null
  diagnostics_requested: string[] | null
  urgency: string | null
  acceptance_count: number | null
  requester_email: string | null
  requester_phone: string | null
  property_address: string | null
  message: string | null
}

interface AssignmentJoinedRow {
  id: string
  quote_request_id: string
  status: AssignmentStatus | null
  expires_at: string | null
  responded_at: string | null
  created_at: string | null
  assignment_type: string | null
  routing_strategy: string | null
  diagnostician_id: string
  // PostgREST renvoie soit l'objet (single FK) soit un tableau selon la
  // generation des types. On accepte les deux et on normalise.
  quote_requests?: QuoteRequestNested | QuoteRequestNested[] | null
}

function firstQuote(
  qr: QuoteRequestNested | QuoteRequestNested[] | null | undefined,
): QuoteRequestNested | null {
  if (!qr) return null
  if (Array.isArray(qr)) return qr[0] ?? null
  return qr
}

function maskLastName(last: string | null): string {
  if (!last || last.length === 0) return ''
  return `${last.charAt(0).toUpperCase()}***`
}

export default async function IncomingLeadsPage() {
  const { supabase: typedSupabase, user } = await getCurrentUser()
  const supabase = asUntyped(typedSupabase)

  // 1. Diagnosticians claimes par cet user
  const { data: diagsRaw } = await supabase
    .from('diagnosticians')
    .select('id')
    .eq('claimed_by_user_id', user.id)

  const diags = (diagsRaw ?? []) as DiagRow[]
  const diagIds = diags.map((d) => d.id)

  let assignments: IncomingLeadAssignment[] = []

  if (diagIds.length > 0) {
    const { data: assignsRaw } = await supabase
      .from('lead_assignments')
      .select(
        'id, quote_request_id, status, expires_at, responded_at, created_at, assignment_type, routing_strategy, diagnostician_id, quote_requests(id, requester_first_name, requester_last_name, property_city, property_postal_code, property_surface_m2, property_type, diagnostics_requested, urgency, acceptance_count, requester_email, requester_phone, property_address, message)',
      )
      .in('diagnostician_id', diagIds)
      .order('created_at', { ascending: false })
      .limit(200)

    const rows = (assignsRaw ?? []) as unknown as AssignmentJoinedRow[]

    assignments = rows.map<IncomingLeadAssignment>((r) => {
      const isAccepted = r.status === 'accepted'
      const qr = firstQuote(r.quote_requests)
      return {
        id: r.id,
        quoteRequestId: r.quote_request_id,
        status: r.status ?? 'pending',
        expiresAt: r.expires_at,
        respondedAt: r.responded_at,
        createdAt: r.created_at,
        assignmentType: r.assignment_type,
        routingStrategy: r.routing_strategy,
        diagnosticianId: r.diagnostician_id,
        // Identite anonymisee tant que pas accepte
        requesterFirstName: qr?.requester_first_name ?? null,
        requesterLastNameMasked: isAccepted
          ? (qr?.requester_last_name ?? null)
          : maskLastName(qr?.requester_last_name ?? null),
        // Coordonnees debloquees uniquement si accepte
        requesterEmail: isAccepted ? (qr?.requester_email ?? null) : null,
        requesterPhone: isAccepted ? (qr?.requester_phone ?? null) : null,
        propertyAddress: isAccepted ? (qr?.property_address ?? null) : null,
        message: isAccepted ? (qr?.message ?? null) : null,
        // Champs publics quel que soit le status
        city: qr?.property_city ?? null,
        postalCode: qr?.property_postal_code ?? null,
        surfaceM2: qr?.property_surface_m2 ?? null,
        propertyType: qr?.property_type ?? null,
        diagnosticsRequested: qr?.diagnostics_requested ?? [],
        urgency: qr?.urgency ?? null,
      }
    })
  }

  const pendingCount = assignments.filter((a) => a.status === 'pending').length
  const earliestExpiry = assignments
    .filter((a) => a.status === 'pending' && a.expiresAt !== null)
    .map((a) => new Date(a.expiresAt as string).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)[0]
  const hoursToExpiry =
    earliestExpiry !== undefined
      ? Math.max(0, Math.round((earliestExpiry - Date.now()) / (1000 * 60 * 60)))
      : null

  const subtitle =
    pendingCount === 0
      ? 'Aucun lead en attente pour le moment.'
      : hoursToExpiry !== null
        ? `${pendingCount} lead${pendingCount > 1 ? 's' : ''} en attente, le plus urgent expire dans ${hoursToExpiry} h.`
        : `${pendingCount} lead${pendingCount > 1 ? 's' : ''} en attente.`

  return (
    <div className="space-y-6">
      <AppPageHeader title="Vos" accent="leads a repondre" description={subtitle} />

      <IncomingLeadsList initialAssignments={assignments} />
    </div>
  )
}
