import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DiagChip } from '@/components/ui/diag-chip'
import { OnboardingProgress } from '@/components/ui/onboarding-progress'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Certifications COFRAC' }

/**
 * Onboarding étape 2/4 — Certifications COFRAC (wireframe v4 §2.2).
 * Clear, sélection multi-diagnostics + form par certif (organisme, n°,
 * dates, attestation PDF). Sauvegarde V1.5 — pour l'instant, formulaire
 * visuel + skip.
 */
export default function OnboardingCertificationsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in py-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/onboarding/welcome">
            <ArrowLeft className="size-4" /> Retour
          </Link>
        </Button>
        <OnboardingProgress current={2} total={4} />
      </div>

      <div className="space-y-3">
        <h1 className="font-sans font-light text-4xl md:text-5xl tracking-tight text-ink">
          Vos <span className="font-serif italic">certifications</span> COFRAC.
        </h1>
        <p className="text-base text-ink-mute max-w-xl">
          Pour qu&apos;on s&apos;occupe des alertes d&apos;expiration et qu&apos;on vous évite la
          surprise du renouvellement à l&apos;arrache.
        </p>
      </div>

      <Card variant="opaque" padding="lg">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-4 text-navy-700" />
            Sélectionnez vos diagnostics certifiés
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

          <p className="text-xs text-ink-mute">
            Configuration détaillée par certif (organisme, numéro, dates, attestation PDF)
            disponible depuis votre <Link href="/app/account" className="underline">compte</Link> à
            tout moment.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center gap-3 flex-wrap">
        <Button variant="ghost" asChild>
          <Link href="/app/onboarding/imports">Plus tard</Link>
        </Button>
        <Button asChild>
          <Link href="/app/onboarding/imports">
            Continuer <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
