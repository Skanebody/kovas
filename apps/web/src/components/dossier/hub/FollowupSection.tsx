import { Card } from '@/components/ui/card'
import { Bell, Clock, Sparkles } from 'lucide-react'

export interface FollowupItem {
  id: string
  kind: 'milestone' | 'opportunity' | 'reminder'
  at: string
  label: string
  description: string | null
  done: boolean
}

interface FollowupSectionProps {
  items: ReadonlyArray<FollowupItem>
}

/**
 * Section 8 — Suivi automatique + opportunités.
 * Timeline jalons J+3 / J+7 / opportunités de relance.
 */
export function FollowupSection({ items }: FollowupSectionProps) {
  const upcoming = items.filter((i) => !i.done).slice(0, 5)
  const past = items.filter((i) => i.done).slice(0, 3)

  return (
    <Card variant="flat" padding="default" id="followup" className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Suivi automatique</h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">Section 08</p>
      </div>

      {upcoming.length > 0 ? (
        <ol className="space-y-2">
          {upcoming.map((it) => {
            const Icon =
              it.kind === 'opportunity' ? Sparkles : it.kind === 'milestone' ? Clock : Bell
            return (
              <li
                key={it.id}
                className="flex items-start gap-3 rounded-md border border-rule/50 bg-paper px-3 py-2.5"
              >
                <Icon className="size-4 text-ink-mute shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium text-ink truncate">{it.label}</p>
                    <p className="font-mono text-[10px] text-ink-faint">
                      {new Date(it.at).toLocaleDateString('fr-FR', { dateStyle: 'short' })}
                    </p>
                  </div>
                  {it.description ? (
                    <p className="text-[12px] text-ink-mute mt-0.5">{it.description}</p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="rounded-md border border-dashed border-rule/60 bg-cream-deep/30 p-4 text-center text-[13px] text-ink-mute">
          Aucun suivi programmé. Les jalons J+3 / J+7 et les opportunités apparaîtront ici après envoi.
        </div>
      )}

      {past.length > 0 ? (
        <details className="text-[12px] text-ink-mute">
          <summary className="cursor-pointer select-none hover:text-ink">
            Historique ({past.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {past.map((it) => (
              <li key={it.id} className="flex items-baseline justify-between gap-2">
                <span className="text-ink-mute">{it.label}</span>
                <span className="font-mono text-[10px] text-ink-faint">
                  {new Date(it.at).toLocaleDateString('fr-FR', { dateStyle: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  )
}
