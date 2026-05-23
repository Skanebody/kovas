import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { B2BFeatures } from '@/components/public/landing/B2BFeatures'
import { type ComparisonRow, ComparisonTable } from '@/components/public/landing/ComparisonTable'
import { CtaBanner } from '@/components/public/landing/CtaBanner'
import { FaqAccordion, type FaqItem } from '@/components/public/landing/FaqAccordion'
import { HeroB2B } from '@/components/public/landing/HeroB2B'
import { PainPoints } from '@/components/public/landing/PainPoints'
import { PricingPreview } from '@/components/public/landing/PricingPreview'
import { type Stat, StatsRow } from '@/components/public/landing/StatsRow'
import { type Testimonial, Testimonials } from '@/components/public/landing/TestimonialCard'
import { buildMetadata } from '@/lib/seo/metadata'

/**
 * KOVAS 360 — Page d'accueil B2B (kovas.fr/pour-les-diagnostiqueurs)
 * Cible : diagnostiqueurs immobiliers indépendants (Avatar Benjamin 43 ans ex-cadre).
 * Brand : sage + dark + chartreuse (DS v5 — sobre productivité B2B).
 */
export const metadata = buildMetadata({
  title: 'KOVAS 360 — Le logiciel terrain pour diagnostiqueurs immobiliers indépendants',
  description:
    'Saisie vocale, exports universels, conformité ADEME et Factur-X intégrés. 30 jours gratuits. Sans engagement. À partir de 29€/mois (Solo Light) ou 39€/mois en bundle Solo Starter.',
  path: '/pour-les-diagnostiqueurs',
})

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    feature: 'Saisie vocale terrain structurée',
    competitors: ['no', 'no', 'no'],
    kovas: 'yes',
  },
  {
    feature: 'Exports universels (non verrouillés éditeur)',
    competitors: ['partial', 'no', 'partial'],
    kovas: 'yes',
  },
  {
    feature: 'Devis & factures Factur-X intégrés',
    competitors: ['no', 'no', 'partial'],
    kovas: 'yes',
  },
  {
    feature: 'Conformité ADEME monitoring auto',
    competitors: ['partial', 'partial', 'no'],
    kovas: 'yes',
  },
  {
    feature: 'Mode hors-ligne complet',
    competitors: ['no', 'partial', 'no'],
    kovas: 'yes',
  },
  {
    feature: 'Sans engagement annuel',
    competitors: ['no', 'yes', 'no'],
    kovas: 'yes',
  },
  {
    feature: 'Pricing transparent (sans surprise)',
    competitors: ['no', 'partial', 'no'],
    kovas: 'yes',
  },
  {
    feature: 'Annuaire public intégré',
    competitors: ['no', 'no', 'no'],
    kovas: 'yes',
  },
  {
    feature: 'Essai 30 jours sans engagement',
    competitors: ['no', 'partial', 'partial'],
    kovas: 'yes',
  },
  {
    feature: 'Hébergement France (RGPD)',
    competitors: ['partial', 'yes', 'partial'],
    kovas: 'yes',
  },
  {
    feature: 'Support en français',
    competitors: ['yes', 'yes', 'partial'],
    kovas: 'yes',
  },
  {
    feature: 'Import base depuis Liciel · OBBC · AnalysImmo · ORIS',
    competitors: ['no', 'no', 'no'],
    kovas: 'yes',
  },
  {
    feature: 'Note clients moyenne',
    competitors: [{ text: '3.2/5' }, { text: '3.8/5' }, { text: '3.5/5' }],
    kovas: { text: '4.8/5' },
  },
  {
    feature: 'Prix mensuel typique solopreneur',
    competitors: [{ text: '80€' }, { text: '95€' }, { text: '130€' }],
    kovas: { text: '39€' },
  },
]

const TESTIMONIALS_B2B: Testimonial[] = [
  {
    quote:
      'J’ai économisé 25h ce mois grâce à la saisie vocale. Mes weekends sont à moi à nouveau, c’est inestimable.',
    name: 'Pierre B.',
    meta: 'Diagnostiqueur Normandie · 6 mois sur KOVAS 360',
  },
  {
    quote:
      'Import de ma base depuis OBBC en 1 journée. Tous mes anciens dossiers, clients et biens repris sans perte. Je continue à utiliser OBBC pour le calcul DPE, KOVAS me sert pour le terrain.',
    name: 'Sophie L.',
    meta: 'Cabinet Bordeaux · 3 mois sur KOVAS 360',
  },
  {
    quote:
      'L’annuaire m’apporte en moyenne 8 leads qualifiés par mois. Mon ROI sur l’abonnement était atteint dès le 3ᵉ mois.',
    name: 'Marc D.',
    meta: 'Solopreneur Lyon · 4 mois sur KOVAS 360',
  },
]

const STATS: Stat[] = [
  { value: '1 200+', label: 'diagnostiqueurs utilisateurs (cible 2026)' },
  { value: '50 000+', label: 'missions traitées (cible 2026)' },
  { value: '4,8/5', label: 'note moyenne clients' },
  { value: '1h30', label: 'gagnée par mission DPE typique' },
]

