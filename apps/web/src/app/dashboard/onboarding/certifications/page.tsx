import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DiagChip } from '@/components/ui/diag-chip'
import { OnboardingProgress } from '@/components/ui/onboarding-progress'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Certifications COFRAC' }

/**
 * Onboarding étape 2/4 — Certifications COFRAC (refonte V5 sobre).
 * Sélection multi-diagnostics + form par certif (organisme, n°, dates,
 * attestation PDF). Sauvegarde V1.5 — pour l'instant, formulaire visuel + skip.
 */
export default function OnboardingCertificationsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in py-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/onboarding/welcome">
            <ArrowLeft className="size-4" /> Retour
          </Link>
        </Button>
        <OnboardingProgress current={2} total={4} />
      </div>

      <AppPageHeader
        title="Tes"
        accent="certifications COFRAC"
        description="Pour qu'on s'occupe des alertes d'expiration et qu'on t'évite la surprise du renouvellement à l'arrache."
      />

      <Card variant="flat" padding="lg">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#0F1419]" />
            Sélectionne tes diagnostics certifiés
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <DiagChip type="DPE" />
            <DiagChip type="AMIANTE" />
            <DiagChip type="PLOMB" />
            <DiagChip type="GAZ" />
            <DiagChip type="ELECTRICITE" />
            <DiagChip type="TERMITES" />
            <DiagChip type="CARREZ" />
            <DiagChip type="ERP" />
          </div>

          <p className="text-xs text-[#0F1419]/72">
            Configuration détaillée par certif (organisme, numéro, dates, attestation PDF)
            disponible depuis ton{' '}
            <Link href="/dashboard/account" className="underline">
              compte
            </Link>{' '}
            à tout moment.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center gap-3 flex-wrap">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/onboarding/imports">Plus tard</Link>
        </Button>
        <Button asChild>
          <Link href="/dashboard/onboarding/imports">
            Continuer <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
