'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { trackCtaClicked } from '@/lib/decouvrir/analytics'
import { useIntentTracker } from '@/lib/decouvrir/intent-tracker'
import type { OfferDescriptor } from '@/lib/decouvrir/recommendations'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useCallback } from 'react'

interface OfferCardProps {
  offer: OfferDescriptor
  /** Affiche le badge "Recommandé pour toi" si true */
  recommended?: boolean
  /** Affiche le badge "Plan actuel" si true */
  current?: boolean
  /** CTA secondaire (texte). Cliquer dessus déclenche un signal fort. */
  secondaryCtaLabel?: string
  /** Lien pour le CTA principal (Stripe / checkout / signup) */
  ctaHref?: Route
  /** Position (utilisée pour analytics) */
  position: string
  className?: string
}

/**
 * OfferCard — carte d'offre standardisée pour la page Découvrir.
 *
 * Connectée au store intent-tracker pour :
 *  - tracker le hover >500ms (signal qualifié)
 *  - tracker les clics CTA secondaires (signal fort)
 *  - tracker l'ajout en comparaison
 *
 * Copy CTA (Tugan §6 + Hormozi §14) : action-oriented + value-loaded.
 *   - Essai gratuit       → "Démarrer 30 jours gratuits"
 *   - Annuaire gratuit    → "Activer la fiche gratuite"
 *   - Bundle              → "Activer ce bundle"
 *   - Plan logiciel/payant → "Passer au plan {label}"
 */
function primaryCtaLabel(offer: OfferDescriptor): string {
  if (offer.priceMonthlyCents === 0) {
    if (offer.code === 'logiciel_essai') return 'Démarrer 30 jours gratuits'
    if (offer.family === 'annuaire') return 'Activer la fiche gratuite'
    return 'Activer gratuitement'
  }
  if (offer.family === 'bundle') return 'Activer ce bundle'
  if (offer.family === 'addon') return 'Ajouter cet add-on'
  if (offer.family === 'sponsorise') return 'Sponsoriser cette commune'
  return `Passer au plan ${offer.label}`
}

export function OfferCard({
  offer,
  recommended = false,
  current = false,
  secondaryCtaLabel = 'En savoir plus',
  ctaHref,
  position,
  className,
}: OfferCardProps) {
  const startHover = useIntentTracker((s) => s.startHover)
  const endHover = useIntentTracker((s) => s.endHover)
  const recordCtaClick = useIntentTracker((s) => s.recordCtaClick)
  const recordComparison = useIntentTracker((s) => s.recordComparison)

  const onMouseEnter = useCallback(() => startHover(offer.code), [startHover, offer.code])
  const onMouseLeave = useCallback(() => endHover(offer.code), [endHover, offer.code])
  const onFocus = useCallback(() => startHover(offer.code), [startHover, offer.code])
  const onBlur = useCallback(() => endHover(offer.code), [endHover, offer.code])

  const onPrimaryCtaClick = useCallback(() => {
    recordCtaClick(offer.code)
    trackCtaClicked(offer.code, position)
  }, [recordCtaClick, offer.code, position])

  const onSecondaryCtaClick = useCallback(() => {
    recordCtaClick(offer.code)
    recordComparison(offer.code)
    trackCtaClicked(offer.code, `${position}_secondary`)
  }, [recordCtaClick, recordComparison, offer.code, position])

  return (
    <Card
      variant="flat"
      padding="default"
      className={cn(
        'relative flex flex-col gap-4 transition-all duration-base ease-spring',
        recommended && 'ring-2 ring-chartreuse/70 shadow-md -translate-y-0.5',
        current && 'border-[#0F1419]/[0.06] opacity-90',
        className,
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      data-offer-code={offer.code}
    >
      {recommended && (
        <Badge
          variant="default"
          className="absolute -top-3 left-4 bg-chartreuse text-[#0F1419] shadow-sm"
        >
          Recommandé pour toi
        </Badge>
      )}
      {current && (
        <Badge variant="green" className="absolute -top-3 right-4 shadow-sm">
          Plan actuel
        </Badge>
      )}

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h3 className="font-sans font-semibold tracking-tight text-[17px] leading-tight tracking-tight text-[#0F1419]">
            {offer.label}
          </h3>
          {offer.bundleSavingLabel && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-accent-green font-semibold">
              {offer.bundleSavingLabel}
            </span>
          )}
        </div>
        <p className="text-xs text-[#0F1419]/72">{offer.tagline}</p>
      </div>

      <div className="text-2xl font-extrabold tracking-tight text-[#0F1419]">
        {offer.priceLabel}
      </div>

      <ul className="space-y-1.5 text-xs flex-1">
        {offer.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="size-3.5 mt-0.5 shrink-0 text-accent-green" />
            <span className="text-[#0F1419]/82">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 pt-2">
        {current ? (
          <Button variant="outline" size="sm" disabled className="w-full" aria-disabled="true">
            Plan actuel
          </Button>
        ) : ctaHref ? (
          <Button asChild variant={recommended ? 'accent' : 'default'} size="sm" className="w-full">
            <Link href={ctaHref} onClick={onPrimaryCtaClick}>
              {primaryCtaLabel(offer)}
            </Link>
          </Button>
        ) : (
          <Button
            variant={recommended ? 'accent' : 'default'}
            size="sm"
            onClick={onPrimaryCtaClick}
            className="w-full"
          >
            {primaryCtaLabel(offer)}
          </Button>
        )}
        <button
          type="button"
          onClick={onSecondaryCtaClick}
          className="text-[11px] text-[#0F1419]/72 hover:text-[#0F1419] underline-offset-2 hover:underline transition-colors"
        >
          {secondaryCtaLabel}
        </button>
      </div>
    </Card>
  )
}
