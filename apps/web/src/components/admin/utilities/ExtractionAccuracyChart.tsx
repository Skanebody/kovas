'use client'

/**
 * Taux de correction par champ (top 10 fields les plus corrigés).
 * Recharts BarChart horizontal, label clair (DPE → Classe énergie, etc.).
 *
 * Plus le taux est haut, plus le champ est peu fiable côté IA.
 */

import { Card } from '@/components/ui/card'
import type { FieldCorrectionRateEntry } from '@/lib/admin/document-metrics'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface ExtractionAccuracyChartProps {
  data: FieldCorrectionRateEntry[]
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

interface FieldTooltipPayloadItem {
  payload?: FieldCorrectionRateEntry
}

interface FieldTooltipProps {
  active?: boolean
  payload?: FieldTooltipPayloadItem[]
}

function ChartTooltip({ active, payload }: FieldTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const first = payload[0]
  if (!first?.payload) return null
  const raw = first.payload
  return (
    <div className="rounded-md border border-rule/60 bg-paper px-3 py-2 shadow-md text-[12px]">
      <p className="font-medium text-ink">{raw.fieldLabel}</p>
      <p className="font-mono text-ink-mute">
        {raw.corrections} correction{raw.corrections > 1 ? 's' : ''} · taux {formatPct(raw.rate)}
      </p>
      <p className="font-mono text-[10px] text-ink-faint mt-1">{raw.fieldPath}</p>
    </div>
  )
}

export function ExtractionAccuracyChart({ data }: ExtractionAccuracyChartProps) {
  // Recharts horizontal : layout="vertical" + XAxis numérique + YAxis catégorie
  const chartData = [...data].sort((a, b) => a.rate - b.rate) // bottom = highest rate

  return (
    <Card variant="opaque" padding="default">
      <header className="mb-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Précision extraction · 30j
        </p>
        <h3 className="text-[15px] font-semibold tracking-tight text-ink mt-1">
          Top 10 champs corrigés
        </h3>
        <p className="text-[12px] text-ink-mute mt-1">
          🔍 Plus le taux est haut, plus le champ mérite une amélioration prompt / modèle.
        </p>
      </header>

      {data.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">
          Aucune correction enregistrée ces 30 derniers jours.
        </p>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#5B7088', fontSize: 10 }}
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                domain={[0, 'dataMax']}
              />
              <YAxis
                type="category"
                dataKey="fieldLabel"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#163144', fontSize: 11 }}
                width={150}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(217, 119, 6, 0.08)' }} />
              <Bar dataKey="rate" fill="#D97706" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
