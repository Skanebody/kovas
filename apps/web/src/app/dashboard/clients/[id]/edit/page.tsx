import { AppPageHeader } from '@/components/app-page-header'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { EditClientForm } from './edit-form'

export const metadata: Metadata = { title: 'Modifier le client' }

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  const { data: client } = await supabase
    .from('clients')
    .select(
      'id, type, display_name, first_name, last_name, company_name, email, phone, address, postal_code, city, apartment_detail, building_letter, floor_number, address_complement, siret, notes',
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single()

  if (!client) notFound()

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/clients/${id}`}>
          <ArrowLeft className="size-4" /> Retour au client
        </Link>
      </Button>

      <AppPageHeader
        title="Modifier"
        accent={client.display_name}
        eyebrow="Client"
      />

      <EditClientForm client={client} />
    </div>
  )
}
