'use client'

import { Button } from '@/components/ui/button'
import type { ClusteringOpportunity as ClusteringOpportunityType } from '@/lib/scheduling/clustering-suggester'
import { cn } from '@/lib/utils'
import { Layers, MapPin } from 'lucide-react'

interface ClusteringOpportunityProps {
  opportunity: ClusteringOpportunityType | null
  /** Quand l'user clique "Voir les RDV de ce jour". */
  onViewDay?: (date: Date) => void
  className?: string
}

/**
 * Carte de suggestion de clustering : invite à déplacer ce RDV vers un jour
 * où d'autres missions sont déjà groupées dans un rayon de 5 km.
 *
 * Affichée uniquement quand pas de conflit (sinon AlternativeSuggestions prend
 * la priorité). Fond chartreuse soft + border chartreuse (signature v5 pour
 * suggestion positive non-bloquante).
 */
export function ClusteringOpportunity({
  opportunity,
  onViewDay,
  className,
}: ClusteringOpportunityProps) {
  if (!opportunity) return null

  const date = opportunity.date instanceof Date ? opportunity.date : new Date(opportunity.date)

  return (
    <div
      className={cn(
        'rounded-lg border border-chartreuse/40 bg-chartreuse/10 p-4 space-y-2',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute">
        <Layers className="size-3.5" /> Optimisation possible
      </div>

      <p className="font-serif italic text-[18px] leading-snug text-ink">
        {opportunity.recommendation}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-mute font-mono tabular-nums">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3" />
          {opportunity.nearbyMissions.length} RDV à ≈ {formatKm(opportunity.averageDistanceKm)}
        </span>
        <span>Économie estimée ≈ {opportunity.potentialSavingsMin} min</span>
      </div>

      {onViewDay && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onViewDay(date)}
          className="text-[11px]"
        >
          Voir les RDV de ce jour
        </Button>
      )}
    </div>
  )
}

function formatKm(km: number): string {
  return `${km.toFixed(1).replace('.', ',')} km`
}
