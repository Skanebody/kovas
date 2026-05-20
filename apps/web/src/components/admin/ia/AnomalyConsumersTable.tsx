/**
 * Anomalies de consommation IA : orgs > 3x leur moyenne 30j sur les dernières 24h.
 * Une org sans historique mais avec activité > 1€/24h apparaît avec multiplier = ∞.
 */

import { Card } from '@/components/ui/card'
import type { AnomalyConsumer } from '@/lib/admin/ia-analytics'
import { AlertTriangle } from 'lucide-react'

interface AnomalyConsumersTableProps {
  anomalies: AnomalyConsumer[]
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatMultiplier(m: number): string {
  if (!Number.isFinite(m)) return '∞'
  return `×${m.toFixed(1)}`
}

export function AnomalyConsumersTable({ anomalies }: AnomalyConsumersTableProps) {
  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink flex items-center gap-2">
          <AlertTriangle className="size-4 text-warning" aria-hidden />
          Anomalies 24h
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          {anomalies.length} flag{anomalies.length > 1 ? 's' : ''}
        </span>
      </div>

      {anomalies.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">
          Aucune anomalie détectée. Toutes les orgs restent sous 3× leur moyenne 30j.
        </p>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint border-b border-rule/60">
              <th className="py-2 font-normal">Organisation</th>
              <th className="py-2 font-normal text-right">24h</th>
              <th className="py-2 font-normal text-right">Moy 30j</th>
              <th className="py-2 font-normal text-right">×</th>
            </tr>
          </thead>
          <tbody>
            {anomalies.map((a) => (
              <tr key={a.orgId} className="border-b border-rule/30 last:border-b-0">
                <td className="py-2.5">
                  <a
                    href={`/admin/utilisateurs?org=${a.orgId}`}
                    className="text-ink font-medium hover:underline"
                  >
                    {a.orgName}
                  </a>
                </td>
                <td className="py-2.5 text-right font-mono text-ink">{formatEur(a.costLast24h)}</td>
                <td className="py-2.5 text-right font-mono text-ink-mute">
                  {formatEur(a.avg30dDaily)}
                </td>
                <td className="py-2.5 text-right font-mono font-semibold text-warning">
                  {formatMultiplier(a.multiplier)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}
