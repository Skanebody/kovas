'use client'

import { Badge } from '@/components/ui/badge'
import { useMemo, useState } from 'react'

export type ReferralRowStatus =
  | 'pending'
  | 'subscribed'
  | 'paid_invoice_1'
  | 'rewarded'
  | 'cancelled'

export interface ReferralRow {
  id: string
  maskedName: string
  signedUpAt: string | null
  status: ReferralRowStatus
  rewardEurCents: number | null
}

export interface ReferralsTableProps {
  rows: ReferralRow[]
}

type SortKey = 'date_desc' | 'date_asc'

const STATUS_FILTERS: Array<{ key: 'all' | ReferralRowStatus; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'subscribed', label: 'Inscrits' },
  { key: 'paid_invoice_1', label: '1re facture payée' },
  { key: 'rewarded', label: 'Récompensés' },
  { key: 'cancelled', label: 'Annulés' },
]

/**
 * Tableau des filleuls avec filtre par statut + tri par date.
 *
 * Server fetch (page) → rows propagés en prop, filtrage purement client
 * pour rester instantané sur les 50 dernières lignes (limite SQL côté lib).
 */
export function ReferralsTable({ rows }: ReferralsTableProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | ReferralRowStatus>('all')
  const [sortKey, setSortKey] = useState<SortKey>('date_desc')

  const filtered = useMemo(() => {
    const baseline = statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter)
    return [...baseline].sort((a, b) => {
      const da = a.signedUpAt ? new Date(a.signedUpAt).getTime() : 0
      const db = b.signedUpAt ? new Date(b.signedUpAt).getTime() : 0
      return sortKey === 'date_desc' ? db - da : da - db
    })
  }, [rows, statusFilter, sortKey])

  if (rows.length === 0) {
    return (
      <p className="text-[13px] text-ink-mute py-6 text-center">
        Aucun filleul pour l'instant. Partage ton lien pour démarrer.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset className="flex flex-wrap gap-1.5 border-0 p-0 m-0">
          <legend className="sr-only">Filtrer par statut</legend>
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                aria-pressed={active}
                className={
                  active
                    ? 'inline-flex items-center rounded-pill bg-navy text-paper px-3 py-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30'
                    : 'inline-flex items-center rounded-pill border border-rule bg-paper text-ink-mute hover:text-ink hover:bg-cream-deep px-3 py-1 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 transition-colors'
                }
              >
                {f.label}
              </button>
            )
          })}
        </fieldset>
        <button
          type="button"
          onClick={() => setSortKey((s) => (s === 'date_desc' ? 'date_asc' : 'date_desc'))}
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute hover:text-ink"
        >
          Tri · {sortKey === 'date_desc' ? 'Plus récent' : 'Plus ancien'}
        </button>
      </div>

      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-[13px] min-w-[480px]">
          <thead>
            <tr className="border-b border-rule/60">
              <th className="text-left font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute py-2 pr-3">
                Filleul
              </th>
              <th className="text-left font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute py-2 pr-3">
                Inscription
              </th>
              <th className="text-left font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute py-2 pr-3">
                Statut
              </th>
              <th className="text-right font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute py-2 pl-3">
                Récompense
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-[12px] text-ink-mute">
                  Aucune ligne ne correspond à ce filtre.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b border-rule/30 last:border-0">
                  <td className="py-2.5 pr-3 text-ink">{r.maskedName}</td>
                  <td className="py-2.5 pr-3 font-mono text-[12px] text-ink-mute">
                    {r.signedUpAt ? formatDate(r.signedUpAt) : '—'}
                  </td>
                  <td className="py-2.5 pr-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-2.5 pl-3 text-right font-mono text-[13px]">
                    {r.rewardEurCents ? (
                      formatEur(r.rewardEurCents)
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: ReferralRowStatus }) {
  switch (status) {
    case 'pending':
      return <Badge variant="muted">En attente</Badge>
    case 'subscribed':
      return <Badge variant="blue">Inscrit</Badge>
    case 'paid_invoice_1':
      return <Badge variant="green">1re facture payée</Badge>
    case 'rewarded':
      return <Badge variant="green">Récompensé</Badge>
    case 'cancelled':
      return <Badge variant="red">Annulé</Badge>
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatEur(cents: number): string {
  return `${(cents / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}
