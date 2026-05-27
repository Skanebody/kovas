'use client'

/**
 * KOVAS — Carte de France des DPE du cabinet.
 *
 * Choix d'implémentation V1 : SVG inline static (silhouette FR métropolitaine
 * simplifiée), markers projetés via une projection Mercator linéaire approchée.
 * Évite la dépendance `react-leaflet` (~250 kB) et reste 100% SSR-compatible.
 *
 * Pour V2, possible upgrade vers `react-leaflet` avec dynamic import si
 * besoin de cluster zoom interactif ou tuiles vectorielles IGN.
 */

import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface AdemeFranceMapPoint {
  id: string
  latitude: number
  longitude: number
  etiquette: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null
  commune: string | null
  date: string | null
}

export interface AdemeFranceMapProps {
  points: AdemeFranceMapPoint[]
  /** Hauteur visuelle (Tailwind value). */
  className?: string
}

// Bornes France métropolitaine (approx.)
const MIN_LAT = 41.3
const MAX_LAT = 51.1
const MIN_LON = -5.1
const MAX_LON = 9.6

// Couleurs étiquette DPE officielles (convention ADEME)
const LABEL_COLOR: Record<NonNullable<AdemeFranceMapPoint['etiquette']>, string> = {
  A: '#319B41',
  B: '#33A357',
  C: '#79BA52',
  D: '#FFCE34',
  E: '#F69D27',
  F: '#E94B1B',
  G: '#D90B0E',
}

export function AdemeFranceMap({ points, className }: AdemeFranceMapProps) {
  const [hoverId, setHoverId] = useState<string | null>(null)

  // Filtre points dans bornes + projection
  const projected = useMemo(() => {
    return points
      .filter(
        (p) =>
          typeof p.latitude === 'number' &&
          typeof p.longitude === 'number' &&
          p.latitude >= MIN_LAT &&
          p.latitude <= MAX_LAT &&
          p.longitude >= MIN_LON &&
          p.longitude <= MAX_LON,
      )
      .map((p) => ({
        ...p,
        // SVG viewBox 1000×900 : x = lon → 0..1000, y = lat → 900..0 (inversé)
        x: ((p.longitude - MIN_LON) / (MAX_LON - MIN_LON)) * 1000,
        y: 900 - ((p.latitude - MIN_LAT) / (MAX_LAT - MIN_LAT)) * 900,
      }))
  }, [points])

  const counts = useMemo(() => {
    const acc = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, unknown: 0 }
    for (const p of projected) {
      if (p.etiquette) acc[p.etiquette] += 1
      else acc.unknown += 1
    }
    return acc
  }, [projected])

  return (
    <Card variant="opaque" padding="default" className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-[15px] font-semibold text-ink">Répartition géographique</h3>
          <p className="text-[11px] text-ink-mute">
            {projected.length} DPE localisés sur la France métropolitaine
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const).map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-pill border border-rule bg-paper/80 px-2 py-0.5 text-[10px] font-mono text-ink-mute"
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: LABEL_COLOR[label] }}
              />
              {label} · {counts[label]}
            </span>
          ))}
        </div>
      </div>

      <div className="relative w-full">
        <svg
          viewBox="0 0 1000 900"
          className="w-full h-auto"
          role="img"
          aria-label="Carte des DPE en France métropolitaine"
        >
          {/* Silhouette FR simplifiée (Hexagone stylisé) */}
          <path
            d={FRANCE_OUTLINE_PATH}
            fill="rgba(212, 245, 66, 0.06)"
            stroke="rgba(15, 20, 25, 0.20)"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Markers */}
          {projected.map((p) => {
            const color = p.etiquette ? LABEL_COLOR[p.etiquette] : '#7E8AA4'
            const radius = hoverId === p.id ? 7 : 4
            return (
              <g
                key={p.id}
                onMouseEnter={() => setHoverId(p.id)}
                onMouseLeave={() => setHoverId(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={radius}
                  fill={color}
                  fillOpacity={0.8}
                  stroke="#FAFBFC"
                  strokeWidth="1.5"
                />
                {hoverId === p.id && p.commune ? (
                  <g>
                    <rect
                      x={p.x + 10}
                      y={p.y - 20}
                      width={Math.max(80, p.commune.length * 7)}
                      height={28}
                      rx={6}
                      fill="#0F1419"
                      fillOpacity={0.92}
                    />
                    <text
                      x={p.x + 16}
                      y={p.y - 2}
                      fontSize={11}
                      fontWeight={500}
                      fill="#FAFBFC"
                      fontFamily="ui-monospace, monospace"
                    >
                      {p.commune} · {p.etiquette ?? '—'}
                    </text>
                  </g>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>

      {projected.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Badge variant="muted">Aucun DPE géolocalisé dans le cache</Badge>
        </div>
      ) : null}
    </Card>
  )
}

/**
 * Silhouette stylisée de la France métropolitaine (hexagone géographique).
 * Pas une vraie carte topographique — V2 utilisera GeoJSON IGN.
 * Coordonnées dans le viewBox 1000×900.
 */
const FRANCE_OUTLINE_PATH =
  'M 320 50 L 580 70 L 720 140 L 820 230 L 900 380 L 870 510 L 820 620 L 760 740 L 660 820 L 520 850 L 380 830 L 260 760 L 170 650 L 110 510 L 90 370 L 130 240 L 200 130 Z'
