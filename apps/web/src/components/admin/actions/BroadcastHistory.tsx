/**
 * Table des 20 derniers broadcasts.
 * Server component : reçoit les rows déjà chargées en prop.
 */

import { Card } from '@/components/ui/card'
import type { BroadcastHistoryRow } from '@/lib/admin/broadcasts-types'

interface BroadcastHistoryProps {
  rows: BroadcastHistoryRow[]
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

const STATUS_STYLES: Record<BroadcastHistoryRow['status'], string> = {
  draft: 'bg-ink/10 text-ink-mute',
  sending: 'bg-amber-100 text-amber-800',
  sent: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-danger/20 text-danger',
  cancelled: 'bg-ink/10 text-ink-mute',
}

export function BroadcastHistory({ rows }: BroadcastHistoryProps) {
  return (
    <Card variant="opaque" padding="default" className="space-y-4">
      <header className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          📜 Historique · 20 derniers
        </p>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
          Broadcasts récents
        </h2>
      </header>

      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-mute italic">Aucun broadcast envoyé pour le moment.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-rule text-left text-ink-mute font-mono uppercase tracking-wider text-[10px]">
                <th className="py-2 pr-3">Sujet</th>
                <th className="py-2 pr-3">Envoyé</th>
                <th className="py-2 pr-3 text-right">Dest.</th>
                <th className="py-2 pr-3 text-right">Livrés</th>
                <th className="py-2 pr-3 text-right">Ouverts</th>
                <th className="py-2 pr-3 text-right">Cliqués</th>
                <th className="py-2 pr-3 text-right">Errs</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-rule/50 hover:bg-paper-soft">
                  <td className="py-2 pr-3 text-ink truncate max-w-[260px]" title={r.subject}>
                    {r.subject}
                  </td>
                  <td className="py-2 pr-3 text-ink-mute">
                    {formatDate(r.sent_at ?? r.created_at)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.recipients_count}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.delivered_count}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.opened_count}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.clicked_count}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-danger">{r.error_count}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-pill ${STATUS_STYLES[r.status]}`}
                    >
                      {r.status}
                    </span>
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
