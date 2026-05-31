import { AppPageHeader } from '@/components/app-page-header'
import { PwaInstallGuide } from '@/components/pwa/PwaInstallGuide'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowRight, CheckCircle2, Plus, Share2, Smartphone } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Bienvenue' }

/** URL canonique de l'app installée (matche `start_url` du manifest). */
const APP_URL = 'https://kovas.fr/dashboard/dashboard' as const

export default async function OnboardingPage() {
  const { profile } = await getCurrentUser()
  const firstName = profile.full_name?.split(' ')[0] ?? ''

  // QR code généré côté serveur (SVG, pas de module natif `canvas`) pour le
  // parcours desktop du guide d'installation. Non bloquant : null si échec.
  let qrSvg: string | null = null
  try {
    const QRCode = await import('qrcode')
    qrSvg = await QRCode.toString(APP_URL, {
      type: 'svg',
      margin: 1,
      width: 200,
      errorCorrectionLevel: 'M',
    })
  } catch {
    qrSvg = null
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <AppPageHeader
        eyebrow="Bienvenue · 90 secondes pour démarrer"
        title={firstName ? `Bienvenue ${firstName}` : 'Bienvenue'}
        accent={firstName ? '' : 'sur KOVAS'}
        description="Tu es prêt. Voici les 3 actions à faire dans cet ordre — ta première mission est opérationnelle dès aujourd'hui."
      />

      <div className="space-y-4">
        <Step
          n={1}
          icon={Smartphone}
          title="Installer KOVAS sur ton iPad / iPhone"
          description="Pour utiliser KOVAS sur le terrain, ajoute-le à ton écran d'accueil — il fonctionnera comme une vraie app, même sans réseau. Suis le guide ci-dessous, il s'adapte à ton appareil."
        >
          <PwaInstallGuide appUrl={APP_URL} qrSvg={qrSvg} />
        </Step>
        <Step
          n={2}
          icon={Plus}
          title="Créer ton premier client et ton premier bien"
          description="Le client est le donneur d'ordre (particulier, agence, notaire…). Le bien est l'adresse à diagnostiquer — l'autocomplétion gouv FR remplit tout."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="accent">
                <Link href="/dashboard/clients/new">
                  Créer un client <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/properties/new">Ajouter un bien</Link>
              </Button>
            </div>
          }
        />
        <Step
          n={3}
          icon={Share2}
          title="Lancer une mission test"
          description="Crée une mission DPE, ajoute 1 pièce, prends 2-3 photos et fais une note vocale. Tu verras en 5 minutes ce que KOVAS change réellement."
          actions={
            <Button asChild variant="accent">
              <Link href="/dashboard/dossiers/new">
                Créer une mission <ArrowRight className="size-4" />
              </Link>
            </Button>
          }
        />
      </div>

      <Card variant="flat" padding="default">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-full overflow-hidden border border-rule shrink-0 relative">
              <Image
                src="/benjamin-bel-fondateur-kovas.jpg"
                alt="Benjamin Bel, fondateur de KOVAS"
                fill
                sizes="48px"
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[#34C759]" />
                Une question, un retour ?
              </CardTitle>
              <CardDescription className="mt-1.5">
                Pendant les 14 premiers jours, Benjamin (fondateur) lit chaque message
                personnellement. Écris à{' '}
                <a href="mailto:contact@kovas.fr" className="underline">
                  contact@kovas.fr
                </a>
                .
              </CardDescription>
            </div>
          </div>
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
  children,
}: {
  n: number
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  bullets?: string[]
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <Card variant="flat" padding="default">
      <CardContent className="flex gap-4 items-start">
        <div className="shrink-0 size-9 rounded-full bg-[#0F1419] text-[#D4F542] flex items-center justify-center text-sm font-semibold">
          {n}
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-[#0F1419]/72" />
            <h2 className="font-semibold text-[#0F1419]">{title}</h2>
          </div>
          <p className="text-sm text-[#0F1419]/72">{description}</p>
          {bullets && (
            <ul className="text-sm space-y-1">
              {bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-[#0F1419]/72">·</span>
                  <span className="text-[#0F1419]/82">{b}</span>
                </li>
              ))}
            </ul>
          )}
          {children}
          {actions}
        </div>
      </CardContent>
    </Card>
  )
}
