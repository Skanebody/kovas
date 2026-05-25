import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { StructuredData } from '@/components/seo/structured-data'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ANNUAIRE_PLANS, LOGICIEL_PLANS, UNLIMITED_CAP } from '@/lib/pricing-plans'
import {
  type PricingPlanMeta,
  getBreadcrumbListSchema,
  getProductSchema,
} from '@/lib/seo/structured-data'
import { Check } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

/**
 * Page /pricing publique — harmonisée sur la source canonique.
 *
 * SOURCE DE VÉRITÉ : `apps/web/src/lib/pricing-plans.ts`
 *   - LOGICIEL_PLANS (4 tiers payants V5 :
 *       Solo 29 € · Pro 79 € · Cabinet 199 € · Cabinet+ 499 €)
 *   - ANNUAIRE_PLANS (4 paliers visibilité :
 *       Gratuit · Présence 19 € · Boost 39 € · Premium 79 €)
 *
 * Ne PAS dupliquer les chiffres ici — tout est dérivé du canonique. Si
 * modification, modifier `pricing-plans.ts`.
 *
 * Audit V5 (2026-05-25) : nouvelle grille — Solo 29 / Pro 79 / Cabinet 199 /
 * Cabinet+ 499 €. Renames Solo Light → Solo, Solo Pro → Pro.
 */

export const metadata: Metadata = {
  title: 'Tarifs — Solo 29€ · Pro 79€ · Cabinet 199€ · Cabinet+ 499€',
  description:
    'Solo 29€, Pro 79€, Cabinet 199€, Cabinet+ 499€ par mois HT. Essai gratuit 30 jours avec CB, sans engagement, résiliable à tout moment. 8 diagnostics, exports universels.',
  alternates: { canonical: 'https://kovas.fr/pricing' },
  openGraph: {
    title: 'Tarifs KOVAS — à partir de 29€/mois',
    description:
      'Solo, Pro, Cabinet, Cabinet+ — 4 forfaits transparents, sans engagement, résiliable à tout moment.',
    url: 'https://kovas.fr/pricing',
    siteName: 'KOVAS',
    locale: 'fr_FR',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Tarifs KOVAS' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tarifs KOVAS — à partir de 29€/mois',
    description: '4 forfaits transparents pour diagnostiqueurs indépendants. Essai 30 jours.',
    images: ['/og-image.png'],
  },
}

/** Affichage missions : "Illimitées" si UNLIMITED_CAP, sinon "N missions". */
function formatMissions(missions: number): string {
  return missions >= UNLIMITED_CAP ? 'Missions illimitées' : `${missions} missions`
}

/** 4 tiers payants Logiciel (exclut le code `essai` qui est le mode trial). */
const LOGICIEL_PAID_TIERS = LOGICIEL_PLANS.filter((plan) => plan.code !== 'essai')

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

/** Métadonnées Schema.org Offer dérivées du canonique (centimes → euros). */
const PLAN_META: ReadonlyArray<PricingPlanMeta> = LOGICIEL_PAID_TIERS.map((plan) => ({
  code: plan.code,
  name: plan.name,
  priceEurMonthly: Math.round(plan.monthlyPrice / 100),
  description: plan.tagline,
  features: plan.features.slice(0, 3) as string[],
}))

interface FaqItem {
  question: string
  answer: string
}

