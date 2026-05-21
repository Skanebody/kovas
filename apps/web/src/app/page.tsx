import { CtaBanner } from '@/components/public/landing/CtaBanner'
import { FaqAccordion, type FaqItem } from '@/components/public/landing/FaqAccordion'
import { HeroB2C } from '@/components/public/landing/HeroB2C'
import { HowItWorks } from '@/components/public/landing/HowItWorks'
import { Testimonials, type Testimonial } from '@/components/public/landing/TestimonialCard'
import { TopCitiesGrid } from '@/components/public/landing/TopCitiesGrid'
import { ValueProps, type ValueProp } from '@/components/public/landing/ValueProps'
import { PublicFooter } from '@/components/public/PublicFooter'
import { PublicNav } from '@/components/public/PublicNav'
import { BadgePercent, MapPin, ShieldCheck, Zap } from 'lucide-react'
import type { Metadata } from 'next'

/**
 * KOVAS — Page d'accueil B2C (kovas.fr/)
 * Cible : particuliers cherchant un diagnostiqueur immobilier certifié.
 * Brand : cream + navy + cyan (sobre, rassurant, professionnel).
 */
export const metadata: Metadata = {
  title:
    'KOVAS — Trouvez votre diagnostiqueur immobilier certifié | DPE, Amiante, Plomb',
  description:
    'Annuaire officiel des 13 000 diagnostiqueurs immobiliers en France. Devis gratuit en 2 minutes. Données du Ministère du Logement.',
  alternates: { canonical: 'https://kovas.fr' },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://kovas.fr',
    siteName: 'KOVAS',
    title: 'KOVAS — Trouvez votre diagnostiqueur immobilier certifié',
    description:
      'Annuaire officiel des 13 000 diagnostiqueurs immobiliers. Devis gratuit en 2 minutes.',
  },
}

const HOW_STEPS = [
  {
    title: 'Cherchez',
    description:
      'Indiquez l’adresse de votre bien. Nous trouvons les diagnostiqueurs locaux certifiés autour de vous.',
  },
  {
    title: 'Comparez',
    description:
      'Recevez jusqu’à 3 devis gratuits en 24 à 48 heures, directement par les professionnels.',
  },
  {
    title: 'Choisissez',
    description:
      'Sélectionnez le diagnostiqueur qui vous convient en toute transparence. Aucune commission cachée.',
  },
]

const VALUE_PROPS: ValueProp[] = [
  {
    icon: MapPin,
    title: 'Données officielles',
    description:
      'Annuaire issu du Ministère du Logement (DHUP) — ce n’est pas un comparateur opaque.',
  },
  {
    icon: BadgePercent,
    title: '100% gratuit',
    description:
      'Aucune commission cachée. Le diagnostiqueur reçoit votre demande directement, sans intermédiaire.',
  },
  {
    icon: ShieldCheck,
    title: 'Professionnels vérifiés',
    description:
      'Toutes les certifications COFRAC contrôlées quotidiennement contre la base officielle.',
  },
  {
    icon: Zap,
    title: 'Réponse rapide',
    description:
      'Devis sous 24 à 48 heures en moyenne. Vous gagnez du temps sans rogner sur la qualité.',
  },
]

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'Devis reçus en 12h. Très bon rapport qualité-prix par rapport aux premiers prix trouvés sur Google.',
    name: 'Marie L.',
    meta: 'Paris · Vente appartement',
  },
  {
    quote:
      'Diagnostiqueur sérieux et ponctuel. Rapport conforme reçu en 48h après la visite, j’ai pu signer mon bail à temps.',
    name: 'Pierre M.',
    meta: 'Lyon · Location maison',
  },
  {
    quote:
      'Comparaison facile entre 3 professionnels. J’ai économisé 80€ par rapport aux premiers devis que j’avais trouvés.',
    name: 'Sophie D.',
    meta: 'Bordeaux · Vente maison',
  },
]

