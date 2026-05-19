import { FaqAnswer } from '@/components/faq-answer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FAQ_LANDING } from '@/lib/faq-data'
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  FileText,
  Mic,
  Share2,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

/**
 * KOVAS — Landing page marketing (kovas.fr/)
 * Avatar client : diagnostiqueur 43 ans, ex-cadre. Ton SOBRE PROFESSIONNEL.
 * Cf. docs/avatar-client.md
 */
export default function HomePage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Stats />
        <Features />
        <HowItWorks />
        <PricingTeaser />
        <LandingFaq />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  )
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 glass-header">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="size-8 rounded-md bg-cta shadow-cta" aria-hidden />
          <span className="text-base font-bold tracking-tight">KOVAS</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-6 text-sm">
          <Link
            href="/#features"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Fonctionnalités
          </Link>
          <Link
            href="/pricing"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Tarifs
          </Link>
          <Link
            href="/faq"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            FAQ
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Se connecter</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">Essai 14j</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative px-6 py-20 sm:py-28 md:py-32 overflow-hidden">
      {/* Halo navy subtil derrière le titre, sans surcharger */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[500px] bg-[radial-gradient(ellipse_at_center,hsl(var(--cta)/0.06),transparent_60%)]"
      />
      <div className="mx-auto max-w-3xl text-center space-y-8">
        <Badge variant="outline" className="mx-auto">
          Pour les diagnostiqueurs immobiliers indépendants
        </Badge>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
          3 heures de DPE.
          <br />
          <span className="text-muted-foreground">30 minutes avec KOVAS.</span>
        </h1>
        <p className="text-lg text-muted-foreground sm:text-xl max-w-2xl mx-auto">
          Saisie vocale terrain, photos géolocalisées, exports universels. Compagnon de votre
          logiciel actuel — Liciel, AnalysImmo ou autre.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button size="lg" asChild>
            <Link href="/signup">
              Commencer mon essai 14 jours <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="ghost" asChild>
            <Link href="/#how-it-works">Voir comment ça marche</Link>
          </Button>
        </div>
        <p className="text-sm text-subtle-foreground">
          Sans carte bancaire · 30 missions incluses · 8 diagnostics couverts
        </p>
      </div>
    </section>
  )
}

