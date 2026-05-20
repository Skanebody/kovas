/**
 * Top 10 organisations consommatrices d'IA ce mois.
 * Affiche une progress bar relative au % du total consommé.
 */

import { Card } from '@/components/ui/card'
import type { TopConsumer } from '@/lib/admin/ia-analytics'

interface TopConsumersTableProps {
  consumers: TopConsumer[]
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(amount)
}

export function TopConsumersTable({ consumers }: TopConsumersTableProps) {
  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Top consumers ce mois</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          {consumers.length} org{consumers.length > 1 ? 's' : ''}
        </span>
      </div>

      {consumers.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">Aucune consommation IA ce mois.</p>
      ) : (
        <ul className="space-y-2.5" aria-label="Top organisations consommatrices d'IA">
          {consumers.map((c, idx) => (
            <li key={c.orgId} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[10px] text-ink-faint w-5 shrink-0">
                    #{idx + 1}
                  </span>
                  <a
                    href={`/admin/utilisateurs?org=${c.orgId}`}
                    className="text-ink font-medium truncate hover:underline"
                  >
                    {c.orgName}
                  </a>
                </span>
                <span className="font-mono text-[12px] text-ink shrink-0">
                  {formatEur(c.costEur)} · {c.callsCount}
                </span>
              </div>
              <div
                className="h-1.5 rounded-pill bg-ink/5 overflow-hidden"
                aria-label={`${c.percentOfTotal.toFixed(1)}% du total`}
              >
                <div
                  className="h-full bg-chartreuse"
                  style={{ width: `${Math.max(2, Math.min(100, c.percentOfTotal))}%` }}
                />
              </div>
              <p className="font-mono text-[10px] text-ink-faint">
                {c.percentOfTotal.toFixed(1)}% du total
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
