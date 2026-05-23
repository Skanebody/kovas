import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowRight, Check } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Tarifs',
  description:
    'Quatre paliers Solo Light 29€, Solo Pro 59€, Cabinet 149€, Cabinet+ 299€ HT par mois. Bundles annuaire et options ponctuelles. TVA 20 %.',
}

interface Tier {
  name: string
  price: string
  missions: number
  surplus: string
  storage: string
  users: string
  description: string
  highlighted?: boolean
  cta: string
}

const TIERS: Tier[] = [
  {
    name: 'Solo Light',
    price: '29€',
    missions: 20,
    surplus: '2,00€ / mission',
    storage: '20 Go',
    users: '1 utilisateur',
    description: 'Pour démarrer ou pour les très faibles volumes.',
    cta: 'Commencer Solo Light',
  },
  {
    name: 'Solo Pro',
    price: '59€',
    missions: 60,
    surplus: '1,50€ / mission',
    storage: '50 Go',
    users: '1 utilisateur',
    description: 'Le tier le plus choisi par les solopreneurs.',
    highlighted: true,
    cta: 'Commencer Solo Pro',
  },
  {
    name: 'Cabinet',
    price: '149€',
    missions: 200,
    surplus: '1,00€ / mission',
    storage: '200 Go',
    users: "jusqu'à 3 utilisateurs",
    description: 'Cabinet 2 à 3 diagnostiqueurs.',
    cta: 'Commencer Cabinet',
  },
  {
    name: 'Cabinet+',
    price: '299€',
    missions: 500,
    surplus: '0,80€ / mission',
    storage: '500 Go',
    users: "jusqu'à 6 utilisateurs",
    description: 'Cabinet en croissance ou multi-sites.',
    cta: 'Commencer Cabinet+',
  },
]

const INCLUDED_FEATURES = [
  '8 diagnostics standards (DPE, amiante, plomb, gaz, électricité, termites, Carrez/Boutin, ERP)',
  'Saisie vocale terrain illimitée',
  'Photos géolocalisées illimitées',
  'Exports universels (PDF, Word, CSV, JSON) + compatibilité Liciel · OBBC · AnalysImmo · ORIS',
  'Bouton « Partager » 3 modes',
  'Sync iPad / iPhone / Web temps réel',
  'Mode offline complet',
  'Templates pièces + check-lists',
  'Pré-vérification ADEME intelligente',
  'Détection de fraude DPE 4 patterns',
  'Coach IA personnel',
  'Fiche publique annuaire kovas.fr',
  'Leads calculateur DPE gratuit',
  'Hébergement EU (Paris), conformité RGPD',
  'Support email sous 24h ouvrées',
]

interface AnnuaireBundle {
  name: string
  price: string
  description: string
}

const ANNUAIRE_BUNDLES: AnnuaireBundle[] = [
  {
    name: 'Annuaire Basique',
    price: '19€',
    description: 'Fiche publique simple, 1 ville couverte, badge KOVAS Pro.',
  },
  {
    name: 'Annuaire Standard',
    price: '29€',
    description: '3 villes couvertes, mise en avant carousel kovas.fr, statistiques leads.',
  },
  {
    name: 'Annuaire Premium',
    price: '39€',
    description: '10 villes, top de page kovas.fr/diag/votre-ville, témoignages clients.',
  },
  {
    name: 'Annuaire Pro Multi',
    price: '99€',
    description: 'Tout département couvert, priorité absolue, dashboard leads avancé.',
  },
]

interface OneShot {
  label: string
  price: string
}

const ONE_SHOTS: OneShot[] = [
  { label: 'Signature eIDAS Yousign', price: '2€ / signature' },
  { label: 'Rapport bilingue FR / EN', price: '5€ / rapport' },
  { label: 'SMS rappel client J-1', price: '0,15€ / SMS' },
]

interface FaqItem {
  question: string
  answer: string
}

const FAQ: FaqItem[] = [
  {
    question: 'Que se passe-t-il si je dépasse mon quota mensuel ?',
    answer:
      'Vous payez le surplus au tarif indiqué dans votre tier. Aucun blocage, aucune carte bancaire redemandée. Vous pouvez activer un plafond mensuel auto-protecteur dans votre compte.',
  },
  {
    question: "Puis-je changer de tier en cours d'abonnement ?",
    answer:
      'Oui, depuis votre compte, à tout moment. Le changement est appliqué au prorata du mois en cours, sans pénalité.',
  },
  {
    question: 'Y a-t-il un engagement ?',
    answer:
      "Aucun. Résiliation libre depuis le Customer Portal Stripe en deux clics. L'annuel offre 2 mois gratuits (10 mois payés sur 12).",
  },
  {
    question: "L'essai gratuit nécessite-t-il une carte bancaire ?",
    answer:
      "Oui, depuis le 22/05/2026, l'essai 30 jours requiert une carte bancaire à l'inscription. Aucun débit avant J+30. Vous pouvez résilier à tout moment pendant la période d'essai.",
  },
  {
    question: 'Les tarifs incluent-ils la TVA ?',
    answer:
      'Non, tous les tarifs affichés sont HT. La TVA française 20 % est facturée en sus pour les clients FR. Les clients UE assujettis avec numéro TVA intracommunautaire valide sont exonérés (autoliquidation).',
  },
]

