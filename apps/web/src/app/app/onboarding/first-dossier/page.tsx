import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OnboardingProgress } from '@/components/ui/onboarding-progress'
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Votre premier dossier' }

/**
 * Onboarding étape 4/4 — First dossier (wireframe v4 §2.4).
 * Drama cyan liquide, form inline (adresse BAN + diag chips + client +
 * RDV optionnel). Pour V1, redirige vers /app/dossiers/new (form complet).
 *
 * Cette page est une "transition" — elle annonce l'étape suivante avec
 * dramatisation Drama cyan + serif italic + microcopy "90 secondes chrono".
 */
export default function OnboardingFirstDossierPage() {
  return (
    <div className="-mx-4 md:-mx-8 -mt-4 min-h-[80vh] bg-fluid-cyan px-4 md:px-8 py-10 md:py-14 animate-fade-in">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Button variant="glass" size="sm" asChild>
            <Link href="/app/onboarding/imports">
              <ArrowLeft className="size-4" /> Retour
            </Link>
          </Button>
          <OnboardingProgress
            current={4}
            total={4}
            className="bg-paper/15 px-4 py-2 rounded-pill text-paper [&_span:first-child]:text-paper/80"
          />
        </div>

        <div className="space-y-4">
          <h1 className="font-sans font-light text-4xl md:text-5xl tracking-tight text-paper">
            Votre <span className="font-serif italic">premier dossier</span>.
          </h1>
          <p className="text-lg text-paper/85 max-w-xl">
            Créons-le ensemble. 90 secondes chrono.
          </p>
        </div>

        <Card variant="glass" padding="lg">
          <CardHeader>
            <CardTitle className="text-base text-ink flex items-center gap-2">
              <Sparkles className="size-4 text-amber" />
              Ce que vous allez faire
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-3 text-sm text-ink-soft">
              <Step n={1}>
                <strong>Adresse du bien</strong> — autocomplétion via la Base Adresse Nationale (BAN)
              </Step>
              <Step n={2}>
                <strong>Diagnostics à réaliser</strong> — sélection multi-chips colorés (DPE,
                Amiante, etc.)
              </Step>
              <Step n={3}>
                <strong>Client</strong> — nom, email, téléphone (existant ou nouveau)
              </Step>
              <Step n={4}>
                <strong>RDV souhaité</strong> — optionnel, date et heure
              </Step>
            </ol>

            <p className="text-xs text-ink-mute pt-2 border-t border-rule/60">
              Une fois créé, vous découvrirez le mode mission (saisie vocale, photos géolocalisées,
              checklist). On vous accompagne pas à pas.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center gap-3 flex-wrap">
          <Button asChild variant="ghost" className="text-paper hover:bg-paper/10">
            <Link href="/app/dashboard">Plus tard</Link>
          </Button>
          <Button asChild size="lg" variant="warm">
            <Link href="/app/dossiers/new">
              Créer mon premier dossier <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="shrink-0 size-6 flex items-center justify-center rounded-full bg-navy-800 text-paper text-xs font-bold"
      >
        {n}
      </span>
      <span className="leading-relaxed pt-0.5">{children}</span>
    </li>
  )
}
