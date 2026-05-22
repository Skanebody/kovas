import { createClient } from '@/lib/supabase/server'
import { formatDate, formatEur } from './format-helpers'

type Props = {
  clientId: string
  orgId: string
  /** Nombre de dossiers déjà compté côté page parente */
  dossierTotal: number
}

/**
 * Encart statistiques compact (4 KPI) — pattern Qonto.
 *
 *  1. Nombre de dossiers (count)
 *  2. CA total HT (somme `invoices.amount_ht`, statut != cancelled)
 *  3. Délai moyen paiement (jours, sur factures payées : paid_at - issued_at)
 *  4. Date dernière mission (max dossiers.scheduled_at)
 */
export async function ClientStatsCard({ clientId, orgId, dossierTotal }: Props) {
  const supabase = await createClient()

  const [{ data: invoiceAggr }, { data: lastDossier }] = await Promise.all([
    supabase
      .from('invoices')
      .select('amount_ht, issued_at, paid_at, status')
      .eq('organization_id', orgId)
      .eq('client_id', clientId),
    supabase
      .from('dossiers')
      .select('scheduled_at, started_at, completed_at')
      .eq('organization_id', orgId)
      .eq('client_id', clientId)
      .is('deleted_at', null)
      .order('scheduled_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ])

  const invoices = invoiceAggr ?? []
  const totalHt = invoices
    .filter((i) => i.status !== 'cancelled')
    .reduce((sum, i) => sum + (Number.parseFloat(String(i.amount_ht ?? '0')) || 0), 0)

  const paidDelays: number[] = []
  for (const inv of invoices) {
    if (inv.status === 'paid' && inv.issued_at && inv.paid_at) {
      const issued = new Date(inv.issued_at).getTime()
      const paid = new Date(inv.paid_at).getTime()
      if (Number.isFinite(issued) && Number.isFinite(paid) && paid >= issued) {
        paidDelays.push(Math.round((paid - issued) / (24 * 60 * 60 * 1000)))
      }
    }
  }
  const avgDelay =
    paidDelays.length > 0
      ? Math.round(paidDelays.reduce((s, d) => s + d, 0) / paidDelays.length)
      : null

  const lastMission =
    lastDossier?.completed_at ?? lastDossier?.scheduled_at ?? lastDossier?.started_at ?? null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KpiCell label="Dossiers" value={String(dossierTotal)} mono />
      <KpiCell label="CA HT total" value={formatEur(totalHt)} mono />
      <KpiCell
        label="Délai moyen paiement"
        value={avgDelay !== null ? `${avgDelay} j` : '—'}
        mono
      />
      <KpiCell label="Dernière mission" value={formatDate(lastMission)} />
    </div>
  )
}

function KpiCell({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="rounded-xl border border-rule/60 bg-paper/85 px-4 py-3 shadow-glass-xs">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute mb-1">
        {label}
      </div>
      <div
        className={
          'text-base font-semibold text-ink tabular-nums ' + (mono ? 'font-mono' : 'font-sans')
        }
      >
        {value}
      </div>
    </div>
  )
}