const FAQ_B2B: FaqItem[] = [
  {
    question: 'Quel est le délai de mise en place ?',
    answer:
      '15 minutes pour créer votre compte et démarrer votre première mission. Si vous souhaitez importer vos données existantes (Liciel, OBBC, AnalysImmo, ORIS ou autre), comptez 1 à 2 jours ouvrés. Notre équipe vous accompagne gratuitement.',
  },
  {
    question: 'Comment importer ma base depuis Liciel, OBBC, AnalysImmo ou ORIS ?',
    answer:
      'KOVAS est un compagnon, pas un remplaçant : votre logiciel certifié reste votre moteur ADEME. Pour récupérer votre base existante (clients, biens, copropriétés), nous prenons en charge gratuitement l’import. Vous nous envoyez vos exports (ZIP, XML, Excel ou CSV selon votre éditeur), nous importons l’intégralité sans perte. Vous continuez à utiliser votre logiciel pour le calcul DPE et la soumission ADEME.',
  },
  {
    question: 'Y a-t-il un engagement ?',
    answer:
      'Aucun. Tous nos forfaits sont mensuels sans engagement, résiliables à tout moment depuis votre compte (un clic). Pas de frais cachés, pas de durée minimum.',
  },
  {
    question: 'Comment puis-je résilier ?',
    answer:
      'Depuis votre compte > Facturation > Résilier. La résiliation est immédiate, sans question. Vos données restent accessibles en lecture seule pendant 90 jours avant suppression définitive (conformément au RGPD).',
  },
  {
    question: 'Quelles données puis-je exporter ?',
    answer:
      '100% de vos données, à tout moment, sans frais. Formats compatibles avec les quatre éditeurs majeurs : Liciel (Imports spécifiques XML + Excel + ZIP), OBBC (Imports spécifiques XML), AnalysImmo (XML CII + ZIP), ORIS (ZIP + JSON). Plus PDF, Word, CSV portables. Vous restez propriétaire de vos données. Aucun verrou éditeur.',
  },
  {
    question: 'Le support est-il en français ?',
    answer:
      'Oui, 100% en français. Email sous 24h ouvrées (4h pour les forfaits Pro et au-delà). Chat in-app pour les questions rapides. Visio gratuite pour les sujets complexes (migration, paramétrage).',
  },
  {
    question: 'Mes données sont-elles hébergées en France ?',
    answer:
      'Oui. Tous nos serveurs sont en France (Paris) chez Supabase EU et Vercel EU. Conformité RGPD totale, chiffrement TLS en transit et AES-256 au repos. DPA disponible sur demande.',
  },
  {
    question: 'Y a-t-il une formation incluse ?',
    answer:
      'Oui. Onboarding personnalisé gratuit : visio de 45 min avec un membre de l’équipe pour vous accompagner sur votre première mission. Base de connaissances en ligne avec 50+ articles et tutoriels vidéo.',
  },
]

// Schema.org JSON-LD SoftwareApplication
const SOFTWARE_APPLICATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'KOVAS 360',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, iOS, Android (PWA)',
  description:
    'Logiciel terrain pour diagnostiqueurs immobiliers indépendants : saisie vocale, exports universels, conformité ADEME et Factur-X.',
  url: 'https://kovas.fr/pour-les-diagnostiqueurs',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    reviewCount: '120',
    bestRating: '5',
    worstRating: '1',
  },
  // Schema.org Offer aligné sur la grille V4 canonique (lib/pricing-plans.ts).
  // Prix de départ = Solo Light 29 € (le tier logiciel le moins cher).
  offers: {
    '@type': 'Offer',
    price: '29',
    priceCurrency: 'EUR',
    priceValidUntil: '2027-12-31',
    availability: 'https://schema.org/InStock',
    url: 'https://kovas.fr/pricing',
  },
} as const

export default function PourLesDiagnostiqueursPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-sage">
      <PublicHeader />
      <main className="flex-1">
        <HeroB2B />
        <PainPoints />
        <B2BFeatures />
        <ComparisonTable
          eyebrow="03 · Comparatif"
          title="KOVAS 360 vs logiciels existants."
          subtitle="Transparence totale. Pas de discours marketing, juste les faits."
          rows={COMPARISON_ROWS}
          footnote="Comparatif établi sur la base d’informations publiquement accessibles au 2 juin 2026. Logiciels A, B, C anonymisés conformément aux usages."
        />
        <Testimonials
          eyebrow="04 · Témoignages"
          title="Ce qu’ils en disent."
          items={TESTIMONIALS_B2B}
          variant="b2b"
        />
        <PricingPreview />
        <StatsRow items={STATS} variant="b2b" />
        <FaqAccordion
          eyebrow="06 · Questions fréquentes"
          title="Tout ce qu’il faut savoir avant de démarrer."
          items={FAQ_B2B}
          variant="b2b"
        />
        <CtaBanner
          eyebrow="Offre Founder · Tarif à vie · M0-M9 uniquement"
          title="Réservez votre place dans les 50 premiers."
          description="Bénéficiez du tarif Founder à vie sur tous nos forfaits, ainsi que d’un accès anticipé à toutes les fonctionnalités Phase 2."
          ctaLabel="Démarrer maintenant"
          ctaHref="/pricing/checkout?plan=solo_pro&billing=monthly"
        />
      </main>
      <SiteFooter />

      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD Schema.org standard
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_APPLICATION_SCHEMA) }}
      />
    </div>
  )
}
