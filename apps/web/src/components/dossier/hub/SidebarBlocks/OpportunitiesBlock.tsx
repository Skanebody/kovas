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
        <Sparkles className="size-3.5 text-[#0F1419]/72" />
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/72">
          Opportunités
        </p>
      </div>

      <ul className="space-y-2">
        {limited.map((o) => (
          <li
            key={o.id}
            className="rounded-md border border-[#0F1419]/[0.08] bg-paper px-2.5 py-2 text-[12px]"
          >
            <p className="text-[#0F1419] leading-tight">{o.label}</p>
            {o.description ? (
              <p className="text-[#0F1419]/55 text-[11px] mt-0.5">{o.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  )
}