export default function TarifsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-8 lg:px-12 py-16">
      <div className="space-y-16">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-mute">
            Tarification
          </p>
          <h1
            className="font-sans font-medium tracking-tight text-ink leading-[1.05]"
            style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}
          >
            Tarifs{' '}
            <span className="font-serif italic font-normal text-chartreuse-deep">
              transparents
            </span>
            .
          </h1>
          <p className="text-ink-mute text-lg">
            Quatre paliers, sans add-on activable. Toutes les fonctionnalités dans tous les tiers.
            La différence : votre volume mensuel.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => (
            <Card
              key={tier.name}
              variant="opaque"
              padding="default"
              className={
                tier.highlighted
                  ? 'relative border-navy/30 shadow-accent flex flex-col'
                  : 'flex flex-col'
              }
            >
              {tier.highlighted && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Recommandé</Badge>
              )}
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">{tier.name}</h3>
                <p className="text-xs text-ink-mute">{tier.description}</p>
              </div>
              <div className="pt-4">
                <div className="text-4xl font-bold tracking-tight">{tier.price}</div>
                <div className="text-xs text-ink-mute">HT / mois</div>
              </div>
              <ul className="space-y-2 pt-4 text-sm">
                <li className="flex gap-2">
                  <Check className="size-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>{tier.missions} missions</strong> incluses
                  </span>
                </li>
                <li className="flex gap-2">
                  <Check className="size-4 shrink-0 mt-0.5" />
                  <span>Surplus : {tier.surplus}</span>
                </li>
                <li className="flex gap-2">
                  <Check className="size-4 shrink-0 mt-0.5" />
                  <span>{tier.storage} de stockage</span>
                </li>
                <li className="flex gap-2">
                  <Check className="size-4 shrink-0 mt-0.5" />
                  <span>{tier.users}</span>
                </li>
              </ul>
              <div className="mt-auto pt-6">
                <Button
                  className="w-full"
                  variant={tier.highlighted ? 'accent' : 'outline'}
                  asChild
                >
                  <Link href="/signup">{tier.cta}</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <section className="mx-auto max-w-4xl space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Inclus dans tous les tiers
            </h2>
            <p className="text-sm text-ink-mute">
              Aucune fonctionnalité réservée aux tiers supérieurs. La différence porte uniquement
              sur le volume et le nombre d&apos;utilisateurs.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {INCLUDED_FEATURES.map((feature) => (
              <li key={feature} className="flex gap-2">
                <Check className="size-4 shrink-0 mt-0.5 text-chartreuse-deep" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-6">
          <div className="space-y-2 text-center">
            <Badge variant="muted">Add-on annuaire</Badge>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Bundles annuaire kovas.fr
            </h2>
            <p className="mx-auto max-w-2xl text-sm text-ink-mute">
              Boostez votre visibilité sur l&apos;annuaire grand public. Quatre paliers cumulables
              avec votre abonnement KOVAS principal.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ANNUAIRE_BUNDLES.map((bundle) => (
              <Card key={bundle.name} variant="opaque" padding="default" className="space-y-2">
                <div className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
                  {bundle.name}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight">{bundle.price}</span>
                  <span className="text-xs text-ink-mute">HT / mois</span>
                </div>
                <p className="text-sm text-ink-mute">{bundle.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <Card variant="opaque" padding="default" className="mx-auto max-w-3xl space-y-3">
          <h3 className="text-lg font-semibold">Options ponctuelles (paiement à l&apos;usage)</h3>
          <ul className="space-y-2 text-sm text-ink-mute">
            {ONE_SHOTS.map((shot) => (
              <li key={shot.label}>
                · {shot.label} — <strong className="text-ink">{shot.price}</strong>
              </li>
            ))}
          </ul>
          <p className="pt-2 text-xs text-ink-faint">
            Aucun pack mensuel obligatoire — vous ne payez que ce que vous utilisez. TVA 20 % en sus
            pour les clients FR.
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

        <div className="mx-auto max-w-3xl text-center space-y-4">
          <p className="text-sm text-ink-mute">
            <strong>Annuel : 2 mois offerts</strong> (10 mois payés sur 12) sur tous les tiers.
          </p>
          <Button size="lg" variant="accent" asChild>
            <Link href="/signup">
              Démarrer mon essai 30 jours <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
