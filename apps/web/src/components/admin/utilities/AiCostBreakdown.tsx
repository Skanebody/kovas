/**
 * Coût IA Document Intelligence par utilisateur (top 10).
 * Table avec progress bars horizontales (% du coût total).
 */

import { Card } from '@/components/ui/card'
import type { DocumentCostByUserEntry } from '@/lib/admin/document-metrics'

interface AiCostBreakdownProps {
  costs: DocumentCostByUserEntry[]
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(amount)
}

export function AiCostBreakdown({ costs }: AiCostBreakdownProps) {
  const total = costs.reduce((s, c) => s + c.costEur, 0)

  return (
    <Card variant="opaque" padding="default">
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Coût IA · top 10 · 30j
          </p>
          <h3 className="text-[15px] font-semibold tracking-tight text-ink mt-1">
            Répartition coût Document Intelligence
          </h3>
        </div>
        <span className="font-mono text-[10px] text-ink-faint">{formatEur(total)} total</span>
      </header>

      {costs.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">
          Aucun coût IA enregistré ces 30 derniers jours.
        </p>
      ) : (
        <ul className="space-y-2.5" aria-label="Coût IA par utilisateur">
          {costs.map((c, idx) => (
            <li key={c.userId} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[10px] text-ink-faint w-5 shrink-0">
                    #{idx + 1}
                  </span>
                  <a
                    href={`/admin/users?user=${c.userId}`}
                    className="text-ink font-medium truncate hover:underline"
                  >
                    {c.name}
                  </a>
                </span>
                <span className="font-mono text-[12px] text-ink shrink-0">
                  {formatEur(c.costEur)}
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
