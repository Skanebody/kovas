'use client'

/**
 * PackAdoptionChart — Recharts BarChart adoption packs prédéfinis par orgs.
 *
 * Source : `user_pricing_packs` (instances actives liées à predefined_pack_id).
 */

import { Card } from '@/components/ui/card'
import type { PackAdoptionRow } from '@/lib/admin/revenue-metrics'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface PackAdoptionChartProps {
  rows: PackAdoptionRow[]
}

interface ChartRow {
  label: string
  orgsCount: number
}

function shorten(name: string): string {
  if (name.length <= 28) return name
  return `${name.slice(0, 26)}…`
}

export function PackAdoptionChart({ rows }: PackAdoptionChartProps) {
  const data: ChartRow[] = rows.map((r) => ({
    label: shorten(r.packName),
    orgsCount: r.orgsCount,
  }))

  return (
    <Card variant="opaque" padding="default">
      <header className="flex items-baseline justify-between gap-4 mb-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Adoption packs prédéfinis · toutes orgs
          </p>
          <h2 className="font-serif italic text-3xl text-ink mt-1">Packs activés.</h2>
        </div>
      </header>

      <div className="h-72 w-full">
        {data.length === 0 ? (
          <p className="text-sm text-ink-mute py-12 text-center">
            Aucun pack activé pour l'instant.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E2D2" horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#5B7088', fontSize: 11 }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#5B7088', fontSize: 11 }}
                width={210}
              />
              <Tooltip
                contentStyle={{
                  background: '#FFFFFF',
                  border: '1px solid #E7E2D2',
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(value) => [`${value} orgs`, 'Activations']}
                labelStyle={{ color: '#163144', fontWeight: 600 }}
              />
              <Bar dataKey="orgsCount" fill="#D4F542" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
