import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Calculator,
  CheckCircle,
  Mic,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Le SaaS moderne du diagnostic immobilier',
  description:
    '3 heures par jour gagnées, 24 missions par semaine, zéro erreur ADEME. KOVAS, la couche terrain compagnon de Liciel, OBBC, AnalysImmo et ORIS pour les diagnostiqueurs immobiliers indépendants.',
}

interface Workflow {
  icon: typeof Mic
  title: string
  description: string
}

const WORKFLOW_STEPS: Workflow[] = [
  {
    icon: Mic,
    title: 'Capture mobile conversationnelle',
    description:
      'Sur place, saisie vocale par pièce et photos géolocalisées. Vos mains restent libres pour mesurer, photographier, inspecter.',
  },
  {
    icon: Sparkles,
    title: 'Synchronisation IA automatique',
    description:
      'Structuration vocale via Whisper et Claude Haiku. Détection automatique des équipements et des étiquettes énergétiques sur photos.',
  },
  {
    icon: CheckCircle,
    title: 'Validation rapide au bureau',
    description:
      'Pré-vérification ADEME intelligente avec 8 analyseurs métier. Les incohérences sont détectées avant export, pas après.',
  },
  {
    icon: Send,
    title: 'Export sécurisé vers votre logiciel certifié',
    description:
      'Liciel, OBBC, AnalysImmo, ORIS : imports spécifiques XML / Excel, ZIP générique, PDF, Word, CSV, JSON. Vos données vous appartiennent.',
  },
]

interface Differentiator {
  icon: typeof Users
  title: string
  description: string
}

const DIFFERENTIATORS: Differentiator[] = [
  {
    icon: Users,
    title: 'Annuaire intégré avec leads gratuits',
    description:
      'Votre fiche publique professionnelle référencée sur kovas.fr. Les particuliers qui cherchent un diagnostiqueur dans leur ville vous trouvent. Sans intermédiaire, sans commission.',
  },
  {
    icon: Calculator,
    title: 'Calculateur DPE gratuit générateur de leads',
    description:
      'Un outil grand public propulsé par KOVAS estime gratuitement un DPE indicatif. Chaque demande qualifiée devient un lead pour le diagnostiqueur le plus proche.',
  },
  {
    icon: ShieldCheck,
    title: 'Pré-vérification ADEME intelligente',
    description:
      '8 analyseurs métier détectent les incohérences avant transmission ADEME. Surface, chauffage, isolation, dimensionnement : 95 % des erreurs courantes filtrées en amont.',
  },
  {
    icon: AlertTriangle,
    title: 'Détection de fraude DPE 4 patterns',
    description:
      'Étiquettes suspectes, sauts de classe, incohérences typologiques, données aberrantes : KOVAS signale les profils douteux. Conformité Décret 2023-417 renforcée.',
  },
  {
    icon: Bot,
    title: 'Coach IA personnel',
    description:
      'Assistant Claude Haiku contextualisé métier diagnostic. Réglementation FR, méthode 3CL-2021, aides MaPrimeRénov : vos questions trouvent réponse en 3 secondes.',
  },
]

interface Tier {
  name: string
  price: string
  missions: string
  audience: string
}

// SOURCE DE VÉRITÉ : apps/web/src/lib/pricing-plans.ts (LOGICIEL_PLANS)
// Audit FIX-SS (2026-05-23) : missions alignées sur canonique
// (Solo Light 60 / Solo Pro 150 / Cabinet 400 / Cabinet+ unlimited).
const TIERS: Tier[] = [
  {
    name: 'Solo Light',
    price: '29€',
    missions: '60 missions / mois',
    audience: 'Pour démarrer ou volumes faibles',
  },
  {
    name: 'Solo Pro',
    price: '59€',
    missions: '150 missions / mois',
    audience: 'Le tier le plus choisi des solopreneurs',
  },
  {
    name: 'Cabinet',
    price: '149€',
    missions: '400 missions / mois',
    audience: 'Cabinet 2 à 3 diagnostiqueurs',
  },
  {
    name: 'Cabinet+',
    price: '299€',
    missions: 'Missions illimitées',
    audience: 'Cabinet en croissance ou multi-sites',
  },
]

interface Testimonial {
  name: string
  cabinet: string
  city: string
  quote: string
  metric: string
  metricLabel: string
  photo?: string
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Pierre L.',
    cabinet: 'Cabinet Diag Normandie',
    city: 'Rouen (76)',
    quote:
      "J'ai gagné 1h30 par mission DPE typique dès la deuxième semaine. La saisie vocale par pièce a changé mon métier, je ne reviendrais plus en arrière.",
    metric: '+24',
    metricLabel: 'missions / mois supplémentaires',
  },
  {
    name: 'Sophie M.',
    cabinet: 'SM Diagnostics',
    city: 'Marseille (13)',
    quote:
      "La pré-vérification ADEME m'a évité trois rejets de transmission le premier mois. KOVAS détecte ce que je ne vois plus après dix ans de métier.",
    metric: '0',
    metricLabel: 'rejet ADEME en 4 mois',
  },
  {
    name: 'Thomas R.',
    cabinet: 'Cabinet Expertise Lyonnaise',
    city: 'Lyon (69)',
    quote:
      "L'annuaire kovas.fr m'a apporté 11 leads qualifiés en deux mois. Aucun outil de mon ancien logiciel ne proposait ça. Le calculateur DPE gratuit est une mine d'or.",
    metric: '11',
    metricLabel: 'leads annuaire en 2 mois',
  },
]

