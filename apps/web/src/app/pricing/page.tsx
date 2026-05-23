import { StructuredData } from '@/components/seo/structured-data'
import { SiteFooter } from '@/components/site-footer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type PricingPlanMeta,
  getBreadcrumbListSchema,
  getProductSchema,
} from '@/lib/seo/structured-data'
import { Check } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Tarifs — Découverte 29€ · Standard 59€ · Volume 99€',
  description:
    'Solo Light 29€, Solo Pro 59€, Cabinet 149€, Cabinet+ 299€ par mois HT. Essai gratuit 30 jours avec CB, sans engagement, résiliable à tout moment. 8 diagnostics, exports universels.',
  alternates: { canonical: 'https://kovas.fr/pricing' },
  openGraph: {
    title: 'Tarifs KOVAS 360 — à partir de 29€/mois',
    description:
      'Solo Light, Solo Pro, Cabinet, Cabinet+ — 4 forfaits transparents, sans engagement, résiliable à tout moment.',
    url: 'https://kovas.fr/pricing',
    siteName: 'KOVAS',
    locale: 'fr_FR',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Tarifs KOVAS' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tarifs KOVAS 360 — à partir de 29€/mois',
    description: '4 forfaits transparents pour diagnostiqueurs indépendants. Essai 30 jours.',
    images: ['/og-image.png'],
  },
}

interface Tier {
  name: string
  price: string
  missions: number
  surplus: string
  storage: string
  description: string
  highlighted?: boolean
  cta: string
}

const PHASE_1_TIERS: Tier[] = [
  {
    name: 'Découverte',
    price: '29€',
    missions: 20,
    surplus: '2,00€/mission',
    storage: '20 Go',
    description: 'Pour démarrer ou pour les petits volumes',
    cta: 'Commencer Découverte',
  },
  {
    name: 'Standard',
    price: '59€',
    missions: 60,
    surplus: '1,50€/mission',
    storage: '50 Go',
    description: 'Le tier le plus choisi par les solopreneurs',
    highlighted: true,
    cta: 'Commencer Standard',
  },
  {
    name: 'Volume',
    price: '99€',
    missions: 150,
    surplus: '1,00€/mission',
    storage: '100 Go',
    description: 'Pour les power users en cabinet solo',
    cta: 'Commencer Volume',
  },
]

const INCLUDED_FEATURES = [
  '8 diagnostics standards (DPE, amiante, plomb, gaz, électricité, termites, Carrez/Boutin, ERP)',
  'Saisie vocale terrain illimitée',
  'Photos géolocalisées illimitées',
  'Exports universels (PDF, Word, CSV, JSON) + compatibilité Liciel · OBBC · AnalysImmo · ORIS',
  'Bouton Partager 3 modes',
  'Sync iPad / iPhone / Web temps réel',
  'Mode offline complet',
  'Templates pièces + check-lists',
  'Validation cohérence avant export',
  'Hébergement EU (Paris), conformité RGPD',
  'Support email sous 24h',
]

const PLAN_META: ReadonlyArray<PricingPlanMeta> = [
  {
    code: 'decouverte',
    name: 'Découverte',
    priceEurMonthly: 29,
    description: '20 missions/mois, surplus 2€. Pour démarrer ou petits volumes.',
    features: ['20 missions/mois', 'Surplus 2€/mission', '20 Go stockage'],
  },
  {
    code: 'standard',
    name: 'Standard',
    priceEurMonthly: 59,
    description: '60 missions/mois, surplus 1,50€. Le tier le plus choisi par les solopreneurs.',
    features: ['60 missions/mois', 'Surplus 1,50€/mission', '50 Go stockage'],
  },
  {
    code: 'volume',
    name: 'Volume',
    priceEurMonthly: 99,
    description: '150 missions/mois, surplus 1€. Pour les power users en cabinet solo.',
    features: ['150 missions/mois', 'Surplus 1€/mission', '100 Go stockage'],
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-cream">
      {PLAN_META.map((plan) => (
        <StructuredData
          key={plan.code}
          schema={getProductSchema(plan)}
          id={`ld-product-${plan.code}`}
        />
      ))}
      <StructuredData
        schema={getBreadcrumbListSchema([
          { name: 'Accueil', url: 'https://kovas.fr/' },
          { name: 'Tarifs', url: 'https://kovas.fr/pricing' },
        ])}
        id="ld-breadcrumb"
      />
      <header className="glass-header sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-navy" aria-hidden />
            <span className="text-base font-semibold tracking-tight">KOVAS</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Se connecter</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Essai 30j</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-6xl w-full px-6 py-16 space-y-16">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="muted">Sans engagement</Badge>
          <h1 className="font-display font-light text-display-m sm:text-display-l tracking-tight text-ink">
            Tarification simple, sans surprise.
          </h1>
          <p className="text-ink-mute">
            Toutes les fonctionnalités dans tous les tiers. La différence : votre volume mensuel.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PHASE_1_TIERS.map((tier) => (
            <Card
              key={tier.name}
              variant="opaque"
              padding="default"
              className={tier.highlighted ? 'border-navy/30 shadow-accent relative' : ''}
            >
              {tier.highlighted && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Recommandé</Badge>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <div className="pt-4">
                  <div className="text-4xl font-bold tracking-tight">{tier.price}</div>
                  <div className="text-sm text-ink-mute">HT / mois</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <Check className="size-4 mt-0.5 shrink-0" />
                    <span>
                      <strong>{tier.missions} missions</strong> incluses par mois
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="size-4 mt-0.5 shrink-0" />
                    <span>Surplus : {tier.surplus}</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="size-4 mt-0.5 shrink-0" />
                    <span>{tier.storage} de stockage</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="size-4 mt-0.5 shrink-0" />
                    <span>1 utilisateur</span>
                  </li>
                </ul>
                <Button className="w-full" variant={tier.highlighted ? 'warm' : 'glass'} asChild>
                  <Link href="/signup">{tier.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mx-auto max-w-3xl space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight text-center">
            Inclus dans tous les tiers
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {INCLUDED_FEATURES.map((feature) => (
              <li key={feature} className="flex gap-2">
                <Check className="size-4 mt-0.5 shrink-0 text-accent-green" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <Card variant="opaque" padding="default" className="mx-auto max-w-2xl space-y-3">
          <h3 className="font-semibold">Options ponctuelles (paiement à l'usage)</h3>
          <ul className="space-y-2 text-sm text-ink-mute">
            <li>
              • Signature eIDAS Yousign — <strong className="text-ink">2€/signature</strong>
            </li>
            <li>
              • Rapport bilingue FR/EN — <strong className="text-ink">5€/rapport</strong>
            </li>
            <li>
              • SMS rappel client J-1 — <strong className="text-ink">0,15€/SMS</strong>
            </li>
          </ul>
          <p className="text-xs text-ink-faint pt-2">
            Aucun pack mensuel obligatoire — vous ne payez que ce que vous utilisez.
          </p>
        </Card>

        <div className="text-center space-y-3 max-w-xl mx-auto">
          <p className="text-sm text-ink-mute">
            <strong>Annuel : 2 mois offerts</strong> (10 mois payés sur 12) sur tous les tiers.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
