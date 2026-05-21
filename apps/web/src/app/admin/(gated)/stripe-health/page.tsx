/**
 * /admin/stripe-health — Pilotage Stripe (read-only).
 *
 * Quatre sections : paiements échoués, disputes, abonnements past_due,
 * cartes qui expirent. Cache mémoire 60s côté lib/stripe/health.ts.
 */

import { StripeHealthDashboard } from '@/components/admin/stripe-health/StripeHealthDashboard'
import { AppPageHeader } from '@/components/app-page-header'
import { getStripeHealthSnapshot } from '@/lib/stripe/health'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Stripe Health · Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminStripeHealthPage() {
  const snapshot = await getStripeHealthSnapshot()

  return (
    <div className="space-y-7 max-w-7xl">
      <AppPageHeader
        eyebrow="💳 Stripe Health · paiements & risques"
        title="Stripe"
        accent="health"
        description="Paiements échoués, disputes ouvertes, churn involontaire et cartes qui expirent. Lecture seule — actions via le Dashboard Stripe."
      />

      <StripeHealthDashboard snapshot={snapshot} />
    </div>
  )
}
