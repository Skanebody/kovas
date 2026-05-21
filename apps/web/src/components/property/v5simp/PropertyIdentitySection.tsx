'use client'

import { PropertyMapSheet } from '@/components/property/v5simp/PropertyContexteLocalSheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  maison: 'Maison',
  appartement: 'Appartement',
  immeuble: 'Immeuble',
  local_commercial: 'Local commercial',
  bureau: 'Bureau',
  autre: 'Autre',
}

interface Props {
  property: {
    id: string
    address: string
    city: string | null
    postal_code: string | null
    property_type: string | null
    year_built: number | null
    apartmentLine: string | null
  }
}

/**
 * Section 1 — Identité du bien (page property SIMP-2).
 *
 *  - Adresse hero <h1> (rue + ligne ville séparée)
 *  - Badges type + année + ligne apt
 *  - Action primaire pleine largeur "Nouveau dossier sur ce bien" (chartreuse)
 *  - Lien secondaire ghost "Voir sur la carte" → BottomSheet
 */
export function PropertyIdentitySection({ property }: Props) {
  const [mapOpen, setMapOpen] = useState(false)

  const cityLine = [property.postal_code, property.city].filter(Boolean).join(' ')
  const typeLabel = property.property_type
    ? (PROPERTY_TYPE_LABELS[property.property_type] ?? property.property_type)
    : null

  return (
    <section aria-labelledby="property-identity-title" className="space-y-4">
      <div className="space-y-2">
        <h1
          id="property-identity-title"
          className="font-sans text-[28px] font-medium leading-tight text-ink"
        >
          {property.address}
          {cityLine ? (
            <>
              <br />
              <span className="text-[18px] text-ink-mute font-normal">{cityLine}</span>
            </>
          ) : null}
        </h1>

        {property.apartmentLine ? (
          <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-foreground/55">
            {property.apartmentLine}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {typeLabel ? <Badge variant="muted">{typeLabel}</Badge> : null}
          {property.year_built ? <Badge variant="outline">{property.year_built}</Badge> : null}
        </div>
      </div>

      <Button asChild variant="accent" size="lg" className="w-full">
        <Link href={`/dashboard/dossiers/new?propertyId=${property.id}`}>
          <Plus className="size-4" />
          Nouveau dossier sur ce bien
        </Link>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setMapOpen(true)}
        aria-label="Voir sur la carte"
      >
        <MapPin className="size-4" strokeWidth={1.5} />
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] ml-1.5">
          Voir sur la carte
        </span>
      </Button>

      <PropertyMapSheet
        open={mapOpen}
        onOpenChange={setMapOpen}
        address={[property.address, cityLine].filter(Boolean).join(', ')}
      />
    </section>
  )
}
