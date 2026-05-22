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
        <ShieldAlert className="size-3.5 text-ink-mute" />
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
          Points d&apos;attention
        </p>
      </div>

      <ul className="space-y-2">
        {limited.map((s) => (
          <li key={s.id} className="rounded-md border border-rule/50 bg-paper px-2.5 py-2">
            <p className="text-[12px] text-ink leading-tight">{s.message}</p>
            {s.hint ? <p className="text-[11px] text-ink-faint mt-0.5">{s.hint}</p> : null}
          </li>
        ))}
      </ul>
    </Card>
  )
}
