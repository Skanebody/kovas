import { Card } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'
import { Award, Target, TrendingUp } from 'lucide-react'

export interface Highlight {
  /** Phrase sobre, max 2 lignes, format "Vous avez fait X% de plus que…" */
  message: string
  /** Type pour la couleur d'icon (sans accent agressif). */
  tone: 'positive' | 'neutral' | 'milestone'
}

interface HighlightsCardProps {
  highlights: Highlight[]
}

const TONE_ICON: Record<Highlight['tone'], LucideIcon> = {
  positive: TrendingUp,
  neutral: Target,
  milestone: Award,
}

const TONE_COLOR: Record<Highlight['tone'], string> = {
  positive: 'text-accent-green',
  neutral: 'text-ink',
  milestone: 'text-chartreuse-deep',
}

/**
 * Card "Faits marquants" — pattern Apple Santé Résumé bottom.
 *
 * 2-3 bullets générés depuis les data (logique simple côté page : delta % > 15%
 * ou seuil franchi → highlight). Ton sobre PROFESSIONNEL — pas de gaming.
 *
 * Format strict : "Vous avez réalisé 23% plus de DPE ce mois qu'au mois
 * précédent." (vouvoiement, chiffre précis, contexte explicite).
 *
 * Si aucun highlight, affiche un état vide neutre.
 */
export function HighlightsCard({ highlights }: HighlightsCardProps) {
  return (
    <Card variant="opaque" padding="none" className="rounded-[24px] overflow-hidden">
      <div className="border-b border-rule/60 px-6 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute">
          Faits marquants · ce mois
        </p>
      </div>

      {highlights.length === 0 ? (
        <p className="font-mono text-[11px] text-ink-mute px-6 py-6">
          Pas de fait marquant à signaler — l'activité est stable par rapport au
          mois précédent.
        </p>
      ) : (
        <ul className="divide-y divide-rule/60">
          {highlights.map((h, i) => {
            const Icon = TONE_ICON[h.tone]
            return (
              <li key={i} className="flex items-start gap-3 px-6 py-4">
                <Icon
                  className={`size-4 mt-0.5 shrink-0 ${TONE_COLOR[h.tone]}`}
                  strokeWidth={2}
                  aria-hidden
                />
                <p className="text-[14px] leading-relaxed text-ink">{h.message}</p>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
