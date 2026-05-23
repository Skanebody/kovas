/**
 * KOVAS — Section Factures pour la page Facturation unifiée.
 *
 * Server Component qui charge les 3 listes urgence (en retard / à échéance /
 * payées) et délègue le rendu aux sous-composants existants
 * (`FacturesUrgencySection`, `FacturesPaidSummary`). Réutilise exactement la
 * logique de la page `/dashboard/factures` historique.
 */

import {
  FacturesPaidSummary,
  FacturesUrgencySection,
  type FactureUrgencyRow,
} from '@/components/factures/FacturesUrgencySection'
import { getCurrentUser } from '@/lib/auth/current-user'

interface InvoiceDbRow {
  id: string
  reference: string
  amount_ttc: number
  paid_amount: number | null
  due_date: string | null
  issued_at: string | null
  client_id: string | null
  client_snapshot: {
    display_name?: string
    email?: string | null
  } | null
  clients: { display_name: string | null; email: string | null } | null
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
  }).format(d)
}

function toOverdueRow(inv: InvoiceDbRow): FactureUrgencyRow {
  const ttc = Number(inv.amount_ttc)
  const paid = inv.paid_amount === null ? 0 : Number(inv.paid_amount)
  const due = Math.max(0, ttc - paid)
  return {
    id: inv.id,
    reference: inv.reference,
    dateShort: formatDateShort(inv.due_date ?? inv.issued_at),
    clientName:
      inv.clients?.display_name ??
      inv.client_snapshot?.display_name ??
      'Client retiré',
    clientEmail: inv.clients?.email ?? inv.client_snapshot?.email ?? null,
    amountDueEur: due,
  }
}

function toUpcomingRow(inv: InvoiceDbRow): FactureUrgencyRow {
  const ttc = Number(inv.amount_ttc)
  const paid = inv.paid_amount === null ? 0 : Number(inv.paid_amount)
  const due = Math.max(0, ttc - paid)
  return {
    id: inv.id,
    reference: inv.reference,
    dateShort: formatDateShort(inv.due_date),
    clientName:
      inv.clients?.display_name ??
      inv.client_snapshot?.display_name ??
      'Client retiré',
    clientEmail: inv.clients?.email ?? inv.client_snapshot?.email ?? null,
    amountDueEur: due,
  }
}

export async function FacturesSectionLive() {
  const { supabase, orgId } = await getCurrentUser()

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const in7daysIso = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const baseSelect =
    'id, reference, amount_ttc, paid_amount, due_date, issued_at, client_id, client_snapshot, clients(display_name, email)'

  const [overdueQ, upcomingQ, paidStats, paidSumQ] = await Promise.all([
    supabase
      .from('invoices')
      .select(baseSelect)
      .eq('organization_id', orgId)
      .in('status', ['issued', 'partial', 'overdue'])
      .lt('due_date', today)
      .order('due_date', { ascending: true })
      .limit(50),
    supabase
      .from('invoices')
      .select(baseSelect)
      .eq('organization_id', orgId)
      .in('status', ['issued', 'partial'])
      .gte('due_date', today)
      .lte('due_date', in7daysIso)
      .order('due_date', { ascending: true })
      .limit(50),
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'paid'),
    supabase
      .from('invoices')
      .select('paid_amount')
      .eq('organization_id', orgId)
      .eq('status', 'paid'),
  ])

  const overdue = ((overdueQ.data ?? []) as unknown as InvoiceDbRow[]).map(
    toOverdueRow,
  )
  const upcoming = ((upcomingQ.data ?? []) as unknown as InvoiceDbRow[]).map(
    toUpcomingRow,
  )

  const paidCount = paidStats.count ?? 0
  const totalCollectedEur = (paidSumQ.data ?? []).reduce(
    (acc, row) =>
      acc + Number((row as { paid_amount: number | null }).paid_amount ?? 0),
    0,
  )

  return (
    <div className="space-y-8">
      <FacturesUrgencySection kind="overdue" rows={overdue} />
      <FacturesUrgencySection kind="upcoming" rows={upcoming} />
      <FacturesPaidSummary
        paidCount={paidCount}
        totalCollectedEur={totalCollectedEur}
      />
    </div>
  )
}