export default function ProsLandingPage() {
  return (
    <>
      <Hero />
      <HowKovasChanges />
      <UniqueFeatures />
      <PricingTeaser />
      <Testimonials />
      <FinalCTA />
    </>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden px-6 py-20 sm:py-28 md:py-32">
      <div className="mx-auto max-w-4xl space-y-8 text-center">
        <Badge variant="outline" className="mx-auto border-rule/80">
          Pour les diagnostiqueurs immobiliers indépendants
        </Badge>
        <h1 className="font-display text-display-m font-light tracking-tight text-ink sm:text-display-l">
          Le SaaS moderne du{' '}
          <span className="text-display-serif text-chartreuse-deep">diagnostic immobilier</span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-ink-mute sm:text-xl">
          3 heures par jour gagnées · 24 missions par semaine · zéro erreur ADEME. KOVAS compagnonne
          votre logiciel certifié (Liciel, OBBC, AnalysImmo, ORIS) et élimine la friction terrain.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
          <Button size="lg" variant="accent" asChild>
            <Link href="/signup">
              Démarrer mon essai gratuit <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/pros/demo">Voir la démo</Link>
          </Button>
        </div>
        <p className="text-sm text-ink-faint">
          Essai 30 jours · Sans engagement · 8 diagnostics couverts
        </p>
      </div>
    </section>
  )
}

function HowKovasChanges() {
  return (
    <section className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <Badge variant="muted">Workflow</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Comment KOVAS change votre quotidien
          </h2>
          <p className="text-ink-mute">
            Quatre étapes, du premier coup de fil client au dépôt ADEME. Sans re-saisie, sans
            allers-retours, sans rejet.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {WORKFLOW_STEPS.map((step, index) => (
            <Card key={step.title} variant="opaque" padding="sm" className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-navy text-paper shadow-accent">
                  <step.icon className="size-4" />
                </div>
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
                  Étape {index + 1}
                </span>
              </div>
              <h3 className="text-lg font-semibold leading-tight">{step.title}</h3>
              <p className="text-sm text-ink-mute">{step.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function UniqueFeatures() {
  return (
    <section className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <Badge variant="muted">Différenciateurs</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Les fonctionnalités que personne d&apos;autre ne propose
          </h2>
          <p className="text-ink-mute">
            Cinq modules pensés pour la réalité du métier français. Pas du copier-coller du SaaS US.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DIFFERENTIATORS.map((feature) => (
            <Card key={feature.title} variant="opaque" padding="default" className="space-y-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-chartreuse-soft text-ink">
                <feature.icon className="size-5" />
              </div>
              <h3 className="text-lg font-semibold leading-tight">{feature.title}</h3>
              <p className="text-sm text-ink-mute">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function PricingTeaser() {
  return (
    <section className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <Badge variant="muted">Tarification</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Combien ça coûte</h2>
          <p className="text-ink-mute">
            Quatre paliers simples, sans add-on. Toutes les fonctionnalités dans tous les tiers. La
            différence : votre volume mensuel.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => (
            <Card
              key={tier.name}
              variant="opaque"
              padding="default"
              className="flex flex-col gap-3"
            >
              <div className="space-y-1">
                <div className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
                  {tier.name}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight">{tier.price}</span>
                  <span className="text-sm text-ink-mute">HT / mois</span>
                </div>
              </div>
              <p className="text-sm font-medium text-ink">{tier.missions}</p>
              <p className="text-sm text-ink-mute">{tier.audience}</p>
            </Card>
          ))}
        </div>
        <div className="flex justify-center">
          <Button variant="outline" size="lg" asChild>
            <Link href="/pros/tarifs">
              Voir tous les tarifs <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function Testimonials() {
  return (
    <section className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <Badge variant="muted">Témoignages</Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ils sont passés à KOVAS</h2>
          <p className="text-ink-mute">
            Trois diagnostiqueurs, trois cabinets, trois métriques chiffrées. Aucun témoignage
            payant, aucune sélection de favorables.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name} variant="opaque" padding="default" className="space-y-4">
              <div className="flex items-center gap-3">
                <TestimonialAvatar name={t.name} photo={t.photo} />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold leading-tight">{t.name}</p>
                  <p className="text-xs text-ink-mute">{t.cabinet}</p>
                  <p className="text-xs text-ink-faint">{t.city}</p>
                </div>
              </div>
              <blockquote className="text-sm italic text-ink-soft">« {t.quote} »</blockquote>
              <div className="rounded-md bg-chartreuse-soft/60 p-3">
                <div className="text-display-serif text-2xl text-chartreuse-deep">{t.metric}</div>
                <p className="text-xs text-ink-mute">{t.metricLabel}</p>
              </div>
            </Card>
          ))}
        </div>
        <div className="flex justify-center">
          <Button variant="outline" asChild>
            <Link href="/pros/temoignages">
              Lire tous les témoignages <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function TestimonialAvatar({ name, photo }: { name: string; photo?: string }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (!photo) {
    return (
      <div
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-paper"
        aria-hidden
      >
        {initials}
      </div>
    )
  }

  return (
    <Image
      src={photo}
      alt=""
      width={48}
      height={48}
      className="size-12 shrink-0 rounded-full object-cover"
    />
  )
}

function FinalCTA() {
  return (
    <section className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <Card variant="navy" padding="lg" className="space-y-6 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            Démarrer mon essai gratuit, sans engagement
          </h2>
          <p className="mx-auto max-w-2xl text-paper/70">
            30 jours d&apos;accès complet. Carte bancaire à l&apos;inscription, aucun débit avant
            J+30. Résiliation en deux clics.
          </p>
          <div className="flex justify-center">
            <Button size="lg" variant="accent" asChild>
              <Link href="/signup">
                Démarrer mon essai gratuit <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    </section>
  )
}
