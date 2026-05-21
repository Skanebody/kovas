'use client'

/**
 * <TrendsChart> — Line chart SVG custom multi-series + toggle période.
 *
 * 3 périodes : 6 mois / 1 an / 3 ans. Lignes avec hover tooltip valeurs exactes.
 * DS v5 strict : pas de Recharts/Visx (SVG natif), couleurs sobres,
 * grid horizontale uniquement (vertical lines = bruit visuel).
 */

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useMemo, useState } from 'react'

export type TrendsPeriod = '6m' | '1y' | '3y'

export interface TrendsSeries {
  /** Identifiant unique (clé React + différenciation). */
  id: string
  /** Label affiché en légende. */
  label: string
  /** Couleur trait (token hex direct pour stroke SVG). */
  color: string
  /** Suffix unité affichée tooltip (ex: " €", "", " %"). */
  unitSuffix?: string
  /** Données par mois indexées YYYY-MM. */
  values: Record<string, number>
}

interface TrendsChartProps {
  /** Titre du chart (apparaît en header). */
  title: string
  /** Séries (max 3 conseillé pour lisibilité). */
  series: TrendsSeries[]
  /** Période par défaut. */
  defaultPeriod?: TrendsPeriod
  /** Hint méthodologique mono en footer. */
  hint?: string
}

const PERIOD_MONTHS: Record<TrendsPeriod, number> = {
  '6m': 6,
  '1y': 12,
  '3y': 36,
}

const PERIOD_LABEL: Record<TrendsPeriod, string> = {
  '6m': '6 mois',
  '1y': '1 an',
  '3y': '3 ans',
}

/** Build list of YYYY-MM keys for last N months including current. */
function buildMonthKeys(count: number): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    keys.push(key)
  }
  return keys
}

function formatShortMonth(key: string): string {
  const [year, month] = key.split('-')
  if (!year || !month) return key
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

function formatNumber(v: number): string {
  if (Math.abs(v) >= 10_000) return `${Math.round(v / 1000)}k`
  return v.toLocaleString('fr-FR')
}

export function TrendsChart({
  title,
  series,
  defaultPeriod = '1y',
  hint,
}: TrendsChartProps) {
  const [period, setPeriod] = useState<TrendsPeriod>(defaultPeriod)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const months = useMemo(() => buildMonthKeys(PERIOD_MONTHS[period]), [period])

  // Aggrégate values per series for selected period
  const seriesData = useMemo(() => {
    return series.map((s) => ({
      ...s,
      data: months.map((k) => Number(s.values[k] ?? 0)),
    }))
  }, [series, months])

  // Compute global min/max for shared Y axis
  const { yMin, yMax } = useMemo(() => {
    const all = seriesData.flatMap((s) => s.data)
    if (all.length === 0) return { yMin: 0, yMax: 1 }
    const mn = Math.min(...all, 0)
    const mx = Math.max(...all, 1)
    const pad = (mx - mn) * 0.08
    return { yMin: mn, yMax: mx + pad }
  }, [seriesData])

  const width = 720
  const height = 240
  const padding = { top: 16, right: 16, bottom: 28, left: 44 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const stepX = months.length > 1 ? innerW / (months.length - 1) : innerW
  const rangeY = yMax - yMin || 1

  function xAt(i: number): number {
    return padding.left + i * stepX
  }
  function yAt(v: number): number {
    return padding.top + (1 - (v - yMin) / rangeY) * innerH
  }

  // Build path for each series
  const seriesPaths = seriesData.map((s) => ({
    ...s,
    path: s.data
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)
      .join(' '),
  }))

  // Y axis ticks (4 ticks)
  const yTicks = useMemo(() => {
    const steps = 4
    const ticks: number[] = []
    for (let i = 0; i <= steps; i++) {
      ticks.push(yMin + ((yMax - yMin) * i) / steps)
    }
    return ticks
  }, [yMin, yMax])

  // X axis labels (max 6 evenly spread)
  const xLabelStep = Math.max(1, Math.ceil(months.length / 6))

  return (
    <Card variant="opaque" padding="none" className="rounded-[24px] overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-rule/60 px-6 py-4 flex-wrap">
        <p className="font-sans font-semibold text-[14px] text-ink">{title}</p>

        <div className="flex items-center gap-1 rounded-pill border border-rule/60 p-0.5 bg-paper">
          {(['6m', '1y', '3y'] as TrendsPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                'font-mono text-[10px] uppercase tracking-[0.1em] px-3 py-1 rounded-pill transition-colors',
                period === p
                  ? 'bg-ink text-paper'
                  : 'text-ink-mute hover:text-ink',
              )}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-6 pt-4">
        {series.map((s) => (
          <span
            key={s.id}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute"
          >
            <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>

      {/* Chart SVG */}
      <div className="px-2 pb-2 pt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full h-[240px]"
          role="img"
          aria-label={`Tendances ${title} sur ${PERIOD_LABEL[period]}`}
        >
          {/* Grid horizontal */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke="rgba(22,49,68,0.06)"
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={yAt(t) + 3}
                fontSize={9}
                fontFamily="ui-monospace, monospace"
                fill="#5B7088"
                textAnchor="end"
              >
                {formatNumber(t)}
              </text>
            </g>
          ))}

          {/* X axis labels */}
          {months.map((k, i) =>
            i % xLabelStep === 0 || i === months.length - 1 ? (
              <text
                key={k}
                x={xAt(i)}
                y={height - 8}
                fontSize={9}
                fontFamily="ui-monospace, monospace"
                fill="#5B7088"
                textAnchor="middle"
              >
                {formatShortMonth(k)}
              </text>
            ) : null,
          )}

          {/* Series lines */}
          {seriesPaths.map((s) => (
            <path
              key={s.id}
              d={s.path}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Hover overlay */}
          {months.map((_, i) => (
            <rect
              key={i}
              x={xAt(i) - stepX / 2}
              y={padding.top}
              width={stepX}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          ))}

          {/* Hover line + dots */}
          {hoverIdx != null ? (
            <>
              <line
                x1={xAt(hoverIdx)}
                x2={xAt(hoverIdx)}
                y1={padding.top}
                y2={padding.top + innerH}
                stroke="rgba(22,49,68,0.2)"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              {seriesPaths.map((s) => {
                const v = s.data[hoverIdx]
                if (v == null) return null
                return (
                  <circle
                    key={s.id}
                    cx={xAt(hoverIdx)}
                    cy={yAt(v)}
                    r={3.5}
                    fill="#FFFFFF"
                    stroke={s.color}
                    strokeWidth={2}
                  />
                )
              })}
            </>
          ) : null}
        </svg>
      </div>

      {/* Tooltip valeurs hover */}
      {hoverIdx != null ? (
        <div className="border-t border-rule/60 px-6 py-3 flex flex-wrap gap-x-5 gap-y-1.5">
          <p className="font-mono text-[11px] text-ink font-semibold tracking-[0.05em]">
            {formatShortMonth(months[hoverIdx] ?? '')}
          </p>
          {seriesPaths.map((s) => (
            <p
              key={s.id}
              className="font-mono text-[11px] text-ink-mute tabular-nums"
              style={{ color: s.color }}
            >
              {s.label} : {formatNumber(s.data[hoverIdx] ?? 0)}
              {s.unitSuffix ?? ''}
            </p>
          ))}
        </div>
      ) : null}

      {hint ? (
        <div className="border-t border-rule/60 px-6 py-3">
          <p className="font-mono text-[10px] text-ink-mute leading-relaxed">{hint}</p>
        </div>
      ) : null}
    </Card>
  )
}
