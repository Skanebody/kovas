'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { TrackSummary, UserAccess } from '@/lib/decouvrir/recommendations'
import { Check, Compass } from 'lucide-react'

interface CurrentSituationCardProps {
  access: UserAccess
  summary: TrackSummary
}

/**
 * Section 1 — résume la situation actuelle de l'utilisateur :
 *  - quel logiciel est actif
 *  - quelle fiche annuaire est active
 *  - badge récapitulatif du track
 *
 * Card variant "flat" + accent éditorial Instrument Serif.
 */
export function CurrentSituationCard({ access, summary }: CurrentSituationCardProps) {
  return (
    <Card variant="flat" padding="default" className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[#0F1419]/72 font-mono text-[11px] uppercase tracking-[0.1em]">
          <Compass className="size-3.5" />
          Ta situation actuelle
        </div>
        <Badge variant="muted">{summary.badgeLabel}</Badge>
      </div>

      <div className="space-y-2">
        <h2 className="font-sans font-light text-2xl tracking-tight leading-tight text-[#0F1419]">
          {summary.title}
        </h2>
        <p className="text-sm text-[#0F1419]/72 max-w-2xl">{summary.description}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <SituationLine
          label="KOVAS (logiciel)"
          activeLabel={access.logicielTier ? `Tier ${access.logicielTier}` : 'Actif'}
          active={access.hasLogiciel}
          inactiveLabel="Aucun abonnement"
        />
        <SituationLine
          label="KOVAS Annuaire"
          activeLabel={access.annuaireTier ? `Plan ${access.annuaireTier}` : 'Actif'}
          active={access.hasAnnuaire}
          inactiveLabel="Non référencé payant"
        />
      </div>
    </Card>
  )
}

function SituationLine({
  label,
  activeLabel,
  active,
  inactiveLabel,
}: {
  label: string
  activeLabel: string
  active: boolean
  inactiveLabel: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#0F1419]/[0.08] bg-paper px-4 py-3">
      <div className="min-w-0">
        <div className="text-xs text-[#0F1419]/72 uppercase tracking-wider font-semibold">
          {label}
        </div>
        <div className="text-sm font-medium text-[#0F1419] truncate">
          {active ? activeLabel : inactiveLabel}
        </div>
      </div>
      {active ? (
        <Check className="size-4 text-accent-green shrink-0" aria-hidden />
      ) : (
        <span className="size-2 rounded-full bg-[#0F1419]/40 shrink-0" aria-hidden />
      )}
    </div>
  )
}
