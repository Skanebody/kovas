/**
 * Synthèse financière du user (subscription + caps + flag suspension).
 *
 * V1 : pas d'historique paiement Stripe détaillé (route Stripe pas branchée).
 * On affiche l'état courant (tier, status, missions inclus, cap mensuel,
 * caps IA) + un placeholder TODO V2 pour l'historique Stripe.
 */

import { Card } from '@/components/ui/card'
import type { UserDetail } from '@/lib/admin/users-types'

interface UserFinancialHistoryProps {
  user: UserDetail
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function fmtCapCents(cents: number | null): string {
  if (cents === null) return 'défaut plan'
  return formatEur(cents / 100)
}

export function UserFinancialHistory({ user }: UserFinancialHistoryProps) {
  const sub = user.subscription
  const org = user.organization

  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Historique financier</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          État courant
        </span>
      </div>

      <dl className="grid gap-x-6 gap-y-3 grid-cols-1 sm:grid-cols-2 text-[13px]">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-0.5">
            Tier abonnement
          </dt>
          <dd className="text-ink">{sub?.tier ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-0.5">
            Statut
          </dt>
          <dd className="text-ink">{sub?.status ?? org?.plan_status ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-0.5">
            Missions incluses
          </dt>
          <dd className="text-ink font-mono">{sub?.missions_included ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-0.5">
            Surplus / mission
          </dt>
          <dd className="text-ink font-mono">
            {sub?.overage_price_cents !== undefined && sub?.overage_price_cents !== null
              ? formatEur(sub.overage_price_cents / 100)
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-0.5">
            Plafond mensuel
          </dt>
          <dd className="text-ink font-mono">
            {sub?.monthly_cap_eur !== undefined && sub?.monthly_cap_eur !== null
              ? formatEur(sub.monthly_cap_eur)
              : 'non défini'}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-0.5">
            Prochaine échéance
          </dt>
          <dd className="text-ink">{formatDate(sub?.current_period_end ?? null)}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-0.5">
            Cap IA / jour
          </dt>
          <dd className="text-ink font-mono">{fmtCapCents(org?.ai_cap_daily_cents ?? null)}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-0.5">
            Cap IA / mois
          </dt>
          <dd className="text-ink font-mono">{fmtCapCents(org?.ai_cap_monthly_cents ?? null)}</dd>
        </div>
        {org?.suspended_at ? (
          <div className="sm:col-span-2 rounded-md border border-danger/20 bg-danger/5 p-3">
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-danger mb-0.5">
              Organisation suspendue
            </dt>
            <dd className="text-ink">
              Depuis le {formatDate(org.suspended_at)}
              {org.suspension_reason ? ` · ${org.suspension_reason}` : ''}
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-4 text-[11px] text-ink-faint italic">
        Historique des paiements Stripe et ajustements de crédit · à venir V2 (intégration Stripe
        SDK).
      </p>
    </Card>
  )
}
