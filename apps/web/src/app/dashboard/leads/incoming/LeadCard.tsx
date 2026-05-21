'use client'

/**
 * LeadCard — carte d'un lead assignment dans la vue diagnostiqueur.
 *
 * Layout :
 *   Header : nom anonymise (Mme P***) + distance/ville + timer expires_in
 *   Body   : ville, certif, surface, urgency
 *   Footer : Accepter (chartreuse) / Refuser (outline) si status==='pending'
 *            sinon affichage coordonnees (debloque) ou status
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Building2, Clock, Mail, MapPin, Phone } from 'lucide-react'
import type { IncomingLeadAssignment } from './IncomingLeadsList'

interface LeadCardProps {
  assignment: IncomingLeadAssignment
  disabled: boolean
  onAccept: () => void
  onDecline: (reason?: string) => void
}

export function LeadCard({ assignment, disabled, onAccept, onDecline }: LeadCardProps) {
  const isPending = assignment.status === 'pending'
  const isAccepted = assignment.status === 'accepted'

  const displayName = formatRequesterName(
    assignment.requesterFirstName,
    assignment.requesterLastNameMasked,
  )
  const expiresIn = formatExpiresIn(assignment.expiresAt)

  return (
    <Card variant="flat" padding="default">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-ink">{displayName}</h3>
            {assignment.assignmentType === 'onboarding_gift' ? (
              <Badge variant="blue">Cadeau onboarding</Badge>
            ) : null}
            {assignment.urgency === 'high' ? <Badge variant="red">Urgent</Badge> : null}
          </div>
          <p className="text-sm text-ink-mute flex items-center gap-1 mt-1">
            <MapPin className="size-3.5" aria-hidden />
            {assignment.city ?? '—'}
            {assignment.postalCode ? ` (${assignment.postalCode})` : ''}
          </p>
        </div>
        {isPending && expiresIn ? (
          <p className="text-xs font-mono text-ink-mute flex items-center gap-1 shrink-0">
            <Clock className="size-3.5" aria-hidden />
            {expiresIn}
          </p>
        ) : null}
      </div>

      {/* Body — meta bien + diagnostics */}
      <div className="mt-3 space-y-2">
        <p className="text-sm text-ink-mute flex items-center gap-1">
          <Building2 className="size-3.5" aria-hidden />
          {labelForPropertyType(assignment.propertyType)}
          {assignment.surfaceM2 ? ` · ${assignment.surfaceM2} m²` : ''}
        </p>
        {assignment.diagnosticsRequested.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {assignment.diagnosticsRequested.map((d) => (
              <span
                key={d}
                className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-pill bg-cream-deep text-ink-mute font-mono"
              >
                {d}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-rule/60">
        {isPending ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="accent" size="sm" onClick={onAccept} disabled={disabled} type="button">
              {disabled ? 'En cours…' : 'Accepter'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDecline()}
              disabled={disabled}
              type="button"
            >
              Refuser
            </Button>
          </div>
        ) : isAccepted ? (
          <UnlockedContact assignment={assignment} />
        ) : (
          <p className="text-xs text-ink-mute">
            {assignment.status === 'declined' ? 'Refuse' : 'Expire'}
            {assignment.respondedAt
              ? ` le ${new Date(assignment.respondedAt).toLocaleDateString('fr-FR')}`
              : ''}
          </p>
        )}
      </div>
    </Card>
  )
}

function UnlockedContact({ assignment }: { assignment: IncomingLeadAssignment }) {
  return (
    <div className="rounded-lg bg-lime-mist/30 border border-lime-mist p-3 space-y-1.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#2D4015]">
        Coordonnees
      </p>
      {assignment.requesterPhone ? (
        <a
          href={`tel:${assignment.requesterPhone}`}
          className="flex items-center gap-2 text-sm text-ink hover:underline"
        >
          <Phone className="size-3.5" aria-hidden />
          {assignment.requesterPhone}
        </a>
      ) : null}
      {assignment.requesterEmail ? (
        <a
          href={`mailto:${assignment.requesterEmail}`}
          className="flex items-center gap-2 text-sm text-ink hover:underline"
        >
          <Mail className="size-3.5" aria-hidden />
          {assignment.requesterEmail}
        </a>
      ) : null}
      {assignment.propertyAddress ? (
        <p className="flex items-center gap-2 text-sm text-ink-mute">
          <MapPin className="size-3.5" aria-hidden />
          {assignment.propertyAddress}
        </p>
      ) : null}
      {assignment.message ? (
        <p className="text-sm text-ink leading-relaxed mt-2 pt-2 border-t border-lime-mist/60">
          {assignment.message}
        </p>
      ) : null}
    </div>
  )
}

function formatRequesterName(first: string | null, lastMasked: string | null): string {
  const f = (first ?? '').trim()
  const l = (lastMasked ?? '').trim()
  if (!f && !l) return 'Prospect anonyme'
  return `${f} ${l}`.trim()
}

function formatExpiresIn(iso: string | null): string | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (!Number.isFinite(ms)) return null
  if (ms <= 0) return 'Expire'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  if (hours < 1) return 'Moins d 1 h'
  if (hours < 24) return `${hours} h restantes`
  const days = Math.floor(hours / 24)
  return `${days} j restants`
}

function labelForPropertyType(t: string | null): string {
  if (!t) return '—'
  switch (t) {
    case 'appartement':
      return 'Appartement'
    case 'maison':
      return 'Maison'
    case 'local_commercial':
      return 'Local commercial'
    default:
      return t
  }
}
