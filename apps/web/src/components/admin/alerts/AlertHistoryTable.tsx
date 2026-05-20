'use client'

/**
 * Table des 30 dernières alertes résolues (7 derniers jours).
 *
 * Filtres : par règle (select) + par severity. Reçoit les events depuis le
 * parent (server component) pour éviter un fetch supplémentaire — la liste
 * change peu et n'a pas besoin de polling.
 */

import type { AlertEventDto } from '@/app/api/admin/alerts/route'
import { Card } from '@/components/ui/card'
import { History } from 'lucide-react'
import { useMemo, useState } from 'react'

interface AlertHistoryTableProps {
  events: AlertEventDto[]
}

type SeverityFilter = 'all' | 'info' | 'warning' | 'critical'

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return '—'
  }
}

const SEVERITY_DOT: Record<'info' | 'warning' | 'critical', string> = {
  info: 'bg-accent-blue',
  warning: 'bg-warning',
  critical: 'bg-accent-red',
}

export function AlertHistoryTable({ events }: AlertHistoryTableProps) {
  const [ruleFilter, setRuleFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')

  const ruleOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const ev of events) map.set(ev.rule_id, ev.rule_name)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [events])

  const filtered = useMemo(
    () =>
      events.filter((e) => {
        if (ruleFilter !== 'all' && e.rule_id !== ruleFilter) return false
        if (severityFilter !== 'all' && e.rule_severity !== severityFilter) return false
        return true
      }),
    [events, ruleFilter, severityFilter],
  )

  return (
    <Card variant="opaque" padding="default">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink flex items-center gap-2">
          <History className="size-4 text-ink-mute" aria-hidden />
          Historique résolues · 7j
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value)}
            className="rounded-md border border-rule/60 bg-paper px-2 py-1 text-[11px] text-ink focus:outline-none focus:ring-2 focus:ring-chartreuse/40"
            aria-label="Filtrer par règle"
          >
            <option value="all">Toutes les règles</option>
            {ruleOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
            className="rounded-md border border-rule/60 bg-paper px-2 py-1 text-[11px] text-ink focus:outline-none focus:ring-2 focus:ring-chartreuse/40"
            aria-label="Filtrer par severity"
          >
            <option value="all">Toutes severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">Aucune alerte résolue sur la période.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint border-b border-rule/60">
                <th className="py-2 font-normal">Sev</th>
                <th className="py-2 font-normal">Règle</th>
                <th className="py-2 font-normal">Cible</th>
                <th className="py-2 font-normal">Note</th>
                <th className="py-2 font-normal text-right">Déclenchée</th>
                <th className="py-2 font-normal text-right">Résolue</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev) => (
                <tr key={ev.id} className="border-b border-rule/30 last:border-b-0">
                  <td className="py-2.5">
                    <span
                      className={`inline-flex size-2 rounded-full ${SEVERITY_DOT[ev.rule_severity]}`}
                      aria-label={ev.rule_severity}
                    />
                  </td>
                  <td className="py-2.5 text-ink font-medium">{ev.rule_name}</td>
                  <td className="py-2.5 text-ink-mute">{ev.target_label ?? '—'}</td>
                  <td className="py-2.5 text-ink-mute truncate max-w-[220px]">
                    {ev.resolution_note ?? '—'}
                  </td>
                  <td className="py-2.5 text-right font-mono text-ink-mute">
                    {formatDate(ev.created_at)}
                  </td>
                  <td className="py-2.5 text-right font-mono text-ink-mute">
                    {ev.resolved_at ? formatDate(ev.resolved_at) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
