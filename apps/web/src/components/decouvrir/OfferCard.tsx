'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { trackCtaClicked } from '@/lib/decouvrir/analytics'
import { useIntentTracker } from '@/lib/decouvrir/intent-tracker'
import type { OfferDescriptor } from '@/lib/decouvrir/recommendations'
import { Check } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useCallback } from 'react'

interface OfferCardProps {
  offer: OfferDescriptor
  /** Affiche le badge "Recommandé pour vous" si true */
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
 */
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
        current && 'border-rule/40 opacity-90',
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
          className="absolute -top-3 left-4 bg-chartreuse text-ink shadow-sm"
        >
          Recommandé pour vous
        </Badge>
      )}
      {current && (
        <Badge variant="green" className="absolute -top-3 right-4 shadow-sm">
          Plan actuel
        </Badge>
      )}

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h3 className="font-display font-semibold text-[17px] leading-tight tracking-tight text-ink">
            {offer.label}
          </h3>
          {offer.bundleSavingLabel && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-accent-green font-semibold">
              {offer.bundleSavingLabel}
            </span>
          )}
        </div>
        <p className="text-xs text-ink-mute">{offer.tagline}</p>
      </div>

      <div className="text-2xl font-extrabold tracking-tight text-ink">
        {offer.priceLabel}
      </div>

      <ul className="space-y-1.5 text-xs flex-1">
        {offer.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="size-3.5 mt-0.5 shrink-0 text-accent-green" />
            <span className="text-ink-soft">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 pt-2">
        {current ? (
          <Button
            variant="outline"
            size="sm"
            disabled
            className="w-full"
            aria-disabled="true"
          >
            Plan actuel
          </Button>
        ) : ctaHref ? (
          <Button
            asChild
            variant={recommended ? 'accent' : 'default'}
            size="sm"
            className="w-full"
          >
            <Link href={ctaHref} onClick={onPrimaryCtaClick}>
              {offer.priceMonthlyCents === 0 ? 'Activer gratuitement' : 'Choisir cette offre'}
            </Link>
          </Button>
        ) : (
          <Button
            variant={recommended ? 'accent' : 'default'}
            size="sm"
            onClick={onPrimaryCtaClick}
            className="w-full"
          >
            {offer.priceMonthlyCents === 0 ? 'Activer gratuitement' : 'Choisir cette offre'}
          </Button>
        )}
        <button
          type="button"
          onClick={onSecondaryCtaClick}
          className="text-[11px] text-ink-mute hover:text-ink underline-offset-2 hover:underline transition-colors"
        >
          {secondaryCtaLabel}
        </button>
      </div>
    </Card>
  )
}
