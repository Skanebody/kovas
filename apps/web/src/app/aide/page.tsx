/**
 * KOVAS — Page /aide
 *
 * Refonte chrome Lot B72 (2026-05-26) : harmonisation au style home V5 sobre.
 * Sage `#F5F7F4` + navy `#0F1419` + chartreuse `#D4F542` UNIQUEMENT sur CTA
 * conversion. Vouvoiement strict, ton SOBRE PROFESSIONNEL. Préservation des
 * tooltips B67 (GlossaryTerm 9 termes) + JSON-LD WebPage + FAQPage B68.
 *
 * Sections :
 *   1. Hero "Aide & support"
 *   2. Démarrage rapide (3 cards)
 *   3. Questions fréquentes (5 FAQ)
 *   4. Tutoriels vidéo (teaser)
 *   5. Nous écrire (contact direct chartreuse)
 *   6. Glossaire express (9 termes GlossaryTerm B67)
 *   7. Aller plus loin (navigation interne)
 */

import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { Button } from '@/components/ui/button'
import { GlossaryTerm } from '@/components/ui/glossary-term'
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
  // OG image : générée dynamiquement par `opengraph-image.tsx` collocaté (Lot B88).
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
    title: 'Ton premier diagnostic',
    description:
      'Créer un dossier, ajouter le bien, lancer la saisie terrain et exporter le rapport en moins de 30 minutes. Le parcours type guidé pas à pas.',
    href: '/guide',
    cta: 'Lire le guide',
  },
  {
    icon: Upload,
    title: 'Importer un dossier Liciel',
    description:
      'Reprendre une mission existante depuis ton logiciel principal : import XML, Excel ou ZIP, mapping automatique des pièces et des équipements.',
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
      '30 jours d’accès complet à toutes les fonctionnalités du forfait choisi. La carte bancaire est demandée à l’inscription via Stripe Checkout ; aucun débit avant J+30. Tu peux résilier à tout moment depuis ton espace abonnement.',
  },
  {
    question: 'Puis-je résilier à tout moment ?',
    answer:
      'Oui. La résiliation est accessible en deux clics depuis ton espace abonnement, sans frais ni durée d’engagement. Ton forfait reste actif jusqu’à la fin de la période payée puis ton compte passe en lecture seule (90 jours de rétention).',
  },
  {
    question: 'Comment contacter le support ?',
    answer:
      'Par e-mail à contact@kovas.fr, du lundi au vendredi de 9 h à 18 h (heure de Paris). Le délai de réponse est garanti à 24 h ouvrées sur tous les tiers, 4 h sur Standard et Volume, et 1 h en priorité Volume avec un dossier critique.',
  },
  {
    question: 'Mes données sont-elles bien protégées ?',
    answer:
      'Hébergement Supabase exclusivement en France (région Paris eu-west-3). Conformité RGPD complète : consentements explicites, export complet et droit à l’oubli en un clic depuis ton espace. Aucune revente ni partage commercial des données métier.',
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
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <JsonLd data={[webPageSchema, breadcrumbSchema, faqSchema]} id="aide" />

      <PublicHeader />

      <main className="flex-1">
        {/* HERO */}
        <section className="px-5 sm:px-12 pt-16 sm:pt-24 pb-12 sm:pb-20 animate-fade-in motion-reduce:animate-none">
          <div className="max-w-[1240px] mx-auto">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-6">
              Centre d&apos;aide
            </p>
            <h1
              className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.02] max-w-[1100px]"
              style={{ fontSize: 'clamp(40px, 7vw, 104px)' }}
            >
              Aide &amp; <span className="font-serif italic font-normal">support</span>.
            </h1>
            <p className="mt-8 max-w-2xl text-lg sm:text-xl text-[#0F1419]/72 leading-relaxed">
              Démarrer en quelques minutes, retrouver les réponses aux questions récurrentes, suivre
              les tutoriels vidéo ou nous écrire directement. Une équipe humaine basée en France
              répond à chaque demande.
            </p>
          </div>
        </section>

        {/* DÉMARRAGE RAPIDE */}
        <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto space-y-12">
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                <LifeBuoy className="inline size-3.5 mr-1 -mt-px" aria-hidden />
                Démarrage rapide
              </p>
              <h2
                className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
                style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
              >
                Premiers pas en{' '}
                <span className="font-serif italic font-normal">trente minutes</span>.
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_START.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.title}
                    className="group flex h-full flex-col rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3"
                  >
                    <span
                      aria-hidden
                      className="flex size-11 items-center justify-center rounded-full bg-[#0F1419]/[0.06] text-[#0F1419]/72"
                    >
                      <Icon className="size-5" />
                    </span>
                    <h3 className="text-lg font-semibold text-[#0F1419] tracking-tight">
                      {item.title}
                    </h3>
                    <p className="text-[14px] text-[#0F1419]/72 leading-relaxed">
                      {item.description}
                    </p>
                    <div className="mt-2 flex-1" />
                    <Button asChild variant="ghost" size="sm" className="self-start">
                      <Link href={item.href}>
                        {item.cta}
                        <ArrowRight
                          className="size-3.5 transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </Link>
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
          <div className="max-w-[1240px] mx-auto space-y-12">
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                <HelpCircle className="inline size-3.5 mr-1 -mt-px" aria-hidden />
                Questions fréquentes
              </p>
              <h2
                className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
                style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
              >
                Tes <span className="font-serif italic font-normal">objections</span> principales.
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {FAQ_KEY.map((item) => (
                <div
                  key={item.question}
                  className="flex h-full flex-col rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3"
                >
                  <h3 className="text-base font-semibold text-[#0F1419] tracking-tight leading-snug">
                    {item.question}
                  </h3>
                  <p className="text-[14px] text-[#0F1419]/72 leading-relaxed">{item.answer}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#0F1419]/55">
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

        {/* TUTORIELS VIDÉO */}
        <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto space-y-12">
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                <Play className="inline size-3.5 mr-1 -mt-px" aria-hidden />
                Tutoriels vidéo
              </p>
              <h2
                className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
                style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
              >
                Une <span className="font-serif italic font-normal">chaîne dédiée</span>{' '}
                diagnostiqueurs.
              </h2>
            </div>
            <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 max-w-3xl space-y-3">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Bientôt disponible
              </p>
              <h3 className="text-lg font-semibold text-[#0F1419] tracking-tight">
                Démos terrain et captures commentées
              </h3>
              <p className="text-[14px] text-[#0F1419]/72 leading-relaxed">
                Démonstrations terrain, captures d&apos;écran commentées, passerelles Liciel,
                raccourcis productivité. La chaîne YouTube KOVAS ouvre lors du lancement public en
                septembre 2026.
              </p>
              <div className="pt-2">
                <Button asChild variant="ghost" size="sm">
                  <Link href="https://youtube.com/@kovas-fr" target="_blank" rel="noreferrer">
                    S&apos;abonner à la chaîne
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* NOUS ÉCRIRE */}
        <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
          <div className="max-w-[1240px] mx-auto grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">
            <div className="space-y-6">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                <Mail className="inline size-3.5 mr-1 -mt-px" aria-hidden />
                Nous écrire
              </p>
              <h2
                className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
                style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
              >
                Une seule <span className="font-serif italic font-normal">adresse</span>.
              </h2>
              <p className="max-w-xl text-[15px] sm:text-[18px] text-[#0F1419]/72 leading-relaxed">
                Une question, un retour terrain, une demande commerciale ou un besoin de support :
                une seule adresse, une équipe humaine basée en France qui lit chaque message.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild variant="accent" size="lg">
                  <Link href="mailto:contact@kovas.fr">contact@kovas.fr</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/contact">
                    Ouvrir le formulaire
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-4">
              <h3 className="text-base font-semibold text-[#0F1419] tracking-tight">
                Horaires &amp; délais de réponse
              </h3>
              <dl className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 size-4 text-[#0F1419]/55 shrink-0" aria-hidden />
                  <div>
                    <dt className="font-medium text-[#0F1419]">Horaires</dt>
                    <dd className="text-[#0F1419]/72 leading-relaxed">
                      Lundi au vendredi, 9 h – 18 h (heure de Paris). Fermé les jours fériés
                      français.
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <BookOpen className="mt-0.5 size-4 text-[#0F1419]/55 shrink-0" aria-hidden />
                  <div>
                    <dt className="font-medium text-[#0F1419]">Délais garantis</dt>
                    <dd className="text-[#0F1419]/72 leading-relaxed">
                      24 h ouvrées sur le tier Découverte, 4 h sur Standard et Volume, 1 h en
                      priorité Volume avec dossier critique signalé.
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 text-[#0F1419]/55 shrink-0" aria-hidden />
                  <div>
                    <dt className="font-medium text-[#0F1419]">Éditeur</dt>
                    <dd className="text-[#0F1419]/72 leading-relaxed">
                      SASU Nexus 1993, siège Paris 8. Hébergement données en France (Supabase Paris
                      eu-west-3).
                    </dd>
                  </div>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* GLOSSAIRE EXPRESS */}
        <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto space-y-10">
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Glossaire express
              </p>
              <h2
                className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
                style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
              >
                Comprendre le <span className="font-serif italic font-normal">jargon</span>.
              </h2>
              <p className="text-[15px] text-[#0F1419]/72 leading-relaxed">
                Survole ou touche chaque terme souligné pour afficher la définition courte et la
                source officielle (Légifrance, ADEME, INSEE).
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm leading-relaxed text-[#0F1419]/72 sm:grid-cols-2 lg:grid-cols-3">
              <li>
                Le <GlossaryTerm term="DPE" /> est obligatoire à la vente et la location.
              </li>
              <li>
                Diagnostiqueurs accrédités <GlossaryTerm term="COFRAC" /> uniquement.
              </li>
              <li>
                Habilitation <GlossaryTerm term="RGE">RGE</GlossaryTerm> pour les artisans
                rénovation.
              </li>
              <li>
                Méthode officielle <GlossaryTerm term="3CL-2021">3CL-2021</GlossaryTerm>.
              </li>
              <li>
                Calcul <GlossaryTerm term="Carrez" /> en copropriété.
              </li>
              <li>
                Surface habitable <GlossaryTerm term="Boutin" /> en location vide.
              </li>
              <li>
                <GlossaryTerm term="ERP" /> remis avant la vente.
              </li>
              <li>
                <GlossaryTerm term="CREP" /> obligatoire pré-1949.
              </li>
              <li>
                <GlossaryTerm term="audit-energetique">Audit énergétique</GlossaryTerm> vente F/G.
              </li>
            </ul>
          </div>
        </section>

        {/* ALLER PLUS LOIN */}
        <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
          <div className="max-w-[1240px] mx-auto">
            <p className="mb-6 font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
              Aller plus loin
            </p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
              <li>
                <Link
                  href="/guide"
                  className="text-[#0F1419]/72 transition-colors hover:text-[#0F1419]"
                >
                  Guides du diagnostic →
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-[#0F1419]/72 transition-colors hover:text-[#0F1419]"
                >
                  FAQ complète →
                </Link>
              </li>
              <li>
                <Link
                  href="/tarifs"
                  className="text-[#0F1419]/72 transition-colors hover:text-[#0F1419]"
                >
                  Tarifs &amp; forfaits →
                </Link>
              </li>
              <li>
                <Link
                  href="/comparatif"
                  className="text-[#0F1419]/72 transition-colors hover:text-[#0F1419]"
                >
                  Comparatif Liciel →
                </Link>
              </li>
              <li>
                <Link
                  href="/temoignages"
                  className="text-[#0F1419]/72 transition-colors hover:text-[#0F1419]"
                >
                  Témoignages diagnostiqueurs →
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-[#0F1419]/72 transition-colors hover:text-[#0F1419]"
                >
                  Formulaire contact →
                </Link>
              </li>
              <li>
                <Link
                  href="/observatoire"
                  className="text-[#0F1419]/72 transition-colors hover:text-[#0F1419]"
                >
                  Observatoire DPE →
                </Link>
              </li>
              <li>
                <Link
                  href="/api-publique"
                  className="text-[#0F1419]/72 transition-colors hover:text-[#0F1419]"
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
