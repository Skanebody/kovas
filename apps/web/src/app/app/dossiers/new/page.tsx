import { AppPageHeader } from '@/components/app-page-header'
import { ArrowLeft, Building2 } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { DossierForm } from './dossier-form'

export const metadata: Metadata = { title: 'Nouveau dossier' }

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
        <Link href="/app/dossiers">
          <ArrowLeft className="size-4" /> Retour
        </Link>
      </Button>

      <AppPageHeader
        title="Nouveau"
        accent="dossier"
        eyebrow="90 secondes chrono"
        description="Un dossier = une visite. Cochez tous les diagnostics à faire — KOVAS créera une fiche par diagnostic et partagera pièces, photos et notes."
      />

      {!properties || properties.length === 0 ? (
        <Card variant="opaque" padding="default" className="text-center">
          <CardContent className="space-y-4 pt-2">
            <Building2 className="size-10 mx-auto text-ink-mute" />
            <div className="space-y-1">
              <h2 className="font-semibold text-ink">Aucun bien disponible</h2>
              <p className="text-[13px] text-ink-mute">
                Ajoutez d&apos;abord un bien — le dossier s&apos;y rattachera.
              </p>
            </div>
            <Button asChild variant="accent">
              <Link href="/app/properties/new">Créer un bien</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DossierForm
          properties={properties}
          clients={clients ?? []}
          defaultPropertyId={params.propertyId}
          defaultClientId={params.clientId}
        />
      )}
    </div>
  )
}
