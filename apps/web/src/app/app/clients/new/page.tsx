import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ClientForm } from './client-form'

export const metadata: Metadata = { title: 'Nouveau client' }

export default function NewClientPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/clients">
          <ArrowLeft className="size-4" /> Retour
        </Link>
      </Button>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Nouveau client</h1>
        <p className="text-sm text-muted-foreground">
          Renseignez le nom du donneur d'ordre — un particulier, une agence, un notaire…
        </p>
      </div>

      <ClientForm />
    </div>
  )
}
