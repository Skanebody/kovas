/**
 * TopClientsTable — top 10 clients par lifetime revenue (estimé V1).
 *
 * Server component pur (data déjà calculée côté page).
 */

import { Card } from '@/components/ui/card'
import type { TopClient } from '@/lib/admin/finance-calculator'
import { formatEur, planLabel } from './finance-format'

export interface TopClientsTableProps {
  clients: TopClient[]
}

function formatSignupDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function TopClientsTable({ clients }: TopClientsTableProps) {
  return (
    <Card variant="opaque" padding="default" className="col-span-full lg:col-span-2">
      <header className="mb-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Top 10 · lifetime revenue
        </p>
        <h2 className="font-serif italic text-3xl text-ink mt-1">Vos meilleurs.</h2>
      </header>

      {clients.length === 0 ? (
        <p className="text-sm text-ink-mute py-8 text-center">
          Aucun client facturé pour l'instant.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="text-left py-2 font-mono text-[10px] uppercase tracking-wider text-ink-mute">
                  #
                </th>
                <th className="text-left py-2 font-mono text-[10px] uppercase tracking-wider text-ink-mute">
                  Organisation
                </th>
                <th className="text-left py-2 font-mono text-[10px] uppercase tracking-wider text-ink-mute">
                  Plan
                </th>
                <th className="text-left py-2 font-mono text-[10px] uppercase tracking-wider text-ink-mute">
                  Inscription
                </th>
                <th className="text-right py-2 font-mono text-[10px] uppercase tracking-wider text-ink-mute">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, idx) => (
                <tr
                  key={c.orgId}
                  className="border-b border-rule/40 hover:bg-sage-alt/40 transition-colors"
                >
                  <td className="py-3 font-mono text-[11px] text-ink-faint">
                    {String(idx + 1).padStart(2, '0')}
                  </td>
                  <td className="py-3 text-ink font-medium">{c.name}</td>
                  <td className="py-3">
                    <span className="inline-flex items-center rounded-md bg-pastel-butter px-2 py-0.5 text-[11px] font-medium text-ink">
                      {planLabel(c.currentPlan)}
                    </span>
                  </td>
                  <td className="py-3 text-ink-mute font-mono text-[12px]">
                    {formatSignupDate(c.signedUpAt)}
                  </td>
                  <td className="py-3 text-right font-serif italic text-ink text-lg">
                    {formatEur(c.lifetimeRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[11px] text-ink-faint">
        Estimation V1 — basée sur invoices payées + MRR × ancienneté. Vraies données Stripe en V2.
      </p>
    </Card>
  )
}
