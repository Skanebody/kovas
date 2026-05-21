import { AppPageHeader } from '@/components/app-page-header'
import {
  FacturesPaidSummary,
  FacturesUrgencySection,
  type FactureUrgencyRow,
} from '@/components/factures/FacturesUrgencySection'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Factures' }
export const dynamic = 'force-dynamic'

/**
 * Page Factures refondue 2026-05-22 — focus URGENCE (3 sections).
 *
 * Architecture :
 *   1. "En retard" (priorité absolue, en tête, action [Relancer] chartreuse)
 *   2. "À échéance" (à venir 7 jours, pas d'action inline)
 *   3. "Payées" (compteur seul + lien historique, pas la liste)
 *
 * Plus de tableau dense. Recherche : Cmd+K (palette globale).
 */

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

export default async function FacturesPage() {
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
    (acc, row) => acc + Number((row as { paid_amount: number | null }).paid_amount ?? 0),
    0,
  )

  return (
    <div className="space-y-8 animate-fade-in">
      <AppPageHeader
        title="Vos"
        accent="factures"
        description="Trois sections par ordre d'urgence — en retard, à venir, payées."
        action={
          <Button asChild variant="accent">
            <Link href="/dashboard/factures/nouveau">
              <Plus className="size-4" />
              Nouvelle facture
            </Link>
          </Button>
        }
      />

      <FacturesUrgencySection kind="overdue" rows={overdue} />
      <FacturesUrgencySection kind="upcoming" rows={upcoming} />
      <FacturesPaidSummary
        paidCount={paidCount}
        totalCollectedEur={totalCollectedEur}
      />
    </div>
  )
}
