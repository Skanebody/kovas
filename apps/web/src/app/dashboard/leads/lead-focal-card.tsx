'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DiagChip } from '@/components/ui/diag-chip'
import { cn } from '@/lib/utils'
import { Clock, FileText, MapPin, PhoneCall } from 'lucide-react'
import type { LeadItem } from './leads-types'

interface LeadFocalCardProps {
  lead: LeadItem
  onCall: () => void
  onSendQuote: () => void
  onDeferLater: () => void
}

/**
 * Card lead unique en plein écran — focal mode 1 lead à la fois.
 * Mise en avant : adresse mono large, client, téléphone mono, action principale "Appeler".
 *
 * Layout :
 *   - Adresse en gros (font-mono 22-28px)
 *   - Bien (type + surface + année)
 *   - Diagnostics demandés (chips)
 *   - Urgence si présente
 *   - Client + téléphone mono
 *   - 3 actions empilées : APPELER (primary chartreuse) / Envoyer devis / Plus tard
 */
export function LeadFocalCard({ lead, onCall, onSendQuote, onDeferLater }: LeadFocalCardProps) {
  const propertyLine = formatProperty(lead)

  return (
    <Card variant="flat" padding="lg" className="space-y-6">
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute flex items-center gap-2">
          <MapPin className="size-3.5" aria-hidden />
          Adresse de l&apos;intervention
        </p>
        <p className="font-mono text-[20px] md:text-[26px] font-semibold text-ink leading-snug tracking-tight">
          {lead.propertyAddress}
        </p>
        {lead.propertyCity ? (
          <p className="font-mono text-[14px] text-ink-soft">
            {[lead.propertyPostalCode, lead.propertyCity].filter(Boolean).join(' ')}
          </p>
        ) : null}
      </div>

      {propertyLine ? (
        <p className="text-[14px] text-ink-soft border-l-2 border-rule pl-3">{propertyLine}</p>
      ) : null}

      {lead.missionTypes.length > 0 ? (
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute flex items-center gap-2">
            <FileText className="size-3.5" aria-hidden />
            Diagnostics demandés
          </p>
          <div className="flex flex-wrap gap-1.5">
            {lead.missionTypes.map((type, i) => (
              <DiagChip key={`${type}-${i}`} type={type} short={false} />
            ))}
          </div>
        </div>
      ) : null}

      {lead.urgency ? (
        <div className="flex items-center gap-2 rounded-md border border-rule bg-orange-mist/40 px-3 py-2">
          <Clock className="size-4 text-ink shrink-0" aria-hidden />
          <span className="text-[13px] font-medium text-ink">{lead.urgency}</span>
        </div>
      ) : null}

      <div className="space-y-2 pt-2 border-t border-rule/40">
        <p className="text-[15px] font-medium text-ink">{lead.clientDisplayName}</p>
        {lead.clientPhone ? (
          <p className="font-mono text-[18px] md:text-[22px] font-semibold text-ink tabular-nums">
            {lead.clientPhone}
          </p>
        ) : (
          <p className="text-[13px] text-ink-mute italic">Numéro non communiqué</p>
        )}
      </div>

      <div className="space-y-2 pt-2">
        <Button
          variant="accent"
          size="lg"
          className="w-full"
          onClick={onCall}
          disabled={!lead.clientPhone}
        >
          <PhoneCall className="size-4" aria-hidden />
          Appeler maintenant
        </Button>
        <div className={cn('grid grid-cols-2 gap-2')}>
          <Button variant="outline" size="default" onClick={onSendQuote}>
            Envoyer un devis
          </Button>
          <Button variant="ghost" size="default" onClick={onDeferLater}>
            Plus tard (24h)
          </Button>
        </div>
      </div>
    </Card>
  )
}

function formatProperty(lead: LeadItem): string {
  const parts: string[] = []
  if (lead.propertyType) parts.push(lead.propertyType)
  if (lead.propertySurface) parts.push(`${lead.propertySurface}m²`)
  if (lead.propertyYearBuilt) parts.push(`Construit en ${lead.propertyYearBuilt}`)
  return parts.join(' · ')
}
