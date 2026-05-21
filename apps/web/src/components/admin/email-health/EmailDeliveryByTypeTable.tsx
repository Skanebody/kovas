/**
 * Tableau des taux de delivery par type d'email (transactional, alert, digest, etc.).
 */

import { Card } from '@/components/ui/card'
import type { EmailDeliveryByType } from '@/lib/admin/observability'

interface Props {
  rows: EmailDeliveryByType[]
}

const TYPE_LABEL: Record<string, string> = {
  transactional: 'Transactionnels',
  alert: 'Alertes (quota, RDV)',
  digest: 'Rapports mensuels',
  product: 'Produit / changelog',
  invoice: 'Factures Stripe',
  gain_report: 'Gain Tracker',
  unknown: 'Non catégorisé',
}

function formatPct(rate: number, fractionDigits = 1): string {
  return `${(rate * 100).toFixed(fractionDigits)}%`
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

export function EmailDeliveryByTypeTable({ rows }: Props) {
  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Par type d'email</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          30 derniers jours
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">Aucun événement Resend sur 30 jours.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] tabular-nums">
            <thead>
              <tr className="border-b border-rule/60 text-left text-ink-mute font-mono uppercase tracking-[0.14em] text-[10px]">
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3 text-right">Envoyés</th>
                <th className="py-2 pr-3 text-right">Delivery</th>
                <th className="py-2 pr-3 text-right">Bounces</th>
                <th className="py-2 text-right">Plaintes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const totalSent = r.stats.delivered + r.stats.hardBounced + r.stats.softBounced
                return (
                  <tr key={r.type} className="border-b border-rule/30 last:border-0">
                    <td className="py-2 pr-3 text-ink">{TYPE_LABEL[r.type] ?? r.type}</td>
                    <td className="py-2 pr-3 text-right text-ink-mute">{formatInt(totalSent)}</td>
                    <td className="py-2 pr-3 text-right">
                      <span
                        className={
                          r.stats.deliveryRate >= 0.98
                            ? 'text-success font-medium'
                            : r.stats.deliveryRate >= 0.95
                              ? 'text-amber font-medium'
                              : 'text-danger font-medium'
                        }
                      >
                        {formatPct(r.stats.deliveryRate)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right text-ink-mute">
                      {formatInt(r.stats.hardBounced + r.stats.softBounced)}
                      {r.stats.softBounced > 0 ? (
                        <span className="text-ink-faint text-[10px] ml-1">
                          ({r.stats.softBounced} soft)
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 text-right text-ink-mute">
                      {formatInt(r.stats.complained)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
