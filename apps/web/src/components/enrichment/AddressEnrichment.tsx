'use client'

/**
 * KOVAS — <AddressEnrichment>
 *
 * Panneau d'enrichissement open data (BAN + DPE historiques + BDNB + cadastre +
 * Géorisques) affiché sur la fiche dossier / mission.
 *
 * Stratégie data fetching :
 *   - Au mount → POST `/api/open-data-enrichment` (Edge Function existante)
 *     qui hydrate la table `address_enrichments` et renvoie l'agrégat.
 *   - Réactif : sections collapsibles (état local + persistance localStorage)
 *
 * Authority : CLAUDE.md §3 feature 3 (auto-complétion adresse + cadastre).
 */

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useExpandState } from '@/lib/hooks/use-expand-state'
import { cn } from '@/lib/utils'
import { AlertTriangle, ChevronDown, Construction, Home, MapPin, Ruler } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'

export interface BanInfo {
  postalCode: string
  inseeCode: string
  lat: number
  lon: number
  city: string
}
export interface HistoricalDpe {
  numDpe: string
  etiquette: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  date: string
}
export interface BdnbInfo {
  yearBuilt: number | null
  surface: number | null
  buildingType: string | null
  walls: string | null
  roof: string | null
}
export interface CadastreInfo {
  parcel: string
  surface: number | null
}
export interface RisksInfo {
  seismic: string | null
  clay: string | null
  radon: string | null
  flood: string | null
  erp: string | null
}

export interface AddressEnrichmentData {
  ban: BanInfo | null
  historicalDpe: HistoricalDpe[]
  bdnb: BdnbInfo | null
  cadastre: CadastreInfo | null
  risks: RisksInfo | null
  fetchedAt: string
}

export interface AddressEnrichmentProps {
  missionId: string
  address: string
  /** Permet d'injecter des données déjà chargées côté serveur (SSR-friendly). */
  initialData?: AddressEnrichmentData | null
  className?: string
}

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: AddressEnrichmentData }

const DPE_VARIANT: Record<HistoricalDpe['etiquette'], 'green' | 'yellow' | 'orange' | 'red'> = {
  A: 'green',
  B: 'green',
  C: 'green',
  D: 'yellow',
  E: 'orange',
  F: 'red',
  G: 'red',
}