const FAQ_B2C: FaqItem[] = [
  {
    question: 'Quels diagnostics sont obligatoires pour vendre ou louer un bien ?',
    answer:
      'Vente : DPE, amiante (bien construit avant juillet 1997), plomb (avant 1949), gaz et électricité (installations de plus de 15 ans), termites (zones à risque définies par arrêté préfectoral), ERP (état des risques) et mesurage Carrez en copropriété. Location : DPE, ERP, plomb, amiante, gaz, électricité et mesurage Boutin.',
  },
  {
    question: 'Combien coûte un diagnostic immobilier en 2026 ?',
    answer:
      'Les prix varient selon la surface, le nombre de diagnostics et la région. À titre indicatif : un DPE seul coûte entre 100 et 250 €. Un pack complet pour la vente (DPE, amiante, plomb, gaz, électricité, termites, ERP, Carrez) coûte généralement entre 350 € et 700 €. C’est pourquoi nous vous encourageons à comparer plusieurs devis.',
  },
  {
    question: 'Quel est le délai pour obtenir un diagnostic ?',
    answer:
      'La plupart des diagnostiqueurs interviennent sous 3 à 7 jours après la prise de rendez-vous. Le rapport est ensuite remis sous 24 à 72 heures selon la complexité du bien.',
  },
  {
    question: 'Un DPE est-il valable combien de temps ?',
    answer:
      'Un DPE réalisé depuis le 1ᵉʳ juillet 2021 est valable 10 ans, sauf changement significatif (travaux, extension). Les DPE antérieurs ont une validité spécifique (vérifiez sur le rapport).',
  },
  {
    question: 'Que se passe-t-il si je n’ai pas tous les diagnostics ?',
    answer:
      'L’absence d’un diagnostic obligatoire au moment de la vente ou de la location vous expose à des recours de l’acquéreur ou du locataire (annulation, dommages et intérêts, voire amende administrative). Le notaire bloquera en général la signature.',
  },
  {
    question: 'Comment vérifier la certification d’un diagnostiqueur ?',
    answer:
      'Tous les diagnostiqueurs présents sur KOVAS sont issus de l’annuaire officiel de la DHUP (Ministère du Logement). Leur certification COFRAC est vérifiée quotidiennement contre la base officielle. Si une certification n’est plus valable, la fiche est immédiatement retirée.',
  },
  {
    question: 'KOVAS facture-t-il les particuliers ?',
    answer:
      'Non. Le service est 100% gratuit pour les particuliers. Aucune commission n’est prélevée sur les devis reçus. KOVAS est financé uniquement par les abonnements à KOVAS 360 — notre logiciel professionnel — payés par les diagnostiqueurs qui choisissent de l’utiliser.',
  },
  {
    question: 'Mes données sont-elles protégées ?',
    answer:
      'Oui. KOVAS est hébergé en France (Paris) et conforme au RGPD. Vos coordonnées ne sont transmises qu’aux 3 diagnostiqueurs maximum que vous choisissez de contacter. Aucune revente à des tiers, aucun démarchage commercial non sollicité.',
  },
]

// Schema.org JSON-LD pour la homepage B2C
const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'KOVAS',
  url: 'https://kovas.fr',
  logo: 'https://kovas.fr/icons/icon-512.png',
  sameAs: ['https://www.linkedin.com/company/kovas-app', 'https://x.com/kovas_fr'],
  description:
    'Annuaire officiel des diagnostiqueurs immobiliers certifiés en France. Demande de devis gratuit en ligne.',
} as const

const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  url: 'https://kovas.fr',
  name: 'KOVAS',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://kovas.fr/diagnostiqueurs?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
} as const

export default function HomePage() {
  return (
    <div className="min-h-dvh flex flex-col bg-cream">
      <PublicNav variant="b2c" />
      <main className="flex-1">
        <HeroB2C />
        <HowItWorks
          title="Comment ça marche en 3 étapes."
          subtitle="Du premier clic au rendez-vous : c’est simple, rapide et gratuit."
          steps={HOW_STEPS}
          variant="b2c"
        />
        <ValueProps
          eyebrow="02 · Pourquoi KOVAS"
          title="L’annuaire de confiance."
          subtitle="Différent d’un comparateur classique : transparence totale, données officielles, zéro commission."
          items={VALUE_PROPS}
          variant="b2c"
        />
        <Testimonials
          eyebrow="03 · Ils nous ont fait confiance"
          title="Témoignages de particuliers."
          items={TESTIMONIALS}
          variant="b2c"
        />
        <TopCitiesGrid />
        <FaqAccordion
          eyebrow="05 · Questions fréquentes"
          title="Tout ce qu’il faut savoir."
          items={FAQ_B2C}
          variant="b2c"
        />
        <CtaBanner
          eyebrow="Prêt à démarrer"
          title="Trouvez votre diagnostiqueur en 2 minutes."
          description="Service 100% gratuit. Devis reçus directement par email. Aucun démarchage non sollicité."
          ctaLabel="Démarrer ma recherche"
          ctaHref="/diagnostiqueurs"
        />
      </main>
      <PublicFooter variant="b2c" />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_SCHEMA) }}
      />
    </div>
  )
}
