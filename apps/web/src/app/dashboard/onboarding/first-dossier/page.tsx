import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OnboardingProgress } from '@/components/ui/onboarding-progress'
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Ton premier dossier' }

/**
 * Onboarding étape 4/4 — First dossier (refonte V5 sobre).
 * Plus de drama cyan : layout sobre sur fond sage. Form inline (adresse BAN +
 * diag chips + client + RDV optionnel). Pour V1, redirige vers /app/dossiers/new
 * (form complet). Tutoiement.
 */
export default function OnboardingFirstDossierPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in py-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/onboarding/imports">
            <ArrowLeft className="size-4" /> Retour
          </Link>
        </Button>
        <OnboardingProgress current={4} total={4} />
      </div>

      <AppPageHeader
        title="Ton"
        accent="premier dossier"
        description="Créons-le ensemble. 90 secondes chrono."
      />

      <Card variant="flat" padding="lg">
        <CardHeader>
          <CardTitle className="text-base text-[#0F1419] flex items-center gap-2">
            <Sparkles className="size-4 text-[#D4F542]" />
            Ce que tu vas faire
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-3 text-sm text-[#0F1419]/82">
            <Step n={1}>
              <strong>Adresse du bien</strong> — autocomplétion via la Base Adresse Nationale (BAN)
            </Step>
            <Step n={2}>
              <strong>Diagnostics à réaliser</strong> — sélection multi-chips colorés (DPE, Amiante,
              etc.)
            </Step>
            <Step n={3}>
              <strong>Client</strong> — nom, email, téléphone (existant ou nouveau)
            </Step>
            <Step n={4}>
              <strong>RDV souhaité</strong> — optionnel, date et heure
            </Step>
          </ol>

          <p className="text-xs text-[#0F1419]/72 pt-2 border-t border-[#0F1419]/[0.08]">
            Une fois créé, tu découvriras le mode mission (saisie vocale, photos géolocalisées,
            checklist). On t'accompagne pas à pas.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center gap-3 flex-wrap">
        <Button asChild variant="ghost">
          <Link href="/dashboard/dashboard">Plus tard</Link>
        </Button>
        <Button asChild size="lg" variant="accent">
          <Link href="/dashboard/dossiers/new">
            Créer mon premier dossier <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="shrink-0 size-6 flex items-center justify-center rounded-full bg-[#0F1419] text-[#D4F542] text-xs font-bold"
      >
        {n}
      </span>
      <span className="leading-relaxed pt-0.5">{children}</span>
    </li>
  )
}
