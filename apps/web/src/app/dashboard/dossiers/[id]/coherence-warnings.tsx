import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CoherenceWarning } from '@/lib/coherence-validation'
import { cn } from '@/lib/utils'
import { AlertTriangle, Info } from 'lucide-react'

interface CoherenceWarningsProps {
  warnings: CoherenceWarning[]
}

const SEVERITY_STYLES: Record<CoherenceWarning['severity'], string> = {
  info: 'text-ink-mute',
  warning: 'text-accent-warm',
  error: 'text-accent-red',
}

export function CoherenceWarnings({ warnings }: CoherenceWarningsProps) {
  if (warnings.length === 0) return null

  return (
    <Card variant="warm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-ink">
          <AlertTriangle className="size-4 text-accent-warm" />
          Cohérence ({warnings.length} {warnings.length > 1 ? 'alertes' : 'alerte'})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {warnings.map((w) => (
            <li key={w.id} className="flex items-start gap-2 text-sm">
              {w.severity === 'info' ? (
                <Info className={cn('size-4 mt-0.5 shrink-0', SEVERITY_STYLES[w.severity])} />
              ) : (
                <AlertTriangle
                  className={cn('size-4 mt-0.5 shrink-0', SEVERITY_STYLES[w.severity])}
                />
              )}
              <span className={cn(SEVERITY_STYLES[w.severity])}>{w.message}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
