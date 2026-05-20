/**
 * KOVAS — /app/compte/tarifs
 *
 * Page paramètres du calculateur de prix indicatif.
 * Server component qui délègue à <PricingSettings> pour le fetch + rendu.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { PricingSettings } from '@/components/settings/pricing/pricing-settings'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Mes tarifs' }

export default function PricingSettingsPage() {
  return (
    <div className="max-w-4xl space-y-8">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/account">
          <ArrowLeft className="size-4" /> Mon compte
        </Link>
      </Button>

      <AppPageHeader
        title="Mes"
        accent="tarifs"
        description="Calculateur de prix indicatif pour aider à la prise de RDV — non contractuel."
      />

      <PricingSettings />
    </div>
  )
}
