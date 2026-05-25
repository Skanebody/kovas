import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { buildMetadata } from '@/lib/seo/metadata'
import { buildBreadcrumbList } from '@/lib/seo/schema-org'
import { getFAQPageSchema } from '@/lib/seo/structured-data'
import {
  ArrowRight,
  BookOpen,
  Clock,
  HelpCircle,
  LifeBuoy,
  Mail,
  MapPin,
  Play,
  Smartphone,
  Upload,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ComponentType } from 'react'

export const metadata: Metadata = buildMetadata({
  title: 'Aide et support diagnostiqueur immobilier | KOVAS',
  description:
    "Centre d'aide KOVAS : démarrage rapide, FAQ, tutoriels vidéo et contact direct. Réponse garantie 24 h ouvrées, 4 h sur Standard et Volume, 1 h en priorité Volume.",
  path: '/aide',
  ogImage: '/og-images/aide.png',
})

interface QuickStartCard {
  readonly icon: ComponentType<{ className?: string }>
  readonly title: string
  readonly description: string
  readonly href: string
  readonly cta: string
}

const QUICK_START: ReadonlyArray<QuickStartCard> = [
  {
    icon: Play,
    title: 'Votre premier diagnostic',
    description:
      'Créer un dossier, ajouter le bien, lancer la saisie terrain et exporter le rapport en moins de 30 minutes. Le parcours type guidé pas à pas.',
    href: '/guide',
    cta: 'Lire le guide',
  },
  {
    icon: Upload,
    title: 'Importer un dossier Liciel',
    description:
      'Reprendre une mission existante depuis votre logiciel principal : import XML, Excel ou ZIP, mapping automatique des pièces et des équipements.',
    href: '/fonctionnalites',
    cta: 'Voir les passerelles',
  },
  {
    icon: Smartphone,
    title: 'Mode mission terrain',
    description:
      'Préparer la PWA pour la visite : épingler sur l’écran d’accueil, vérifier le mode hors-ligne, calibrer le micro et activer la géolocalisation.',
    href: '/fonctionnalites',
    cta: 'Configurer le mode terrain',
  },
] as const

interface FaqItem {
  readonly question: string
  readonly answer: string
}

const FAQ_KEY: ReadonlyArray<FaqItem> = [
  {
    question: 'Combien coûte KOVAS ?',
    answer:
      'Trois tiers en Phase 1 : Découverte 29 €/mois (20 missions), Standard 59 €/mois (60 missions), Volume 99 €/mois (150 missions). Hors-quota facturé à l’usage entre 1 € et 2 € par mission selon le tier.',
  },
  {
    question: "Comment fonctionne l'essai gratuit ?",
    answer:
      '30 jours d’accès complet à toutes les fonctionnalités du forfait choisi. La carte bancaire est demandée à l’inscription via Stripe Checkout ; aucun débit avant J+30. Vous pouvez résilier à tout moment depuis votre espace abonnement.',
  },
  {
    question: 'Puis-je résilier à tout moment ?',
    answer:
      'Oui. La résiliation est accessible en deux clics depuis votre espace abonnement, sans frais ni durée d’engagement. Votre forfait reste actif jusqu’à la fin de la période payée puis votre compte passe en lecture seule (90 jours de rétention).',
  },
  {
    question: 'Comment contacter le support ?',
    answer:
      'Par e-mail à contact@kovas.fr, du lundi au vendredi de 9 h à 18 h (heure de Paris). Le délai de réponse est garanti à 24 h ouvrées sur tous les tiers, 4 h sur Standard et Volume, et 1 h en priorité Volume avec un dossier critique.',
  },
  {
    question: 'Mes données sont-elles bien protégées ?',
    answer:
      'Hébergement Supabase exclusivement en France (région Paris eu-west-3). Conformité RGPD complète : consentements explicites, export complet et droit à l’oubli en un clic depuis votre espace. Aucune revente ni partage commercial des données métier.',
  },
] as const

