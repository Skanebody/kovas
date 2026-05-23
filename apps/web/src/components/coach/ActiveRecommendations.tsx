/**
 * KOVAS — Liste des recommandations IA actives (Coach).
 *
 * Server component pur — lit la table coach_recommendations
 * filtrée à status='active' et ordonnée par priorité.
 *
 * Affichage : card sobre, titre + résumé + lien d'action optionnel.
 */

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'

export interface CoachRecommendation {
  id: string
  title: string
  summary: string | null
  action_url: string | null
  priority: number
  created_at: string
}

interface ActiveRecommendationsProps {
  recommendations: readonly CoachRecommendation[]
}

export function ActiveRecommendations({ recommendations }: ActiveRecommendationsProps) {
  return (
    <Card variant="flat" padding="sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold text-ink">Recommandations actives</h3>
        <Badge variant="muted" className="uppercase tracking-wider text-[9px]">
          {recommendations.length}
        </Badge>
      </div>

      {recommendations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Sparkles className="size-5 text-ink-faint" aria-hidden />
          <p className="text-[12px] text-ink-mute leading-relaxed">
            Aucune recommandation active.
            <br />
            Échangez avec le Coach pour en générer.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {recommendations.map((reco) => (
            <li
              key={reco.id}
              className="rounded-md border border-rule/60 bg-paper/85 p-3 hover:border-navy/30 transition-colors"
            >
              <p className="text-[13px] font-semibold text-ink leading-tight mb-1">{reco.title}</p>
              {reco.summary ? (
                <p className="text-[12px] text-ink-mute leading-relaxed">{reco.summary}</p>
              ) : null}
              {reco.action_url ? (
                <Link
                  href={reco.action_url}
                  className="inline-flex items-center gap-1 mt-2 text-[12px] font-medium text-navy hover:underline"
                >
                  Voir l'action
                  <ArrowRight className="size-3" />
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
