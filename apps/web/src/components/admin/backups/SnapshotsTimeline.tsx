/**
 * Timeline visuelle des 30 derniers snapshots PITR.
 * Cellules colorées vert (available) / gris (hors rétention).
 */

import { Card } from '@/components/ui/card'
import type { BackupSnapshotInfo } from '@/lib/admin/observability'

interface Props {
  snapshots: BackupSnapshotInfo[]
  retentionDays: number
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
  })
}

export function SnapshotsTimeline({ snapshots, retentionDays }: Props) {
  // On affiche les snapshots du plus récent au plus ancien (gauche → droite)
  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">
          Timeline des snapshots
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          30 derniers jours
        </span>
      </div>

      <div className="grid grid-cols-10 gap-1.5 mb-3" aria-label="Snapshots PITR">
        {snapshots.map((s, idx) => {
          const isInRetention = idx < retentionDays
          return (
            <div
              key={s.takenAt}
              className={`flex flex-col items-center justify-center rounded-sm py-2 ${
                isInRetention ? 'bg-success/15 text-success' : 'bg-ink-mute/10 text-ink-faint'
              }`}
              title={`${new Date(s.takenAt).toLocaleString('fr-FR')} — ${
                isInRetention ? 'disponible PITR' : 'hors rétention'
              }`}
            >
              <span className="font-mono text-[10px] tabular-nums">{formatDate(s.takenAt)}</span>
              <span className="size-1.5 rounded-full bg-current mt-1" aria-hidden />
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 text-[11px] font-mono uppercase tracking-[0.14em] text-ink-mute">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" /> Récupérable (PITR)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-ink-mute/40" /> Hors rétention
        </span>
      </div>
    </Card>
  )
}
