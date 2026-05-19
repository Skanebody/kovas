import {
  ArrowRight,
  CheckCircle2,
  Plus,
  Share2,
  Smartphone,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'

export const metadata: Metadata = { title: 'Bienvenue' }

export default async function OnboardingPage() {
  const { profile } = await getCurrentUser()
  const firstName = profile.full_name?.split(' ')[0] ?? ''

  return (
    <div className="max-w-3xl space-y-8 animate-fade-in">
      {/* Hero onboarding — Drama cyan atténué */}
      <div className="-mx-4 md:-mx-8 -mt-4 bg-fluid-light px-4 md:px-8 py-10 md:py-14 mb-2 rounded-b-xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute mb-3">
          Bienvenue · 90 secondes pour démarrer
        </p>
        <h1 className="font-sans font-light text-display-m md:text-display-l tracking-tight text-ink">
          Bienvenue <span className="font-serif italic">{firstName}</span>.
        </h1>
        <p className="text-base md:text-lg text-ink-mute mt-3 max-w-xl">
          Vous êtes prêt. Voici les 3 actions à faire dans cet ordre — votre première mission est
          opérationnelle dès aujourd'hui.
        </p>
      </div>

      <div className="space-y-4">
        <Step
          n={1}
          icon={Smartphone}
          title="Installer KOVAS sur votre iPad / iPhone"
          description="Pour utiliser KOVAS sur le terrain, ajoutez-le à votre écran d'accueil — il fonctionnera comme une vraie app, même sans réseau."
          bullets={[
            'Safari iOS : touchez ⎘ (Partager) → Sur l\'écran d\'accueil',
            'Chrome Android : menu ⋮ → Installer l\'application',
            "Sur Mac : l'app fonctionne directement dans Safari ou Chrome",
          ]}
        />
        <Step
          n={2}
          icon={Plus}
          title="Créer votre premier client et votre premier bien"
          description="Le client est le donneur d'ordre (particulier, agence, notaire…). Le bien est l'adresse à diagnostiquer — l'autocomplétion gouv FR remplit tout."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="accent">
                <Link href="/app/clients/new">
                  Créer un client <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="glass" asChild>
                <Link href="/app/properties/new">Ajouter un bien</Link>
              </Button>
            </div>
          }
        />
        <Step
          n={3}
          icon={Share2}
          title="Lancer une mission test"
          description="Créez une mission DPE, ajoutez 1 pièce, prenez 2-3 photos et faites une note vocale. Vous verrez en 5 minutes ce que KOVAS change réellement."
          actions={
            <Button asChild variant="accent">
              <Link href="/app/dossiers/new">
                Créer une mission <ArrowRight className="size-4" />
              </Link>
            </Button>
          }
        />
      </div>

      <Card variant="opaque" padding="default">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="size-4 text-accent-green" />
            Une question, un retour ?
          </CardTitle>
          <CardDescription>
            Pendant les 14 premiers jours, Benjamin (fondateur) lit chaque message personnellement.
            Écrivez à <a href="mailto:benjamin@kovas.fr" className="underline">benjamin@kovas.fr</a>.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}

function Step({
  n,
  icon: Icon,
  title,
  description,
  bullets,
  actions,
}: {
  n: number
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  bullets?: string[]
  actions?: React.ReactNode
}) {
  return (
    <Card variant="opaque" padding="default">
      <CardContent className="pt-6 flex gap-4">
        <div className="shrink-0 size-9 rounded-full bg-navy text-paper flex items-center justify-center text-sm font-semibold shadow-accent">
          {n}
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-ink-mute" />
            <h2 className="font-semibold">{title}</h2>
          </div>
          <p className="text-sm text-ink-mute">{description}</p>
          {bullets && (
            <ul className="text-sm space-y-1">
              {bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-ink-mute">·</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          {actions}
        </div>
      </CardContent>
    </Card>
  )
}