function Stats() {
  const stats = [
    { value: '1h30', label: 'gagnée par mission DPE typique' },
    { value: '92%', label: 'des diagnostics standards français couverts' },
    { value: '< 30s', label: 'pour partager vers votre logiciel principal' },
  ]
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <Card className="grid grid-cols-1 sm:grid-cols-3 gap-8 p-10">
          {stats.map((s) => (
            <div key={s.label} className="text-center space-y-1">
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">{s.value}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </Card>
      </div>
    </section>
  )
}

function Features() {
  const features = [
    {
      icon: Mic,
      title: 'Saisie vocale terrain',
      description:
        "Décrivez l'état d'une pièce à voix haute. KOVAS structure les données automatiquement (Whisper + IA hybride à 0,01€/mission).",
    },
    {
      icon: Camera,
      title: 'Photos géolocalisées',
      description:
        'Capturez équipements, défauts, étiquettes énergétiques. Géolocalisation EXIF + annotations basiques intégrées.',
    },
    {
      icon: Share2,
      title: 'Bouton « Partager »',
      description:
        "3 modes vers votre logiciel principal : email, Google Drive auto-sync, téléchargement direct. 30 secondes au lieu d'1h30 de re-saisie.",
    },
    {
      icon: FileText,
      title: 'Exports universels',
      description:
        'PDF, Word, CSV, JSON, ZIP Liciel. Aucune dépendance à un éditeur unique — vos données sont à vous.',
    },
    {
      icon: CheckCircle2,
      title: 'Validation cohérence',
      description:
        'Règles métier intégrées. KOVAS détecte les incohérences avant export (« Surface 100m² + chaudière 5kW = à vérifier »).',
    },
    {
      icon: ShieldCheck,
      title: 'RGPD & hébergement EU',
      description:
        'Supabase Paris (eu-west-3), Vercel Europe, chiffrement bout-en-bout. Conformité dès le démarrage.',
    },
  ]

  return (
    <section id="features" className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="muted">10 fonctionnalités cœur</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Le terrain plus rapide. Le retour bureau quasi inutile.
          </h2>
          <p className="text-muted-foreground">
            KOVAS ne remplace pas Liciel en Phase 1. Il le complète, élimine la friction terrain et
            vous fait gagner 1h30 par mission.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <div className="size-9 rounded-md bg-muted flex items-center justify-center mb-2">
                  <f.icon className="size-4" />
                </div>
                <CardTitle className="text-base">{f.title}</CardTitle>
                <CardDescription>{f.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    {
      n: '1',
      title: 'Sur place',
      description:
        'Vous démarrez une mission depuis votre iPad ou iPhone. Saisie vocale par pièce, photos automatiquement géolocalisées, templates T2/T3/T4 pré-remplis.',
    },
    {
      n: '2',
      title: 'Validation',
      description:
        "KOVAS détecte les incohérences et incomplétudes. « Tu n'as pas saisi la VMC, c'est volontaire ? » Avant export, pas après.",
    },
    {
      n: '3',
      title: 'Export & partage',
      description:
        'Un bouton, trois modes : email vers vous-même, sync Google Drive automatique, téléchargement direct. Import dans Liciel en 30 secondes.',
    },
  ]
  return (
    <section id="how-it-works" className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl space-y-12">
        <div className="text-center space-y-3 max-w-xl mx-auto">
          <Badge variant="muted">Workflow</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            De la visite au logiciel principal. Sans re-saisie.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((s) => (
            <Card key={s.n} className="p-6 space-y-3">
              <div className="size-10 rounded-full bg-cta text-cta-foreground flex items-center justify-center text-base font-bold shadow-cta">
                {s.n}
              </div>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.description}</p>
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
      <div className="mx-auto max-w-3xl text-center space-y-8">
        <div className="space-y-3">
          <Badge variant="muted">Tarification</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            À partir de 29€/mois. Sans engagement.
          </h2>
          <p className="text-muted-foreground">
            Découverte (20 missions), Standard (60 missions, recommandé), Volume (150 missions).
            Surplus à l'usage si vous dépassez, plafond mensuel auto-protecteur activable.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" variant="outline" asChild>
            <Link href="/pricing">
              Voir les 3 tiers <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" asChild>
            <Link href="/signup">Commencer l'essai</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function LandingFaq() {
  return (
    <section id="faq" className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl space-y-10">
        <div className="text-center space-y-3">
          <Badge variant="muted">FAQ</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Les questions les plus posées
          </h2>
          <p className="text-muted-foreground">
            5 réponses essentielles avant de démarrer. La FAQ complète est disponible sur{' '}
            <Link href="/faq" className="text-foreground underline-offset-4 hover:underline">
              kovas.fr/faq
            </Link>
            .
          </p>
        </div>
        <div className="space-y-3">
          {FAQ_LANDING.map((q) => (
            <Card key={q.id} className="p-0 overflow-hidden">
              <details className="group">
                <summary className="cursor-pointer list-none px-5 py-4 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors">
                  <h3 className="text-base font-semibold flex-1 min-w-0">{q.question}</h3>
                  <span
                    aria-hidden
                    className="text-muted-foreground shrink-0 transition-transform group-open:rotate-180"
                  >
                    ▾
                  </span>
                </summary>
                <div className="px-5 pb-5 pt-1 border-t border-border/50">
                  <FaqAnswer markdown={q.answer} />
                </div>
              </details>
            </Card>
          ))}
        </div>
        <div className="text-center">
          <Button variant="outline" asChild>
            <Link href="/faq">Voir toutes les questions</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function FinalCTA() {
  return (
    <section className="px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl">
        <Card variant="accent" className="p-10 sm:p-14 text-center space-y-6">
          <Zap className="size-10 mx-auto text-card-accent-foreground/80" />
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Prêt à gagner 1h30 par mission ?
          </h2>
          <p className="text-card-accent-foreground/70">
            Essai gratuit 14 jours, sans carte bancaire. 30 missions complètes pour vous faire votre
            propre opinion.
          </p>
          <Button size="lg" variant="outline" asChild className="bg-card text-foreground">
            <Link href="/signup">
              Commencer mon essai <ArrowRight className="size-4" />
            </Link>
          </Button>
        </Card>
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    <footer className="px-6 py-10 border-t border-border">
      <div className="mx-auto max-w-6xl flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-sm text-subtle-foreground">
        <p>© 2026 SASU Nexus 1993 · 66 Av Champs Elysées, 75008 Paris · SIREN 982 786 154</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/faq" className="hover:text-foreground transition-colors">
            FAQ
          </Link>
          <Link href="/mentions-legales" className="hover:text-foreground transition-colors">
            Mentions légales
          </Link>
          <Link href="/cgu" className="hover:text-foreground transition-colors">
            CGU
          </Link>
          <Link href="/confidentialite" className="hover:text-foreground transition-colors">
            Confidentialité
          </Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  )
}
