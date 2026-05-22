import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { HubVoiceNoteMini } from './types'

interface DataQualitySectionProps {
  voiceNotes: HubVoiceNoteMini[]
  roomsCount: number
  coherenceWarnings: ReadonlyArray<{ id: string; severity: 'info' | 'warn'; message: string }>
}

/**
 * Section 3 — Données structurées + score qualité.
 * Affiche extraits IA, score de couverture, alertes de cohérence.
 */
export function DataQualitySection({
  voiceNotes,
  roomsCount,
  coherenceWarnings,
}: DataQualitySectionProps) {
  const aiConfidences = voiceNotes
    .map((v) => v.ai_confidence)
    .filter((c): c is number => typeof c === 'number')
  const avgConfidence = aiConfidences.length
    ? aiConfidences.reduce((a, b) => a + b, 0) / aiConfidences.length
    : null

  // Score qualité = combinaison heuristique :
  //  - voice notes structurées (40 pts)
  //  - rooms définies (30 pts)
  //  - confidence IA moyenne ≥ 0.8 (30 pts)
  let score = 0
  if (voiceNotes.length > 0) score += Math.min(40, voiceNotes.length * 8)
  if (roomsCount > 0) score += Math.min(30, roomsCount * 6)
  if (avgConfidence && avgConfidence >= 0.8) score += 30
  else if (avgConfidence && avgConfidence >= 0.6) score += 15

  const scoreVariant: 'green' | 'yellow' | 'red' =
    score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red'

  return (
    <Card variant="flat" padding="default" id="data-quality" className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Données structurées & qualité</h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">Section 03</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-rule/60 bg-cream-deep/30 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
            Score qualité
          </p>
          <p className="mt-1 font-serif italic text-[36px] leading-none text-ink">{score}</p>
          <p className="mt-1 text-[11px] text-ink-mute">/ 100</p>
          <Badge variant={scoreVariant} className="mt-2">
            {score >= 80 ? 'Excellent' : score >= 50 ? 'À compléter' : 'Insuffisant'}
          </Badge>
        </div>

        <div className="rounded-md border border-rule/60 bg-cream-deep/30 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
            Confiance IA moyenne
          </p>
          <p className="mt-1 font-serif italic text-[36px] leading-none text-ink">
            {avgConfidence != null ? `${Math.round(avgConfidence * 100)}%` : '—'}
          </p>
          <p className="mt-1 text-[11px] text-ink-mute">
            {aiConfidences.length} note{aiConfidences.length > 1 ? 's' : ''} analysée
            {aiConfidences.length > 1 ? 's' : ''}
          </p>
        </div>

        <div className="rounded-md border border-rule/60 bg-cream-deep/30 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
            Couverture pièces
          </p>
          <p className="mt-1 font-serif italic text-[36px] leading-none text-ink">{roomsCount}</p>
          <p className="mt-1 text-[11px] text-ink-mute">
            pièce{roomsCount > 1 ? 's' : ''} renseignée{roomsCount > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {coherenceWarnings.length > 0 ? (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
            Cohérence ({coherenceWarnings.length})
          </p>
          <ul className="space-y-1.5">
            {coherenceWarnings.slice(0, 3).map((w) => (
              <li
                key={w.id}
                className="rounded-md border border-rule/50 bg-paper px-3 py-2 text-[13px] text-ink-soft"
              >
                <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.06em] text-warning">
                  {w.severity === 'warn' ? 'Alerte' : 'Info'}
                </span>
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  )
}
