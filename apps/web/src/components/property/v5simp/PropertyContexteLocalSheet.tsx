'use client'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Compass } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useState } from 'react'

// Leaflet est purement client-side (touche window) → dynamic import avec ssr:false.
const PropertyInteractiveMap = dynamic(
  () => import('./PropertyInteractiveMap').then((m) => m.PropertyInteractiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-rule/40 bg-sage/50">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          Chargement de la carte…
        </p>
      </div>
    ),
  },
)

export interface PropertyContexteLocalData {
  /** Prix médian DVF €/m² sur la commune (Etalab/DGFiP) */
  dvfMedianEurM2: number | null
  /** Population INSEE de la commune (geo.api.gouv.fr) */
  inseePopulation: number | null
  /** Nombre de DPE déjà déposés sur la commune (ADEME data-fair) */
  ademeDpeCount: number | null
  /** Code INSEE commune (pour ouvrir liens externes) */
  inseeCode: string | null
  /** Code postal */
  postalCode: string | null
  /** Ville */
  city: string | null
}

interface Props {
  data: PropertyContexteLocalData
}

const intNumber = (v: number | null) =>
  v === null ? '—' : new Intl.NumberFormat('fr-FR').format(Math.round(v))
const eurM2 = (v: number | null) =>
  v === null ? '—' : `${new Intl.NumberFormat('fr-FR').format(Math.round(v))} €/m²`

/**
 * BottomSheet "Contexte local" — DVF + INSEE + ADEME (V1 mock data).
 */
export function PropertyContexteLocalSheet({ data }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Voir le contexte local"
      >
        <Compass className="size-4" strokeWidth={1.5} />
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] ml-1.5">
          Contexte local
        </span>
      </Button>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Contexte local"
        description={
          data.city
            ? `${data.postalCode ?? ''} ${data.city}`.trim()
            : 'Indicateurs marché et statistiques publiques'
        }
      >
        <ul className="divide-y divide-rule/40 px-2 pb-4">
          <Row
            label="Prix médian DVF (€/m²)"
            value={eurM2(data.dvfMedianEurM2)}
            source="DVF — Etalab/DGFiP"
          />
          <Row
            label="Population commune"
            value={intNumber(data.inseePopulation)}
            source="INSEE — geo.api.gouv.fr"
          />
          <Row
            label="DPE déposés (commune)"
            value={data.ademeDpeCount === null ? '—' : intNumber(data.ademeDpeCount)}
            source="ADEME — data-fair"
          />
          {data.inseeCode ? (
            <li className="flex items-center justify-between py-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
                Code INSEE
              </span>
              <span className="font-mono text-[12px] text-ink">{data.inseeCode}</span>
            </li>
          ) : null}
        </ul>
        <p className="px-2 pb-2 text-[11px] text-ink-mute">
          Données publiques temps réel : DVF (Demandes de Valeurs Foncières, Etalab/DGFiP), INSEE
          (geo.api.gouv.fr), ADEME (data-fair). Cache 24 h.
        </p>
      </BottomSheet>
    </>
  )
}

function Row({ label, value, source }: { label: string; value: string; source: string }) {
  return (
    <li className="flex items-center justify-between py-3">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">{label}</p>
        <p className="font-mono text-[10px] text-ink-faint">Source : {source}</p>
      </div>
      <span className="font-mono text-[14px] font-medium text-ink">{value}</span>
    </li>
  )
}

/**
 * BottomSheet "Localisation" — carte interactive Leaflet + OpenStreetMap.
 * Si les coordonnées GPS sont absentes (geocoding pas encore fait pour ce bien),
 * affiche un fallback explicatif.
 */
export function PropertyMapSheet({
  open,
  onOpenChange,
  address,
  subtitle,
  lat,
  lng,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  address: string
  subtitle?: string
  lat: number | null
  lng: number | null
}) {
  const hasCoords = lat !== null && lng !== null

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Localisation" description={address}>
      <div className="mx-2 mb-4">
        {hasCoords ? (
          <PropertyInteractiveMap
            lat={lat}
            lng={lng}
            address={address}
            subtitle={subtitle}
            zoom={17}
            height={320}
          />
        ) : (
          <div className="flex h-[280px] flex-col items-center justify-center gap-3 rounded-lg border border-rule/40 bg-sage/50 px-6 text-center">
            <p className="text-[12px] text-ink-mute">
              Coordonnées GPS non disponibles pour ce bien.
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
              Géocodage BAN automatique au prochain enregistrement de l'adresse
            </p>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
