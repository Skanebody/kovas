/**
 * /admin/email-health — taux de delivery Resend, bounces, plaintes.
 *
 * Source : table `email_events` alimentée par /api/webhooks/resend.
 * Lecture seule — pas d'action admin sur cette section (les actions correctives
 * sont à l'extérieur : changer SPF/DKIM, suspendre user, etc.).
 */

import { EmailBouncingRecipientsTable } from '@/components/admin/email-health/EmailBouncingRecipientsTable'
import { EmailDailyChart } from '@/components/admin/email-health/EmailDailyChart'
import { EmailDeliveryByTypeTable } from '@/components/admin/email-health/EmailDeliveryByTypeTable'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { getEmailHealth } from '@/lib/admin/observability'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { AlertOctagon, Inbox, MailCheck, MailWarning } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Email deliverability',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

export default async function AdminEmailHealthPage() {
  const supabase = createAdminClient()
  const snapshot = await getEmailHealth(supabase)

  const totalSent =
    snapshot.global30d.delivered + snapshot.global30d.hardBounced + snapshot.global30d.softBounced

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Email · Observabilité
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Santé de la délivrabilité.
        </h1>
        <p className="text-sm text-ink-mute max-w-xl">
          Taux de delivery, bounces et plaintes Resend sur les 30 derniers jours. Source :
          webhook <code className="font-mono text-[11px]">/api/webhooks/resend</code>.
        </p>
      </div>

      {/* KPIs hero */}
      <section
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Métriques email clés"
      >
        <AdminMetricCard
          eyebrow="Delivery rate 30j"
          value={formatPct(snapshot.global30d.deliveryRate)}
          hint={`${formatInt(snapshot.global30d.delivered)} delivered / ${formatInt(totalSent)} tentatives`}
          icon={MailCheck}
        />
        <AdminMetricCard
          eyebrow="Bounces"
          value={formatInt(snapshot.global30d.hardBounced + snapshot.global30d.softBounced)}
          hint={`${formatInt(snapshot.global30d.hardBounced)} hard · ${formatInt(snapshot.global30d.softBounced)} soft`}
          icon={MailWarning}
        />
        <AdminMetricCard
          eyebrow="Plaintes / désabos"
          value={formatInt(snapshot.global30d.complained + snapshot.global30d.unsubscribed)}
          hint={`${formatPct(snapshot.global30d.complaintRate)} taux plaintes`}
          icon={AlertOctagon}
        />
        <AdminMetricCard
          eyebrow="Volume total 30j"
          value={formatInt(totalSent + snapshot.global30d.sent)}
          hint={`${snapshot.byType.length} types d'emails actifs`}
          icon={Inbox}
        />
      </section>

      {/* Chart */}
      <section aria-label="Évolution quotidienne">
        <EmailDailyChart data={snapshot.daily} />
      </section>

      {/* Tables */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-2" aria-label="Détails par type et bouncing">
        <EmailDeliveryByTypeTable rows={snapshot.byType} />
        <EmailBouncingRecipientsTable recipients={snapshot.topBouncing} />
      </section>
    </div>
  )
}
