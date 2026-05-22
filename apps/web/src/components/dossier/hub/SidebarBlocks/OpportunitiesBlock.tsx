import { Card } from '@/components/ui/card'
import { Sparkles } from 'lucide-react'

export interface Opportunity {
  id: string
  label: string
  description: string | null
}

interface OpportunitiesBlockProps {
  opportunities: ReadonlyArray<Opportunity>
}

/**
 * Bloc sidebar — Opportunités détectées (max 3).
 * Ex : "Le bien a un DPE F → opportunité audit énergétique 6 mois plus tard".
 */
export function OpportunitiesBlock({ opportunities }: OpportunitiesBlockProps) {
  const limited = opportunities.slice(0, 3)
  if (limited.length === 0) return null

  return (
    <Card variant="flat" padding="sm" className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 text-ink-mute" />
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
          Opportunités
        </p>
      </div>

      <ul className="space-y-2">
        {limited.map((o) => (
          <li
            key={o.id}
            className="rounded-md border border-rule/50 bg-paper px-2.5 py-2 text-[12px]"
          >
            <p className="text-ink leading-tight">{o.label}</p>
            {o.description ? <p className="text-ink-faint text-[11px] mt-0.5">{o.description}</p> : null}
          </li>
        ))}
      </ul>
    </Card>
  )
}
