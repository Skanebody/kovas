/**
 * Liste des utilisateurs proches du quota mensuel de scans (≥ 80%).
 * Alerts list colorée : amber 80-99%, red ≥ 100%.
 */

import { Card } from '@/components/ui/card'
import type { UserNearQuotaEntry } from '@/lib/admin/document-metrics'
import { cn } from '@/lib/utils'
import { AlertCircle, AlertTriangle } from 'lucide-react'

interface UsersNearQuotaAlertsProps {
  users: UserNearQuotaEntry[]
}

function statusOf(percent: number): 'warning' | 'critical' {
  return percent >= 100 ? 'critical' : 'warning'
}

export function UsersNearQuotaAlerts({ users }: UsersNearQuotaAlertsProps) {
  return (
    <Card variant="opaque" padding="default">
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Quota scans · alertes
          </p>
          <h3 className="text-[15px] font-semibold tracking-tight text-ink mt-1">
            Utilisateurs proches du quota
          </h3>
          <p className="text-[12px] text-ink-mute mt-1">
            ≥ 80% du quota Document Intelligence ce mois — candidats upgrade.
          </p>
        </div>
        <span className="font-mono text-[10px] text-ink-faint">
          {users.length} user{users.length > 1 ? 's' : ''}
        </span>
      </header>

      {users.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">
          Aucun utilisateur au-dessus de 80% du quota ce mois.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Utilisateurs proches du quota">
          {users.map((u) => {
            const status = statusOf(u.percentUsed)
            const Icon = status === 'critical' ? AlertTriangle : AlertCircle
            return (
              <li
                key={u.userId}
                className={cn(
                  'rounded-md border px-3 py-2.5 flex items-center gap-3',
                  status === 'critical'
                    ? 'border-danger/40 bg-danger/[0.06]'
                    : 'border-warning/40 bg-warning/[0.06]',
                )}
              >
                <Icon
                  className={cn(
                    'size-4 shrink-0',
                    status === 'critical' ? 'text-danger' : 'text-warning',
                  )}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <a
                    href={`/admin/users?user=${u.userId}`}
                    className="text-[13px] font-medium text-ink hover:underline truncate block"
                  >
                    {u.name}
                  </a>
                  <p className="font-mono text-[11px] text-ink-mute">
                    {u.scansUsed} / {u.scansIncluded} scans
                  </p>
                </div>
                <span
                  className={cn(
                    'font-mono text-[12px] font-semibold tabular-nums',
                    status === 'critical' ? 'text-danger' : 'text-warning',
                  )}
                >
                  {u.percentUsed >= 999 ? '> 999%' : `${u.percentUsed}%`}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
