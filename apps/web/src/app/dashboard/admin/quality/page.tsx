import { QualityDashboard } from '@/components/admin/QualityDashboard'
import { AppPageHeader } from '@/components/app-page-header'
import { loadQualityDashboardData } from '@/lib/admin/quality-data'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Qualité KOVAS · Admin',
  robots: { index: false, follow: false },
}

// Force dynamic — les métriques temps réel ne doivent jamais être cachées par Vercel.
export const dynamic = 'force-dynamic'

export default async function AdminQualityPage() {
  // Double garde : layout admin protège déjà, mais on re-vérifie pour défense en profondeur.
  await requireAdmin()

  const data = await loadQualityDashboardData()

  return (
    <div className="space-y-8 animate-fade-in">
      <AppPageHeader
        eyebrow="Tableau de bord admin"
        title="Qualité"
        accent="KOVAS"
        description="Vue consolidée santé technique, SEO, business et sécurité. Données agrégées en temps réel depuis Sentry, PostHog, Better Stack et les rapports CI."
      />
      <QualityDashboard data={data} />
    </div>
  )
}
