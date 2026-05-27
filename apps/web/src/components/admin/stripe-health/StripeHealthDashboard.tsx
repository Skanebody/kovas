/**
 * Dashboard Stripe Health — 4 sections READ-ONLY.
 *
 * Pas d'action de modification depuis l'admin : tous les boutons sont des liens
 * vers le Dashboard Stripe officiel. On évite ainsi toute manipulation
 * dangereuse (refund, dispute response, cancel sub) depuis notre UI.
 */

import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type {
  StripeDispute,
  StripeExpiringCard,
  StripeFailedInvoice,
  StripeHealthSnapshot,
  StripePastDueSub,
} from '@/lib/stripe/health'
import {
  AlertOctagon,
  Banknote,
  CalendarClock,
  CreditCard,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react'

interface Props {
  snapshot: StripeHealthSnapshot
}

function formatCents(cents: number, currency: string): string {
  const amount = cents / 100
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(ts: number): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function StripeLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[12px] text-ink hover:underline"
    >
      {children}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  )
}

function FailedInvoicesTable({ rows }: { rows: StripeFailedInvoice[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-ink-mute italic">
        Aucune facture en échec sur les 30 derniers jours.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-md border border-rule">
      <table className="w-full text-left">
        <thead className="bg-cream-deep/40 border-b border-rule">
          <tr>
            <Th>Email</Th>
            <Th>Numéro</Th>
            <Th align="right">Montant</Th>
            <Th>Statut</Th>
            <Th align="right">Retard</Th>
            <Th>Émise le</Th>
            <Th align="right">Action</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-rule/40 last:border-0 hover:bg-cream-deep/30">
              <Td>{r.customer_email ?? <span className="text-ink-faint">inconnu</span>}</Td>
              <Td>
                <span className="font-mono text-[11px] text-ink-mute">
                  {r.number ?? r.id.slice(0, 14)}
                </span>
              </Td>
              <Td align="right" className="tabular-nums font-medium">
                {formatCents(r.amount_due, r.currency)}
              </Td>
              <Td>
                <Badge variant={r.status === 'uncollectible' ? 'red' : 'orange'}>
                  {r.status ?? '—'}
                </Badge>
              </Td>
              <Td align="right" className="tabular-nums">
                {r.days_overdue !== null ? `${r.days_overdue} j` : '—'}
              </Td>
              <Td>{formatDate(r.created)}</Td>
              <Td align="right">
                {r.hosted_invoice_url ? (
                  <StripeLink href={r.hosted_invoice_url}>Voir</StripeLink>
                ) : (
                  <span className="text-ink-faint text-[12px]">—</span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DisputesTable({ rows }: { rows: StripeDispute[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-mute italic">Aucune dispute en attente de réponse.</p>
  }
  return (
    <div className="overflow-x-auto rounded-md border border-rule">
      <table className="w-full text-left">
        <thead className="bg-cream-deep/40 border-b border-rule">
          <tr>
            <Th>Dispute</Th>
            <Th align="right">Montant</Th>
            <Th>Raison</Th>
            <Th>Statut</Th>
            <Th>Deadline preuve</Th>
            <Th align="right">Action</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-rule/40 last:border-0 hover:bg-cream-deep/30">
              <Td>
                <span className="font-mono text-[11px] text-ink-mute">{r.id.slice(0, 16)}…</span>
              </Td>
              <Td align="right" className="tabular-nums font-medium">
                {formatCents(r.amount, r.currency)}
              </Td>
              <Td className="text-[12px] text-ink-mute">{r.reason}</Td>
              <Td>
                <Badge variant="red">{r.status}</Badge>
              </Td>
              <Td>
                {r.evidence_deadline ? (
                  <span className="text-[12px]">{formatDate(r.evidence_deadline)}</span>
                ) : (
                  '—'
                )}
              </Td>
              <Td align="right">
                <StripeLink href={r.dashboard_url}>Stripe</StripeLink>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PastDueSubsTable({ rows }: { rows: StripePastDueSub[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-mute italic">Aucun abonnement past_due actuellement.</p>
  }
  return (
    <div className="overflow-x-auto rounded-md border border-rule">
      <table className="w-full text-left">
        <thead className="bg-cream-deep/40 border-b border-rule">
          <tr>
            <Th>Email</Th>
            <Th align="right">Montant/mois</Th>
            <Th>Statut</Th>
            <Th>Fin période</Th>
            <Th align="right">Action</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-rule/40 last:border-0 hover:bg-cream-deep/30">
              <Td>{r.customer_email ?? <span className="text-ink-faint">inconnu</span>}</Td>
              <Td align="right" className="tabular-nums font-medium">
                {formatCents(r.amount_monthly, r.currency)}
              </Td>
              <Td>
                <Badge variant="orange">{r.status}</Badge>
              </Td>
              <Td className="text-[12px] text-ink-mute">{formatDate(r.current_period_end)}</Td>
              <Td align="right">
                <StripeLink href={r.dashboard_url}>Stripe</StripeLink>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExpiringCardsTable({ rows }: { rows: StripeExpiringCard[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-ink-mute italic">
        Aucune carte n&apos;expire dans les 30 prochains jours.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-md border border-rule">
      <table className="w-full text-left">
        <thead className="bg-cream-deep/40 border-b border-rule">
          <tr>
            <Th>Email</Th>
            <Th>Carte</Th>
            <Th align="right">Expire</Th>
            <Th align="right">Jours restants</Th>
            <Th align="right">Action</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.payment_method_id}
              className="border-b border-rule/40 last:border-0 hover:bg-cream-deep/30"
            >
              <Td>{r.customer_email ?? <span className="text-ink-faint">inconnu</span>}</Td>
              <Td className="font-mono text-[12px] text-ink-mute">
                {r.brand.toUpperCase()} •••• {r.last4}
              </Td>
              <Td align="right" className="tabular-nums">
                {String(r.exp_month).padStart(2, '0')}/{String(r.exp_year).slice(-2)}
              </Td>
              <Td align="right">
                <Badge
                  variant={
                    r.days_until_expiry < 0 ? 'red' : r.days_until_expiry < 14 ? 'orange' : 'yellow'
                  }
                >
                  <span className="tabular-nums">{r.days_until_expiry} j</span>
                </Badge>
              </Td>
              <Td align="right">
                <StripeLink href={r.dashboard_url}>Stripe</StripeLink>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode
  align?: 'right'
}) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium ${
        align === 'right' ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align,
  className,
}: {
  children: React.ReactNode
  align?: 'right'
  className?: string
}) {
  return (
    <td
      className={`px-3 py-2.5 text-[13px] text-ink ${
        align === 'right' ? 'text-right' : ''
      } ${className ?? ''}`}
    >
      {children}
    </td>
  )
}

export function StripeHealthDashboard({ snapshot }: Props) {
  if (!snapshot.configured) {
    return (
      <Card variant="warm" className="border-l-4 border-l-danger">
        <h2 className="text-[16px] font-semibold text-ink mb-1">Stripe non configuré</h2>
        <p className="text-sm text-ink-mute">
          La variable d&apos;environnement <code className="font-mono">STRIPE_SECRET_KEY</code>{' '}
          n&apos;est pas définie. Aucune donnée ne peut être récupérée.
        </p>
      </Card>
    )
  }

  const totalFailedAmount = snapshot.failedInvoices.reduce((s, i) => s + i.amount_due, 0)
  const totalDisputedAmount = snapshot.disputes.reduce((s, d) => s + d.amount, 0)

  return (
    <div className="space-y-10">
      {/* KPI hero */}
      <section
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="KPI Stripe health"
      >
        <AdminMetricCard
          eyebrow="Factures échouées"
          value={String(snapshot.failedInvoices.length)}
          hint={`${formatCents(totalFailedAmount, 'eur')} bloqués`}
          icon={Banknote}
        />
        <AdminMetricCard
          eyebrow="Disputes ouvertes"
          value={String(snapshot.disputes.length)}
          hint={
            snapshot.disputes.length > 0
              ? `${formatCents(totalDisputedAmount, 'eur')} contestés`
              : 'aucune action requise'
          }
          icon={ShieldAlert}
        />
        <AdminMetricCard
          eyebrow="Abonnements past_due"
          value={String(snapshot.pastDueSubs.length)}
          hint="paiement bloqué — relance auto Stripe"
          icon={AlertOctagon}
        />
        <AdminMetricCard
          eyebrow="CB expirent < 30j"
          value={String(snapshot.expiringCards.length)}
          hint="cartes à mettre à jour"
          icon={CreditCard}
        />
      </section>

      {/* Failed invoices */}
      <section className="space-y-3" aria-labelledby="failed-invoices">
        <header className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
              💸 Paiements · 30 derniers jours
            </p>
            <h2
              id="failed-invoices"
              className="font-serif italic font-normal text-2xl text-ink mt-1"
            >
              Factures en échec.
            </h2>
          </div>
          <p className="text-[11px] text-ink-faint font-mono">
            Données rafraîchies il y a {Math.floor((Date.now() - snapshot.fetchedAt) / 1000)} s
          </p>
        </header>
        <FailedInvoicesTable rows={snapshot.failedInvoices} />
      </section>

      {/* Disputes */}
      <section className="space-y-3" aria-labelledby="disputes">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            ⚖️ Litiges chargeback
          </p>
          <h2 id="disputes" className="font-serif italic font-normal text-2xl text-ink mt-1">
            Disputes en attente de réponse.
          </h2>
          <p className="text-sm text-ink-mute mt-1">
            Action requise via le Dashboard Stripe (preuves à uploader avant deadline).
          </p>
        </header>
        <DisputesTable rows={snapshot.disputes} />
      </section>

      {/* Past due */}
      <section className="space-y-3" aria-labelledby="past-due">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            <CalendarClock className="inline size-3 mb-0.5 mr-1" aria-hidden />
            Abonnements past_due
          </p>
          <h2 id="past-due" className="font-serif italic font-normal text-2xl text-ink mt-1">
            Churn involontaire potentiel.
          </h2>
        </header>
        <PastDueSubsTable rows={snapshot.pastDueSubs} />
      </section>

      {/* Expiring cards */}
      <section className="space-y-3" aria-labelledby="expiring-cards">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            <CreditCard className="inline size-3 mb-0.5 mr-1" aria-hidden />
            Cartes bancaires
          </p>
          <h2 id="expiring-cards" className="font-serif italic font-normal text-2xl text-ink mt-1">
            Expirations imminentes.
          </h2>
          <p className="text-sm text-ink-mute mt-1">
            Stripe envoie automatiquement des relances email J-30 et J-7 — surveiller ces clients.
          </p>
        </header>
        <ExpiringCardsTable rows={snapshot.expiringCards} />
      </section>
    </div>
  )
}