const FAQ: FaqItem[] = [
  {
    question: 'Que se passe-t-il si je dépasse mon quota mensuel ?',
    answer:
      "Les caps sont en fair-use : aucun blocage brutal. À 80 % du quota, vous recevez une notification. À 100 %, vous pouvez continuer en mode dégradé léger. Au-delà de 150 % deux mois consécutifs, nous vous suggérons la formule supérieure (plus économique pour votre profil). Aucune carte bancaire n'est redemandée.",
  },
  {
    question: "Puis-je changer de tier en cours d'abonnement ?",
    answer:
      'Oui, depuis votre compte, à tout moment. Le changement est appliqué au prorata du mois en cours, sans pénalité. Le downgrade prend effet à la fin du cycle de facturation.',
  },
  {
    question: 'Y a-t-il un engagement ?',
    answer:
      "Aucun. Résiliation libre depuis le Customer Portal Stripe en deux clics. L'annuel offre 2 mois gratuits (10 mois payés sur 12).",
  },
  {
    question: "L'essai gratuit nécessite-t-il une carte bancaire ?",
    answer:
      "Oui, l'essai 30 jours requiert une carte bancaire à l'inscription (Stripe Checkout setup_intent). Aucun débit avant J+30. Vous pouvez résilier à tout moment pendant la période d'essai depuis votre compte.",
  },
  {
    question: 'Les tarifs incluent-ils la TVA ?',
    answer:
      'Non, tous les tarifs affichés sont HT. La TVA française 20 % est facturée en sus pour les clients FR. Les clients UE assujettis avec numéro TVA intracommunautaire valide sont exonérés (autoliquidation).',
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
      <PublicHeader />

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {LOGICIEL_PAID_TIERS.map((tier) => {
            const priceEuros = Math.round(tier.monthlyPrice / 100)
            const isUnlimited = tier.caps.missions >= UNLIMITED_CAP
            return (
              <Card
                key={tier.code}
                variant="opaque"
                padding="default"
                className={tier.featured ? 'border-navy/30 shadow-accent relative' : ''}
              >
                {tier.featured && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Recommandé</Badge>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <CardDescription>{tier.tagline}</CardDescription>
                  <div className="pt-4">
                    <div className="text-4xl font-bold tracking-tight">{priceEuros}€</div>
                    <div className="text-sm text-ink-mute">HT / mois</div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    <li className="flex gap-2">
                      <Check className="size-4 mt-0.5 shrink-0" />
                      <span>
                        <strong>{formatMissions(tier.caps.missions)}</strong>
                        {!isUnlimited && ' incluses par mois'}
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="size-4 mt-0.5 shrink-0" />
                      <span>{tier.caps.storageGb} Go de stockage</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="size-4 mt-0.5 shrink-0" />
                      <span>
                        {tier.caps.users === 1
                          ? '1 utilisateur'
                          : `Jusqu'à ${tier.caps.users} utilisateurs`}
                      </span>
                    </li>
                  </ul>
                  <Button className="w-full" variant={tier.featured ? 'warm' : 'glass'} asChild>
                    <Link href="/signup">Commencer {tier.name}</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
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

        <section className="space-y-6">
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <Badge variant="muted">Annuaire kovas.fr</Badge>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Visibilité auprès des particuliers
            </h2>
            <p className="text-sm text-ink-mute">
              Boostez votre fiche annuaire pour recevoir des leads particuliers du calculateur DPE.
              Quatre paliers cumulables avec votre abonnement logiciel.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ANNUAIRE_PLANS.map((plan) => {
              const priceEuros = Math.round(plan.monthlyPrice / 100)
              const isFree = plan.monthlyPrice === 0
              return (
                <Card
                  key={plan.code}
                  variant="opaque"
                  padding="default"
                  className={plan.featured ? 'border-navy/30 shadow-accent' : ''}
                >
                  <div className="space-y-1">
                    <div className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
                      {plan.name}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold tracking-tight">
                        {isFree ? 'Gratuit' : `${priceEuros}€`}
                      </span>
                      {!isFree && <span className="text-xs text-ink-mute">HT / mois</span>}
                    </div>
                  </div>
                  <p className="text-sm text-ink-mute mt-2">{plan.tagline}</p>
                  <p className="text-xs text-ink-faint pt-2 font-mono">
                    {plan.leadsPerMonth === 0
                      ? 'Lecture seule'
                      : `${plan.leadsPerMonth} leads / mois`}
                  </p>
                </Card>
              )
            })}
          </div>
        </section>

        <Card variant="opaque" padding="default" className="mx-auto max-w-2xl space-y-3">
          <h3 className="font-semibold">Options ponctuelles (paiement à l'usage)</h3>
          <ul className="space-y-2 text-sm text-ink-mute">
            <li>
              · Signature eIDAS Yousign — <strong className="text-ink">2€/signature</strong>
            </li>
            <li>
              · Rapport bilingue FR/EN — <strong className="text-ink">5€/rapport</strong>
            </li>
            <li>
              · SMS rappel client J-1 — <strong className="text-ink">0,15€/SMS</strong>
            </li>
          </ul>
          <p className="text-xs text-ink-faint pt-2">
            Aucun pack mensuel obligatoire — vous ne payez que ce que vous utilisez.
          </p>
        </Card>

        <section className="mx-auto max-w-3xl space-y-6">
          <div className="space-y-2 text-center">
            <Badge variant="muted">FAQ tarifs</Badge>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Vos questions sur les tarifs
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <Card key={item.question} variant="opaque" padding="default" className="space-y-2">
                <h3 className="text-base font-semibold">{item.question}</h3>
                <p className="text-sm text-ink-mute">{item.answer}</p>
              </Card>
            ))}
          </div>
        </section>

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
