import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
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
    <div className="max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/properties">
          <ArrowLeft className="size-4" /> Retour
        </Link>
      </Button>

      <div className="space-y-1">
        <h1 className="text-display text-2xl md:text-3xl tracking-tight">Nouveau bien</h1>
        <p className="text-sm text-ink-mute">
          L'adresse se complète automatiquement (Base Adresse Nationale).
        </p>
      </div>

      <PropertyForm clients={clients ?? []} />
    </div>
  )
}
