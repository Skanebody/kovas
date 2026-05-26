import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PropertyForm } from './property-form'

export const metadata: Metadata = { title: 'Nouveau bien' }

export default async function NewPropertyPage() {
  const { supabase, orgId } = await getCurrentUser()

  const { data: clients } = await supabase
    .from('clients')
    .select('id, display_name')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('display_name')

  return (
    <div className="max-w-2xl w-full mx-auto space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/properties">
          <ArrowLeft className="size-4" /> Retour
        </Link>
      </Button>

      <AppPageHeader
        title="Nouveau"
        accent="bien"
        description="L'adresse se complète automatiquement via la Base Adresse Nationale (BAN)."
      />

      <PropertyForm clients={clients ?? []} />
    </div>
  )
}
