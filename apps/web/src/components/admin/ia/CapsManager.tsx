/**
 * Plafonds mensuels actifs (subscriptions.monthly_cap_eur non NULL).
 *
 * V1 lecture seule — la modification se fait depuis la fiche user (agent 2).
 * Cf. CLAUDE.md §5 — plafond auto-protecteur, missions restent fonctionnelles
 * au-delà mais branding KOVAS revient sur PDF.
 */

import { Card } from '@/components/ui/card'
import type { ActiveCap } from '@/lib/admin/ia-analytics'
import { ExternalLink } from 'lucide-react'

interface CapsManagerProps {
  caps: ActiveCap[]
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return '—'
  }
}

export function CapsManager({ caps }: CapsManagerProps) {
  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Plafonds personnalisés actifs
          </h2>
          <p className="text-[11px] text-ink-mute mt-0.5">
            Lecture seule · modification via la fiche utilisateur
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          {caps.length} cap{caps.length > 1 ? 's' : ''}
        </span>
      </div>

      {caps.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">Aucun plafond personnalisé actif.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint border-b border-rule/60">
                <th className="py-2 font-normal">Organisation</th>
                <th className="py-2 font-normal text-right">Plafond mensuel</th>
                <th className="py-2 font-normal text-right">Dernière modif</th>
                <th className="py-2 font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {caps.map((c) => (
                <tr key={c.orgId} className="border-b border-rule/30 last:border-b-0">
                  <td className="py-2.5">
                    <span className="text-ink font-medium">{c.orgName}</span>
                  </td>
                  <td className="py-2.5 text-right font-mono text-ink">
                    {formatEur(c.monthlyCapEur)}
                  </td>
                  <td className="py-2.5 text-right font-mono text-ink-mute">
                    {formatDate(c.lastModifiedIso)}
                  </td>
                  <td className="py-2.5 text-right">
                    <a
                      href={`/admin/utilisateurs?org=${c.orgId}`}
                      className="inline-flex items-center gap-1 text-[11px] text-ink-mute hover:text-ink hover:underline"
                    >
                      Fiche
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
