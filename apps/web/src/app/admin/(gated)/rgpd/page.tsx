/**
 * /admin/rgpd — File d'attente DSAR (Data Subject Access Requests).
 *
 * Obligation légale : traiter chaque demande en moins de 30 jours (Art. 12 RGPD).
 * Cette page affiche les demandes pending + processing triées par deadline ASC,
 * permet d'agir (en cours / complétée / rejetée) avec audit log.
 */

import { DsarQueue } from '@/components/admin/rgpd/DsarQueue'
import { AppPageHeader } from '@/components/app-page-header'
import { getDsarQueue } from '@/lib/admin/dsar'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RGPD · Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminRgpdPage() {
  const supabase = createAdminClient()
  const data = await getDsarQueue(supabase)

  return (
    <div className="space-y-7 max-w-7xl">
      <AppPageHeader
        eyebrow="🛡️ RGPD · file DSAR"
        title="Demandes"
        accent="RGPD"
        description="Demandes d'accès, portabilité (Art. 15) et droit à l'oubli (Art. 17). Délai légal : 30 jours max. Chaque action est journalisée."
      />

      <DsarQueue data={data} />
    </div>
  )
}
