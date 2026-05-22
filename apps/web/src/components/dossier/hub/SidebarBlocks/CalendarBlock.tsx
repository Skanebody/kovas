import { Card } from '@/components/ui/card'
import { Calendar } from 'lucide-react'

export interface CalendarEntry {
  id: string
  kind: 'mission' | 'followup' | 'milestone'
  at: string
  label: string
}

interface CalendarBlockProps {
  entries: ReadonlyArray<CalendarEntry>
}

/**
 * Bloc sidebar — Calendrier (RDV + actions programmées + jalons auto).
 */
export function CalendarBlock({ entries }: CalendarBlockProps) {
  const sorted = [...entries].sort((a, b) => (a.at < b.at ? -1 : 1)).slice(0, 4)

  return (
    <Card variant="flat" padding="sm" className="space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="size-3.5 text-ink-mute" />
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">Calendrier</p>
      </div>

      {sorted.length > 0 ? (
        <ul className="space-y-2">
          {sorted.map((e) => (
            <li key={e.id} className="flex items-start gap-2">
              <p className="font-mono text-[11px] text-ink shrink-0 min-w-[58px]">
                {new Date(e.at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
              </p>
              <div className="min-w-0">
                <p className="text-[12px] text-ink leading-tight truncate">{e.label}</p>
                <p className="text-[10px] text-ink-faint">
                  {new Date(e.at).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-ink-faint">Aucune échéance.</p>
      )}
    </Card>
  )
}
