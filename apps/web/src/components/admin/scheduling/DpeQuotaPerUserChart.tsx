'use client'

/**
 * DpeQuotaPerUserChart — Recharts BarChart horizontal des users avec ≥ 800 DPE.
 *
 * Gradient color :
 *   - count < 800   → navy (info, sous seuil affichage)
 *   - count ≥ 800   → amber (warning approche)
 *   - count ≥ 950   → red (critical, quasi atteint)
 *
 * Limite légale FR : 1000 DPE/12 mois glissants par diagnostiqueur (R134-4-3).
 */

import { Card } from '@/components/ui/card'
import type { DpeQuotaUserRow } from '@/lib/admin/scheduling-metrics'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface DpeQuotaPerUserChartProps {
  users: DpeQuotaUserRow[]
}

const DPE_LIMIT = 1000

function fillFor(count: number): string {
  if (count >= 950) return '#DC2626' // red
  if (count >= 800) return '#D97706' // amber
  return '#163144' // navy
}

function emailShort(email: string | null, idx: number): string {
  if (!email) return `User #${idx + 1}`
  const at = email.indexOf('@')
  if (at === -1) return email
  return email.slice(0, Math.min(at, 22))
}

interface ChartRow {
  label: string
  count: number
  percentUsed: number
}

export function DpeQuotaPerUserChart({ users }: DpeQuotaPerUserChartProps) {
  // On affiche les top 10, on filtre uniquement ceux ≥ 1 DPE
  const filtered = users.filter((u) => u.dpeCount > 0).slice(0, 10)

  const data: ChartRow[] = filtered.map((u, idx) => ({
    label: emailShort(u.userEmail, idx),
    count: u.dpeCount,
    percentUsed: u.percentUsed,
  }))

  return (
    <Card variant="opaque" padding="default">
      <header className="flex items-baseline justify-between gap-4 mb-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Quota DPE · 12 mois glissants
          </p>
          <h2 className="font-serif italic text-3xl text-ink mt-1">Top diagnostiqueurs.</h2>
        </div>
        <p className="text-xs text-ink-faint">limite légale {DPE_LIMIT}/an</p>
      </header>

      <div className="h-72 w-full">
        {data.length === 0 ? (
          <p className="text-sm text-ink-mute py-12 text-center">
            Aucun DPE complété sur les 12 derniers mois.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 6, right: 24, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E2D2" horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#5B7088', fontSize: 11 }}
                domain={[0, DPE_LIMIT]}
              />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#5B7088', fontSize: 11 }}
                width={130}
              />
              <ReferenceLine x={800} stroke="#D97706" strokeDasharray="3 3" />
              <ReferenceLine x={950} stroke="#DC2626" strokeDasharray="3 3" />
              <ReferenceLine x={DPE_LIMIT} stroke="#DC2626" strokeWidth={2} />
              <Tooltip
                contentStyle={{
                  background: '#FFFFFF',
                  border: '1px solid #E7E2D2',
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(value, name) => {
                  if (name === 'count') {
                    return [`${value} DPE`, 'Réalisés']
                  }
                  return [`${value}%`, name]
                }}
                labelStyle={{ color: '#163144', fontWeight: 600 }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((row) => (
                  <Cell key={row.label} fill={fillFor(row.count)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
