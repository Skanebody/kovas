/**
 * Top users par volume de documents scannés ce mois.
 * Table 4 colonnes : user / org / volume / coût IA.
 */

import { Card } from '@/components/ui/card'
import type { DocumentUserVolumeEntry } from '@/lib/admin/document-metrics'

interface UserDocumentVolumeTableProps {
  users: DocumentUserVolumeEntry[]
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

export function UserDocumentVolumeTable({ users }: UserDocumentVolumeTableProps) {
  return (
    <Card variant="opaque" padding="default">
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Top users · volume 30j
          </p>
          <h3 className="text-[15px] font-semibold tracking-tight text-ink mt-1">
            Plus gros utilisateurs Document Intelligence
          </h3>
        </div>
        <span className="font-mono text-[10px] text-ink-faint">
          {users.length} user{users.length > 1 ? 's' : ''}
        </span>
      </header>

      {users.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">
          Aucun utilisateur n’a scanné de document ces 30 derniers jours.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left border-b border-rule/60">
                <th className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint font-medium">
                  Utilisateur
                </th>
                <th className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint font-medium">
                  Organisation
                </th>
                <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint font-medium">
                  Volume
                </th>
                <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint font-medium">
                  Coût IA
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => (
                <tr
                  key={u.userId}
                  className="border-b border-rule/30 last:border-b-0 hover:bg-ink/[0.02]"
                >
                  <td className="px-2 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-ink-faint w-5">#{idx + 1}</span>
                      <a
                        href={`/admin/users?user=${u.userId}`}
                        className="text-ink font-medium hover:underline truncate"
                      >
                        {u.name}
                      </a>
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-ink-mute truncate max-w-[160px]">{u.orgName}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-ink">
                    {formatInt(u.volumeMonth)}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-ink">
                    {formatEur(u.costEur)}
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
