'use client'

/**
 * Répartition des documents scannés par type (30j).
 * Recharts BarChart vertical, couleur uniform navy.
 */

import { Card } from '@/components/ui/card'
import type { DocumentTypeBreakdownEntry } from '@/lib/admin/document-metrics'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface DocumentTypeBreakdownChartProps {
  data: DocumentTypeBreakdownEntry[]
}

const TYPE_LABELS: Record<string, string> = {
  dpe: 'DPE',
  amiante: 'Amiante',
  plomb: 'Plomb CREP',
  gaz: 'Gaz',
  electricite: 'Électricité',
  termites: 'Termites',
  carrez: 'Carrez/Boutin',
  erp: 'ERP',
  facture_energie: 'Facture énergie',
  plan: 'Plan/Croquis',
  acte_propriete: 'Acte propriété',
  ancien_dpe: 'Ancien DPE',
  taxe_fonciere: 'Taxe foncière',
  releve_compteur: 'Relevé compteur',
  unknown: 'Inconnu',
}

function labelFor(type: string): string {
  return TYPE_LABELS[type] ?? type
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

interface TypeTooltipPayloadItem {
  payload?: DocumentTypeBreakdownEntry
}

interface TypeTooltipProps {
  active?: boolean
  payload?: TypeTooltipPayloadItem[]
}

function ChartTooltip({ active, payload }: TypeTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const first = payload[0]
  if (!first?.payload) return null
  const raw = first.payload
  return (
    <div className="rounded-md border border-rule/60 bg-paper px-3 py-2 shadow-md text-[12px]">
      <p className="font-medium text-ink">{labelFor(raw.type)}</p>
      <p className="font-mono text-ink-mute">
        {formatInt(raw.count)} · {raw.percent.toFixed(1)}%
      </p>
    </div>
  )
}

export function DocumentTypeBreakdownChart({ data }: DocumentTypeBreakdownChartProps) {
  const chartData = data.map((d) => ({ ...d, label: labelFor(d.type) }))

  return (
    <Card variant="opaque" padding="default">
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Types de documents · 30j
          </p>
          <h3 className="text-[15px] font-semibold tracking-tight text-ink mt-1">
            Mix Document Intelligence
          </h3>
        </div>
        <span className="font-mono text-[10px] text-ink-faint">
          {data.length} type{data.length > 1 ? 's' : ''}
        </span>
      </header>

      {data.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">Aucun document scanné ces 30 derniers jours.</p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 30, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#5B7088', fontSize: 10 }}
                angle={-30}
                textAnchor="end"
                interval={0}
                height={60}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#5B7088', fontSize: 11 }}
                allowDecimals={false}
                width={36}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(22, 49, 68, 0.06)' }} />
              <Bar dataKey="count" fill="#163144" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
