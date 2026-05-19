import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { OnboardingProgress } from '@/components/ui/onboarding-progress'
import { ArrowLeft, ArrowRight, Download, FileText, Sparkles, Upload } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Vos modèles & documents' }

/**
 * Onboarding étape 3/4 — Imports (wireframe v4 §2.3).
 * Clear, 3 options grid : Liciel / modèles existants / from zero.
 * Sauvegarde V1.5 — pour l'instant, présentation visuelle + skip.
 */
export default function OnboardingImportsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in py-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/onboarding/certifications">
            <ArrowLeft className="size-4" /> Retour
          </Link>
        </Button>
        <OnboardingProgress current={3} total={4} />
      </div>

      <div className="space-y-3">
        <h1 className="font-sans font-light text-4xl md:text-5xl tracking-tight text-ink">
          Vos <span className="font-serif italic">modèles</span> & documents.
        </h1>
        <p className="text-base text-ink-mute max-w-xl">
          On importe vos modèles existants pour démarrer vite. Si vous partez de zéro, KOVAS a ses
          propres modèles validés.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ImportCard
          icon={Download}
          title="Depuis Liciel"
          description="Compatible DPE. Connexion sécurisée à votre compte Liciel."
          ctaLabel="Connecter"
          available={false}
        />
        <ImportCard
          icon={Upload}
          title="Mes modèles existants"
          description="Glissez vos PDF ou Word. KOVAS les analyse et les convertit."
          ctaLabel="Glisser ici"
          available={false}
        />
        <ImportCard
          icon={Sparkles}
          title="Partir de zéro"
          description="Utiliser les modèles KOVAS validés métier. Recommandé débutants."
          ctaLabel="Choisir"
          available
        />
      </div>

      <div className="flex justify-between items-center gap-3 flex-wrap">
        <Button variant="ghost" asChild>
          <Link href="/app/onboarding/first-dossier">Plus tard</Link>
        </Button>
        <Button asChild>
          <Link href="/app/onboarding/first-dossier">
            Continuer <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function ImportCard({
  icon: Icon,
  title,
  description,
  ctaLabel,
  available,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  title: string
  description: string
  ctaLabel: string
  available: boolean
}) {
  return (
    <Card variant="opaque" padding="default" className="flex flex-col">
      <CardContent className="flex-1 flex flex-col items-start gap-3 pt-2">
        <div
          aria-hidden
          className="flex size-10 items-center justify-center rounded-full bg-cyan-light text-navy-900"
        >
          <Icon className="size-5" strokeWidth={1.75} />
        </div>
        <div className="flex-1 space-y-1.5">
          <h3 className="font-semibold text-base text-ink flex items-center gap-2">
            {title}
            {!available && (
              <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-rule/50 text-ink-mute">
                V1.5
              </span>
            )}
          </h3>
          <p className="text-sm text-ink-mute">{description}</p>
        </div>
        <Button variant={available ? 'default' : 'outline'} size="sm" disabled={!available}>
          <FileText className="size-3.5" />
          {ctaLabel}
        </Button>
      </CardContent>
    </Card>
  )
}