export function AddressEnrichment({
  missionId,
  address,
  initialData,
  className,
}: AddressEnrichmentProps) {
  const [state, setState] = useState<FetchState>(
    initialData ? { status: 'ready', data: initialData } : { status: 'loading' },
  )

  useEffect(() => {
    if (initialData) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/open-data-enrichment', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ missionId, address }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as AddressEnrichmentData
        if (!cancelled) setState({ status: 'ready', data })
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'erreur inconnue',
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [missionId, address, initialData])

  if (state.status === 'loading') {
    return (
      <div className={cn('space-y-3', className)}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i} variant="opaque" padding="sm">
            <Skeleton className="h-4 w-1/3 mb-2" />
            <Skeleton className="h-3 w-2/3" />
          </Card>
        ))}
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <Card variant="opaque" padding="sm" className={className}>
        <p className="text-[13px] text-ink-mute">
          Enrichissement open data indisponible — {state.message}
        </p>
      </Card>
    )
  }

  const { data } = state

  return (
    <div className={cn('space-y-3', className)}>
      <Section
        storageKey={`enrich:${missionId}:ban`}
        icon={MapPin}
        title="Infos BAN"
        meta={data.ban?.city ?? null}
        defaultExpanded
      >
        {data.ban ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
            <Row label="Code postal" value={data.ban.postalCode} />
            <Row label="Code INSEE" value={data.ban.inseeCode} />
            <Row label="Latitude" value={data.ban.lat.toFixed(5)} />
            <Row label="Longitude" value={data.ban.lon.toFixed(5)} />
          </dl>
        ) : (
          <Empty label="Pas d'info BAN trouvée pour cette adresse." />
        )}
      </Section>

      <Section
        storageKey={`enrich:${missionId}:dpe`}
        icon={Home}
        title="DPE historiques"
        meta={data.historicalDpe.length > 0 ? `${data.historicalDpe.length} trouvé(s)` : null}
      >
        {data.historicalDpe.length > 0 ? (
          <ul className="divide-y divide-rule/60">
            {data.historicalDpe.slice(0, 8).map((dpe) => (
              <li
                key={dpe.numDpe}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-1.5 text-[12px]"
              >
                <Badge variant={DPE_VARIANT[dpe.etiquette]}>Étiquette {dpe.etiquette}</Badge>
                <span className="font-mono text-ink-mute">{dpe.numDpe}</span>
                <span className="text-ink-soft">{dpe.date}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty label="Aucun DPE antérieur à l'adresse." />
        )}
      </Section>

      <Section
        storageKey={`enrich:${missionId}:bdnb`}
        icon={Construction}
        title="BDNB"
        meta={data.bdnb?.yearBuilt ? `${data.bdnb.yearBuilt}` : null}
      >
        {data.bdnb ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
            <Row label="Année" value={data.bdnb.yearBuilt?.toString() ?? '—'} />
            <Row label="Surface" value={data.bdnb.surface ? `${data.bdnb.surface} m²` : '—'} />
            <Row label="Type" value={data.bdnb.buildingType ?? '—'} />
            <Row label="Murs" value={data.bdnb.walls ?? '—'} />
            <Row label="Toiture" value={data.bdnb.roof ?? '—'} />
          </dl>
        ) : (
          <Empty label="Aucune fiche BDNB rattachée." />
        )}
      </Section>

      <Section
        storageKey={`enrich:${missionId}:cadastre`}
        icon={Ruler}
        title="Cadastre"
        meta={data.cadastre?.parcel ?? null}
      >
        {data.cadastre ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
            <Row label="Parcelle" value={data.cadastre.parcel} />
            <Row
              label="Surface parcelle"
              value={data.cadastre.surface ? `${data.cadastre.surface} m²` : '—'}
            />
          </dl>
        ) : (
          <Empty label="Parcelle non identifiée." />
        )}
      </Section>

      <Section
        storageKey={`enrich:${missionId}:risks`}
        icon={AlertTriangle}
        title="Risques Géorisques"
        meta={data.risks ? null : 'non chargés'}
      >
        {data.risks ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
            <Row label="Sismicité" value={data.risks.seismic ?? '—'} />
            <Row label="Argile" value={data.risks.clay ?? '—'} />
            <Row label="Radon" value={data.risks.radon ?? '—'} />
            <Row label="Inondation" value={data.risks.flood ?? '—'} />
            <Row label="ERP" value={data.risks.erp ?? '—'} />
          </dl>
        ) : (
          <Empty label="Pas de fiche Géorisques disponible." />
        )}
      </Section>
    </div>
  )
}

function Section({
  storageKey,
  icon: Icon,
  title,
  meta,
  children,
  defaultExpanded = false,
}: {
  storageKey: string
  icon: LucideIcon
  title: string
  meta: ReactNode
  children: ReactNode
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useExpandState(storageKey, defaultExpanded)
  return (
    <Card variant="opaque" padding="none" className="rounded-[24px]">
      <CardHeader className="p-4">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="flex w-full items-center gap-3 text-left"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-cream-deep">
            <Icon className="size-4 text-ink-mute" />
          </span>
          <CardTitle className="flex-1 font-serif italic font-normal text-[18px] text-ink">
            {title}
          </CardTitle>
          {meta ? <span className="text-[11px] text-ink-mute font-mono">{meta}</span> : null}
          <ChevronDown
            className={cn('size-4 text-ink-mute transition-transform', expanded && 'rotate-180')}
          />
        </button>
      </CardHeader>
      {expanded ? <CardContent className="px-4 pb-4 pt-0">{children}</CardContent> : null}
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-ink-mute">{label}</dt>
      <dd className="font-medium text-ink truncate">{value}</dd>
    </>
  )
}

function Empty({ label }: { label: string }) {
  return <p className="text-[12px] text-ink-mute">{label}</p>
}
