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
    <div className="max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/dossiers">
          <ArrowLeft className="size-4" /> Retour
        </Link>
      </Button>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Nouveau dossier</h1>
        <p className="text-sm text-muted-foreground">
          Un dossier = une visite. Cochez tous les diagnostics à faire lors de cette visite — KOVAS
          créera une fiche par diagnostic et partagera les pièces, photos et notes.
        </p>
      </div>

      {!properties || properties.length === 0 ? (
        <Card>
          <CardContent className="pt-6 pb-8 text-center space-y-4">
            <Building2 className="size-10 mx-auto text-muted-foreground" />
            <div className="space-y-1">
              <h2 className="font-semibold">Aucun bien disponible</h2>
              <p className="text-sm text-muted-foreground">
                Ajoutez d'abord un bien — le dossier s'y rattachera.
              </p>
            </div>
            <Button asChild>
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
