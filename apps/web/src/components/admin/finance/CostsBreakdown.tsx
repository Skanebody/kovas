'use client'

/**
 * CostsBreakdown — pie chart répartition coûts du mois.
 */

import { Card } from '@/components/ui/card'
import type { MonthCosts } from '@/lib/admin/finance-calculator'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatEur } from './finance-format'

export interface CostsBreakdownProps {
  costs: MonthCosts
}

const COST_COLORS = {
  ia: '#163144', // navy
  stripe: '#7FB5C7', // cyan-mid
  supabase: '#D4F542', // chartreuse signature
  resend: '#D97706', // amber
} as const

const COST_LABELS = {
  ia: 'IA (Claude + Whisper)',
  stripe: 'Frais Stripe',
  supabase: 'Supabase Pro',
  resend: 'Resend emails',
} as const

interface PieRow {
  name: keyof typeof COST_COLORS
  label: string
  value: number
}

export function CostsBreakdown({ costs }: CostsBreakdownProps) {
  const data: PieRow[] = (
    [
      { name: 'ia', label: COST_LABELS.ia, value: costs.ia },
      { name: 'stripe', label: COST_LABELS.stripe, value: costs.stripe },
      { name: 'supabase', label: COST_LABELS.supabase, value: costs.supabase },
      { name: 'resend', label: COST_LABELS.resend, value: costs.resend },
    ] as PieRow[]
  ).filter((d) => d.value > 0)

  return (
    <Card variant="opaque" padding="default">
      <header className="mb-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Coûts · répartition ce mois
        </p>
        <h2 className="font-serif italic text-3xl text-ink mt-1">Dépenses.</h2>
      </header>

      {costs.total === 0 ? (
        <p className="text-sm text-ink-mute py-8 text-center">Aucun coût enregistré ce mois.</p>
      ) : (
        <>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={COST_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#FFFFFF',
                    border: '1px solid #E7E2D2',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(value) =>
                    typeof value === 'number' ? formatEur(value, 2) : String(value ?? '—')
                  }
                />
                <Legend
                  iconType="circle"
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  formatter={(value: string) => (
                    <span style={{ color: '#5B7088', fontSize: 11 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 pt-4 border-t border-rule space-y-1.5">
            {data.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2 text-ink-mute">
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ background: COST_COLORS[d.name] }}
                  />
                  {d.label}
                </span>
                <span className="font-mono text-ink">{formatEur(d.value, 2)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-rule/40 text-[12px] font-semibold">
              <span className="text-ink">Total</span>
              <span className="font-serif italic text-ink text-base">
                {formatEur(costs.total, 2)}
              </span>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}
