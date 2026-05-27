'use client'

/**
 * KOVAS — Graphique d'évolution mensuelle ADEME.
 *
 * Recharts LineChart sur les 12 derniers mois (DPE / mois).
 * Stratégie : agrège les snapshots quotidiens en agrégat mensuel via
 * `bucketByMonth` (somme des DPE publiés dans le mois). Affiche deux lignes :
 *   - DPE publiés (chartreuse pleine)
 *   - Anomalies détectées (coral, pointillés)
 *
 * Hauteur fixe 280 px. Pas de glow / gradient.
 */

import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { AdemeKpiSnapshotRow } from '@/app/api/ademe/kpi/current/route'
import { Card } from '@/components/ui/card'

export interface AdemeEvolutionChartProps {
  snapshots: AdemeKpiSnapshotRow[]
}

interface MonthlyBucket {
  monthKey: string // YYYY-MM
  label: string // ex: "Mai"
  total_dpe: number
  total_anomalies: number
}

const MONTHS_FR = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
]

function bucketByMonth(snapshots: AdemeKpiSnapshotRow[]): MonthlyBucket[] {
  const map = new Map<string, MonthlyBucket>()
  for (const s of snapshots) {
    const [yearStr, monthStr] = s.snapshot_date.split('-')
    if (!yearStr || !monthStr) continue
    const monthKey = `${yearStr}-${monthStr}`
    const existing = map.get(monthKey)
    const monthIdx = Number(monthStr) - 1
    const label = MONTHS_FR[monthIdx] ?? monthStr
    if (existing) {
      // Approche : on prend le dernier snapshot du mois (total cumulé) plutôt
      // qu'une somme — chaque snapshot représente l'état à date.
      existing.total_dpe = Math.max(existing.total_dpe, s.total_dpe)
      existing.total_anomalies = Math.max(existing.total_anomalies, s.total_anomalies)
    } else {
      map.set(monthKey, {
        monthKey,
        label,
        total_dpe: s.total_dpe,
        total_anomalies: s.total_anomalies,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey))
}

export function AdemeEvolutionChart({ snapshots }: AdemeEvolutionChartProps) {
  const data = useMemo(() => bucketByMonth(snapshots), [snapshots])

  return (
    <Card variant="opaque" padding="default" className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold text-ink">Évolution sur 12 mois</h3>
        <p className="text-[11px] text-ink-mute">
          DPE publiés et anomalies détectées, mois par mois
        </p>
      </div>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,20,25,0.08)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'rgba(15,20,25,0.6)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'rgba(15,20,25,0.6)' }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: '#FAFBFC',
                border: '1px solid rgba(15,20,25,0.12)',
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ fontWeight: 600, color: '#0F1419' }}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(value) => <span style={{ color: '#0F1419' }}>{value}</span>}
            />
            <Line
              type="monotone"
              dataKey="total_dpe"
              name="DPE publiés"
              stroke="#0F1419"
              strokeWidth={2}
              dot={{ r: 3, fill: '#0F1419' }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="total_anomalies"
              name="Anomalies"
              stroke="#D90B0E"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={{ r: 2.5, fill: '#D90B0E' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
