/**
 * /admin/leads/queue — File des leads et assignments (Mission E2).
 *
 * Server Component : charge en service_role les leads de la semaine + les
 * stats agreggees, passe a un Client Component pour les filtres
 * (routing_strategy, date range, status).
 *
 * Note : table `lead_assignments` creee par Phase E1 en parallele, pas
 * encore dans Database.types — casts `as unknown as` cohérents avec les
 * autres pages admin (cf. SEO kanban).
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Metadata } from 'next'
import {
  type IntentBucket,
  type LeadQueueRow,
  LeadsQueueTable,
  type RoutingStrategy,
} from './LeadsQueueTable'

export const metadata: Metadata = {
  title: 'Queue leads — Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface QuoteRequestNested {
  id: string
  requester_first_name: string | null
  requester_last_name: string | null
  property_city: string | null
  property_surface_m2: number | null
  diagnostics_requested: string[] | null
  created_at: string | null
  intent_score: number | null
  intent_bucket: IntentBucket | null
  // routing_strategy / acceptance_count / closed_at vivent sur quote_requests
  // (l'attribution est dans lead_assignments, mais le contexte de routing reste
  // porté par la demande parente).
  routing_strategy: RoutingStrategy | null
  acceptance_count: number | null
  closed_at: string | null
}

interface LeadAssignmentJoinedRow {
  id: string
  // FK vers quote_requests.id (la colonne s'appelle lead_id en prod, pas
  // quote_request_id — héritage de naming).
  lead_id: string
  created_at: string | null
  quote_requests?: QuoteRequestNested | QuoteRequestNested[] | null
}

function firstQuote(
  qr: QuoteRequestNested | QuoteRequestNested[] | null | undefined,
): QuoteRequestNested | null {
  if (!qr) return null
  if (Array.isArray(qr)) return qr[0] ?? null
  return qr
}

async function fetchRecentLeads(): Promise<LeadQueueRow[]> {
  const supabase = createAdminClient()

  // 30 derniers jours par defaut (le filtre cote client raffine ensuite)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await (
    supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          gte: (
            col: string,
            val: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{
                data: LeadAssignmentJoinedRow[] | null
                error: { message: string } | null
              }>
            }
          }
        }
      }
    }
  )
    .from('lead_assignments')
    .select(
      'id, lead_id, created_at, quote_requests(id, requester_first_name, requester_last_name, property_city, property_surface_m2, diagnostics_requested, created_at, intent_score, intent_bucket, routing_strategy, acceptance_count, closed_at)',
    )
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('fetchRecentLeads error:', error.message)
    return []
  }

  const rows = (data ?? []) as unknown as LeadAssignmentJoinedRow[]

  return rows.map<LeadQueueRow>((r) => {
    const qr = firstQuote(r.quote_requests)
    return {
      id: r.id,
      quoteRequestId: r.lead_id,
      routingStrategy: qr?.routing_strategy ?? 'none',
      acceptanceCount: qr?.acceptance_count ?? 0,
      // assigned_count n'existe pas en base : le nb de destinataires d'un lead
      // = nb de lignes lead_assignments du même lead_id (non agrégé ici).
      assignedCount: 0,
      closedAt: qr?.closed_at ?? null,
      createdAt: r.created_at,
      requesterFirstName: qr?.requester_first_name ?? null,
      requesterLastName: qr?.requester_last_name ?? null,
      city: qr?.property_city ?? null,
      certificationType: (qr?.diagnostics_requested ?? [])[0] ?? null,
      surfaceM2: qr?.property_surface_m2 ?? null,
      intentScore: qr?.intent_score ?? null,
      intentBucket: qr?.intent_bucket ?? null,
    }
  })
}

export default async function AdminLeadsQueuePage() {
  const leads = await fetchRecentLeads()

  // Stats hebdo (7 derniers jours) — calculees cote serveur pour le header
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const leadsThisWeek = leads.filter((l) => {
    if (!l.createdAt) return false
    return new Date(l.createdAt).getTime() >= sevenDaysAgo
  })

  const breakdown: Record<RoutingStrategy, number> = {
    subscribed: 0,
    non_subscribed: 0,
    onboarding_gift: 0,
    none: 0,
  }
  for (const l of leadsThisWeek) {
    breakdown[l.routingStrategy] = (breakdown[l.routingStrategy] ?? 0) + 1
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          Admin · Leads
        </p>
        <h1 className="font-sans font-light text-3xl tracking-tight text-ink">
          Queue <span className="font-serif italic font-normal">leads</span>
          <span className="text-ink-mute">.</span>
        </h1>
        <p className="text-sm text-ink-mute">
          Vue agreggee des assignments leads (30 derniers jours). Filtres cote client pour raffiner
          par strategie, date, status.
        </p>
      </header>

      {/* Stats hebdo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total 7j" value={leadsThisWeek.length} />
        <StatCard label="Abonnes" value={breakdown.subscribed} accent="green" />
        <StatCard label="Non-abonnes" value={breakdown.non_subscribed} accent="orange" />
        <StatCard label="Onboarding gift" value={breakdown.onboarding_gift} accent="blue" />
        <StatCard label="Manuel" value={breakdown.none} accent="muted" />
      </div>

      <LeadsQueueTable initialRows={leads} />
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: 'green' | 'orange' | 'blue' | 'muted'
}) {
  const accentColor =
    accent === 'green'
      ? 'text-[#2D4015]'
      : accent === 'orange'
        ? 'text-[#7C3F0A]'
        : accent === 'blue'
          ? 'text-[#1E3A8A]'
          : accent === 'muted'
            ? 'text-ink-mute'
            : 'text-ink'

  return (
    <div className="glass-opaque rounded-lg p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">{label}</p>
      <p className={`mt-2 text-2xl font-serif italic font-normal ${accentColor}`}>{value}</p>
    </div>
  )
}
