import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ClientForm } from './client-form'

export const metadata: Metadata = { title: 'Nouveau client' }

export default function NewClientPage() {
  return (
    <div className="max-w-2xl w-full mx-auto space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/clients">
          <ArrowLeft className="size-4" /> Retour
        </Link>
      </Button>

      <AppPageHeader
        title="Nouveau"
        accent="client"
        description="Renseignez le donneur d'ordre — particulier, agence, notaire, syndic…"
      />

      <ClientForm />
    </div>
  )
}
