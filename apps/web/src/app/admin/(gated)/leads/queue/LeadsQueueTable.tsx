'use client'

/**
 * LeadsQueueTable — tableau dense des assignments leads (Mission E2).
 *
 * Filtres :
 *   - routing_strategy (all / subscribed / non_subscribed / onboarding_gift / none)
 *   - date range (7j / 30j / all)
 *   - status (open / closed)
 *
 * Pagination cote client : 50 lignes/page.
 *
 * Pattern v5 Synthex : cards opaques + badges colorises selon strategie.
 */

import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { useMemo, useState } from 'react'

export type RoutingStrategy = 'subscribed' | 'non_subscribed' | 'onboarding_gift' | 'none'

export interface LeadQueueRow {
  id: string
  quoteRequestId: string
  routingStrategy: RoutingStrategy
  acceptanceCount: number
  assignedCount: number
  closedAt: string | null
  createdAt: string | null
  requesterFirstName: string | null
  requesterLastName: string | null
  city: string | null
  certificationType: string | null
  surfaceM2: number | null
}

type StrategyFilter = 'all' | RoutingStrategy
type DateRangeFilter = '7j' | '30j' | 'all'
type StatusFilter = 'all' | 'open' | 'closed'

interface LeadsQueueTableProps {
  initialRows: readonly LeadQueueRow[]
}

const PAGE_SIZE = 50

export function LeadsQueueTable({ initialRows }: LeadsQueueTableProps) {
  const [strategy, setStrategy] = useState<StrategyFilter>('all')
  const [dateRange, setDateRange] = useState<DateRangeFilter>('30j')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const nowMs = Date.now()
    const cutoffMs =
      dateRange === '7j'
        ? nowMs - 7 * 24 * 60 * 60 * 1000
        : dateRange === '30j'
          ? nowMs - 30 * 24 * 60 * 60 * 1000
          : 0

    return initialRows.filter((r) => {
      if (strategy !== 'all' && r.routingStrategy !== strategy) return false
      if (status === 'open' && r.closedAt !== null) return false
      if (status === 'closed' && r.closedAt === null) return false
      if (cutoffMs > 0) {
        if (!r.createdAt) return false
        if (new Date(r.createdAt).getTime() < cutoffMs) return false
      }
      return true
    })
  }, [initialRows, strategy, status, dateRange])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pagedRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  function handleStrategyChange(next: StrategyFilter) {
    setStrategy(next)
    setPage(0)
  }
  function handleDateRangeChange(next: DateRangeFilter) {
    setDateRange(next)
    setPage(0)
  }
  function handleStatusChange(next: StatusFilter) {
    setStatus(next)
    setPage(0)
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap items-end gap-3 glass-opaque rounded-lg p-4">
        <FilterGroup label="Strategie">
          <FilterPill active={strategy === 'all'} onClick={() => handleStrategyChange('all')}>
            Toutes
          </FilterPill>
          <FilterPill
            active={strategy === 'subscribed'}
            onClick={() => handleStrategyChange('subscribed')}
          >
            Abonnes
          </FilterPill>
          <FilterPill
            active={strategy === 'non_subscribed'}
            onClick={() => handleStrategyChange('non_subscribed')}
          >
            Non-abonnes
          </FilterPill>
          <FilterPill
            active={strategy === 'onboarding_gift'}
            onClick={() => handleStrategyChange('onboarding_gift')}
          >
            Onboarding gift
          </FilterPill>
          <FilterPill active={strategy === 'none'} onClick={() => handleStrategyChange('none')}>
            Manuel
          </FilterPill>
        </FilterGroup>

        <FilterGroup label="Periode">
          <FilterPill active={dateRange === '7j'} onClick={() => handleDateRangeChange('7j')}>
            7 jours
          </FilterPill>
          <FilterPill active={dateRange === '30j'} onClick={() => handleDateRangeChange('30j')}>
            30 jours
          </FilterPill>
          <FilterPill active={dateRange === 'all'} onClick={() => handleDateRangeChange('all')}>
            Tout
          </FilterPill>
        </FilterGroup>

        <FilterGroup label="Statut">
          <FilterPill active={status === 'all'} onClick={() => handleStatusChange('all')}>
            Tous
          </FilterPill>
          <FilterPill active={status === 'open'} onClick={() => handleStatusChange('open')}>
            Ouverts
          </FilterPill>
          <FilterPill active={status === 'closed'} onClick={() => handleStatusChange('closed')}>
            Cloturés
          </FilterPill>
        </FilterGroup>
      </div>

      {/* Tableau */}
      <div className="glass-opaque rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-cream-deep border-b border-rule">
              <tr>
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                  Date
                </th>
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                  Demandeur
                </th>
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                  Ville
                </th>
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                  Type
                </th>
                <th className="text-right px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                  m²
                </th>
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                  Strategie
                </th>
                <th className="text-right px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                  Acc/Ass
                </th>
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                  Statut
                </th>
                <th className="text-right px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-ink-mute">
                    Aucun lead pour ces filtres.
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-rule/60 hover:bg-paper transition-colors"
                  >
                    <td className="px-3 py-2 text-ink-mute font-mono text-[11px]">
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-ink truncate max-w-[180px]">
                      {formatRequester(r.requesterFirstName, r.requesterLastName)}
                    </td>
                    <td className="px-3 py-2 text-ink-mute">{r.city ?? '—'}</td>
                    <td className="px-3 py-2 text-ink-mute font-mono text-[11px] uppercase">
                      {r.certificationType ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-mute font-mono text-[11px]">
                      {r.surfaceM2 ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <StrategyBadge strategy={r.routingStrategy} />
                    </td>
                    <td className="px-3 py-2 text-right text-ink-mute font-mono text-[11px]">
                      {r.acceptanceCount}/{r.assignedCount}
                    </td>
                    <td className="px-3 py-2">
                      {r.closedAt ? (
                        <span className="text-ink-mute text-[11px]">Cloturé</span>
                      ) : (
                        <span className="font-mono text-[11px] text-[#2D4015]">● Ouvert</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/admin/leads/${r.id}`}
                        className="text-[11px] text-ink hover:underline"
                      >
                        Détail →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-mute">
            {filtered.length} resultats · page {safePage + 1} / {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="rounded-pill border border-rule px-3 py-1 text-xs hover:bg-paper disabled:opacity-40"
            >
              ← Préc.
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="rounded-pill border border-rule px-3 py-1 text-xs hover:bg-paper disabled:opacity-40"
            >
              Suiv. →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function StrategyBadge({ strategy }: { strategy: RoutingStrategy }) {
  switch (strategy) {
    case 'subscribed':
      return <Badge variant="green">Abonnes</Badge>
    case 'non_subscribed':
      return <Badge variant="orange">Non-abonnes</Badge>
    case 'onboarding_gift':
      return <Badge variant="blue">Onboarding</Badge>
    default:
      return <Badge variant="muted">Manuel</Badge>
  }
}

function FilterGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-pill bg-navy text-paper px-3 py-1 text-[11px] font-medium'
          : 'rounded-pill bg-paper border border-rule text-ink-mute px-3 py-1 text-[11px] hover:text-ink transition-colors'
      }
    >
      {children}
    </button>
  )
}

function formatRequester(first: string | null, last: string | null): string {
  const f = (first ?? '').trim()
  const l = (last ?? '').trim()
  if (!f && !l) return '—'
  const lastInitial = l.length > 0 ? `${l.charAt(0)}.` : ''
  return `${f} ${lastInitial}`.trim()
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${day}/${month} ${hh}:${mm}`
}
