import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { DossierWizard } from './dossier-wizard'

export const metadata: Metadata = { title: 'Nouveau RDV' }

export default async function NewDossierPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; clientId?: string }>
}) {
  const params = await searchParams
  const { supabase, orgId } = await getCurrentUser()

  const [{ data: properties }, { data: clients }] = await Promise.all([
    supabase
      .from('properties')
      .select('id, address, city, postal_code, year_built')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id, display_name')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('display_name'),
  ])

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/dossiers">
          <ArrowLeft className="size-4" /> Retour
        </Link>
      </Button>

      <AppPageHeader
        title="Nouveau RDV"
        accent="dossier"
        eyebrow="📞 PRISE DE RDV · 90 SECONDES CHRONO"
        description="Wizard 3 étapes — bien & client, diagnostics & créneau, confirmation. Tout se crée d'un coup à la validation."
      />

      <DossierWizard
        properties={properties ?? []}
        clients={clients ?? []}
        defaultPropertyId={params.propertyId}
        defaultClientId={params.clientId}
      />
    </div>
  )
}
