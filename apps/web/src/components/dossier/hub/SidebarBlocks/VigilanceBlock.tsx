import { Card } from '@/components/ui/card'
import { ShieldAlert } from 'lucide-react'

export interface VigilanceSignal {
  id: string
  message: string
  hint: string | null
}

interface VigilanceBlockProps {
  signals: ReadonlyArray<VigilanceSignal>
}

/**
 * Bloc sidebar — Signaux de vigilance (max 2).
 * Ton aidant — JAMAIS accusatoire. Suggestion d'attention, pas verdict.
 */
export function VigilanceBlock({ signals }: VigilanceBlockProps) {
  const limited = signals.slice(0, 2)
  if (limited.length === 0) return null

  return (
    <Card variant="flat" padding="sm" className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-3.5 text-[#0F1419]/72" />
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/72">
          Points d&apos;attention
        </p>
      </div>

      <ul className="space-y-2">
        {limited.map((s) => (
          <li key={s.id} className="rounded-md border border-[#0F1419]/[0.08] bg-paper px-2.5 py-2">
            <p className="text-[12px] text-[#0F1419] leading-tight">{s.message}</p>
            {s.hint ? <p className="text-[11px] text-[#0F1419]/55 mt-0.5">{s.hint}</p> : null}
          </li>
        ))}
      </ul>
    </Card>
  )
}
