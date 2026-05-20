/**
 * /admin/utilities — pilotage adoption Utilities terrain + Document Intelligence.
 *
 * Server component, monte UtilitiesAdoptionSection + DocumentMetricsSection.
 * Données fetchées en parallèle via service-role admin client.
 */

import { DocumentMetricsSection } from '@/components/admin/utilities/DocumentMetricsSection'
import { UtilitiesAdoptionSection } from '@/components/admin/utilities/UtilitiesAdoptionSection'
import { AppPageHeader } from '@/components/app-page-header'
import { getDocumentMetrics } from '@/lib/admin/document-metrics'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { getUtilitiesAdoption } from '@/lib/admin/utilities-metrics'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Utilities · Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminUtilitiesPage() {
  const supabase = createAdminClient()

  const [adoption, metrics] = await Promise.all([
    getUtilitiesAdoption(supabase),
    getDocumentMetrics(supabase),
  ])

  return (
    <div className="space-y-10 max-w-7xl">
      <AppPageHeader
        eyebrow="🧰 OUTILS · ADOPTION & COÛTS"
        title="Pilotage"
        accent="utilities"
        description="Adoption des 5 outils terrain et métriques Document Intelligence (volume, précision, marge)."
      />

      <UtilitiesAdoptionSection adoption={adoption} />

      <DocumentMetricsSection metrics={metrics} />
    </div>
  )
}