export default function AidePage() {
  const breadcrumbSchema = buildBreadcrumbList([
    { name: 'Accueil', path: '/' },
    { name: 'Aide & support', path: '/aide' },
  ])

  const webPageSchema = {
    '@context': 'https://schema.org' as const,
    '@type': 'WebPage' as const,
    '@id': 'https://kovas.fr/aide#webpage',
    url: 'https://kovas.fr/aide',
    name: 'Aide et support diagnostiqueur immobilier | KOVAS',
    description: "Centre d'aide KOVAS : démarrage rapide, FAQ, tutoriels vidéo et contact direct.",
    inLanguage: 'fr-FR' as const,
    isPartOf: { '@id': 'https://kovas.fr/#website' },
    breadcrumb: { '@id': 'https://kovas.fr/aide#breadcrumb' },
  }

  const faqSchema = getFAQPageSchema(
    FAQ_KEY.map((item) => ({ question: item.question, answer: item.answer })),
  )

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <JsonLd data={[webPageSchema, breadcrumbSchema, faqSchema]} id="aide" />

      <PublicHeader />

      <main className="flex-1">
        {/* Hero — palette sage + navy, accent chartreuse réservé CTA contact */}
        <section className="border-b border-rule/40 bg-sage">
          <div className="mx-auto max-w-screen-xl px-4 py-16 md:px-6 md:py-24">
            <p className="mb-4 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-mute">
              Centre d&apos;aide
            </p>
            <h1
              className="font-sans font-medium tracking-tight text-ink leading-[1.05]"
              style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}
            >
              Aide &amp;{' '}
              <span className="font-serif italic font-normal text-ink-soft">support</span>.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-mute">
              Démarrer en quelques minutes, retrouver les réponses aux questions récurrentes, suivre
              les tutoriels vidéo ou nous écrire directement. Une équipe humaine basée en France
              répond à chaque demande.
            </p>
          </div>
        </section>

        {/* Démarrage rapide */}
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-screen-xl px-4 md:px-6">
            <div className="mb-10 flex items-center gap-3">
              <LifeBuoy className="size-5 text-ink-mute" aria-hidden />
              <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
                Démarrage rapide
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_START.map((item) => {
                const Icon = item.icon
                return (
                  <Card
                    key={item.title}
                    variant="opaque"
                    padding="lg"
                    className="group flex h-full flex-col transition-all hover:-translate-y-px hover:shadow-md"
                  >
                    <span
                      aria-hidden
                      className="flex size-11 items-center justify-center rounded-full bg-ink/10 text-ink"
                    >
                      <Icon className="size-5" />
                    </span>
                    <h3 className="mt-5 font-display text-xl font-bold leading-tight text-ink">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.description}</p>
                    <div className="mt-6 flex-1" />
                    <Button asChild variant="ghost" size="sm" className="self-start">
                      <Link href={item.href}>
                        {item.cta}
                        <ArrowRight
                          className="size-3.5 transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </Link>
                    </Button>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        {/* FAQ rapide */}
        <section className="border-y border-rule/40 bg-sage-alt py-16 md:py-20">
          <div className="mx-auto max-w-screen-xl px-4 md:px-6">
            <div className="mb-10 flex items-center gap-3">
              <HelpCircle className="size-5 text-ink-mute" aria-hidden />
              <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
                Questions fréquentes
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {FAQ_KEY.map((item) => (
                <Card
                  key={item.question}
                  variant="opaque"
                  padding="lg"
                  className="flex h-full flex-col"
                >
                  <h3 className="font-display text-base font-bold leading-tight text-ink">
                    {item.question}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">{item.answer}</p>
                </Card>
              ))}
            </div>
            <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-mute">
                Plus de 40 questions couvertes par thématique sur la page FAQ complète.
              </p>
              <Button asChild variant="ghost" size="sm">
                <Link href="/faq">
                  Voir toutes les questions
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Tutoriels vidéo */}
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-screen-xl px-4 md:px-6">
            <div className="mb-10 flex items-center gap-3">
              <Play className="size-5 text-ink-mute" aria-hidden />
              <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
                Tutoriels vidéo
              </h2>
            </div>
            <Card variant="opaque" padding="lg" className="max-w-3xl">
              <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-ink-mute">
                Bientôt disponible
              </p>
              <h3 className="mt-3 font-display text-xl font-bold leading-tight text-ink">
                Une chaîne dédiée diagnostiqueurs
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                Démonstrations terrain, captures d&apos;écran commentées, passerelles Liciel,
                raccourcis productivité. La chaîne YouTube KOVAS ouvre lors du lancement public en
                septembre 2026.
              </p>
              <div className="mt-6">
                <Button asChild variant="ghost" size="sm">
                  <Link href="https://youtube.com/@kovas-fr" target="_blank" rel="noreferrer">
                    S&apos;abonner à la chaîne
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </Button>
              </div>
            </Card>
          </div>
        </section>

        {/* Contact — CTA chartreuse autorisé (1 par écran) */}
        <section className="border-t border-rule/40 bg-sage py-16 md:py-20">
          <div className="mx-auto max-w-screen-xl px-4 md:px-6">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
              <div>
                <div className="mb-6 flex items-center gap-3">
                  <Mail className="size-5 text-ink-mute" aria-hidden />
                  <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
                    Nous écrire
                  </h2>
                </div>
                <p className="max-w-xl text-base leading-relaxed text-ink-soft">
                  Une question, un retour terrain, une demande commerciale ou un besoin de support :
                  une seule adresse, une équipe humaine basée en France qui lit chaque message.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button asChild variant="accent" size="lg">
                    <Link href="mailto:contact@kovas.fr">contact@kovas.fr</Link>
                  </Button>
                  <Button asChild variant="ghost" size="lg">
                    <Link href="/contact">
                      Ouvrir le formulaire
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </div>

              <Card variant="opaque" padding="lg">
                <h3 className="font-display text-base font-bold leading-tight text-ink">
                  Horaires &amp; délais de réponse
                </h3>
                <dl className="mt-5 space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 size-4 text-ink-mute" aria-hidden />
                    <div>
                      <dt className="font-medium text-ink">Horaires</dt>
                      <dd className="text-ink-mute">
                        Lundi au vendredi, 9 h – 18 h (heure de Paris). Fermé les jours fériés
                        français.
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <BookOpen className="mt-0.5 size-4 text-ink-mute" aria-hidden />
                    <div>
                      <dt className="font-medium text-ink">Délais garantis</dt>
                      <dd className="text-ink-mute">
                        24 h ouvrées sur le tier Découverte, 4 h sur Standard et Volume, 1 h en
                        priorité Volume avec dossier critique signalé.
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 size-4 text-ink-mute" aria-hidden />
                    <div>
                      <dt className="font-medium text-ink">Éditeur</dt>
                      <dd className="text-ink-mute">
                        SASU Nexus 1993, siège Paris 8. Hébergement données en France (Supabase
                        Paris eu-west-3).
                      </dd>
                    </div>
                  </div>
                </dl>
              </Card>
            </div>
          </div>
        </section>

        {/* Footer navigation interne — pas un footer global, c'est un sous-footer thématique */}
        <section className="border-t border-rule/40 bg-sage-alt py-12">
          <div className="mx-auto max-w-screen-xl px-4 md:px-6">
            <p className="mb-6 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-mute">
              Aller plus loin
            </p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
              <li>
                <Link href="/guide" className="text-ink-soft transition-colors hover:text-ink">
                  Guides du diagnostic →
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-ink-soft transition-colors hover:text-ink">
                  FAQ complète →
                </Link>
              </li>
              <li>
                <Link href="/tarifs" className="text-ink-soft transition-colors hover:text-ink">
                  Tarifs &amp; forfaits →
                </Link>
              </li>
              <li>
                <Link href="/comparatif" className="text-ink-soft transition-colors hover:text-ink">
                  Comparatif Liciel →
                </Link>
              </li>
              <li>
                <Link
                  href="/temoignages"
                  className="text-ink-soft transition-colors hover:text-ink"
                >
                  Témoignages diagnostiqueurs →
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-ink-soft transition-colors hover:text-ink">
                  Formulaire contact →
                </Link>
              </li>
              <li>
                <Link
                  href="/observatoire"
                  className="text-ink-soft transition-colors hover:text-ink"
                >
                  Observatoire DPE →
                </Link>
              </li>
              <li>
                <Link
                  href="/api-publique"
                  className="text-ink-soft transition-colors hover:text-ink"
                >
                  API publique →
                </Link>
              </li>
            </ul>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
