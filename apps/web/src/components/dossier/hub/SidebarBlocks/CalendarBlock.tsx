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
        <Calendar className="size-3.5 text-[#0F1419]/72" />
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/72">
          Calendrier
        </p>
      </div>

      {sorted.length > 0 ? (
        <ul className="space-y-2">
          {sorted.map((e) => (
            <li key={e.id} className="flex items-start gap-2">
              <p className="font-mono text-[11px] text-[#0F1419] shrink-0 min-w-[58px]">
                {new Date(e.at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
              </p>
              <div className="min-w-0">
                <p className="text-[12px] text-[#0F1419] leading-tight truncate">{e.label}</p>
                <p className="text-[10px] text-[#0F1419]/55">
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
        <p className="text-[11px] text-[#0F1419]/55">Aucune échéance.</p>
      )}
    </Card>
  )
}
