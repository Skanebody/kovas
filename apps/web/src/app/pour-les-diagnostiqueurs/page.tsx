import { CrossCheck6Sources } from '@/components/marketing/CrossCheck6Sources'
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
 * KOVAS — Page d'accueil B2B (kovas.fr/pour-les-diagnostiqueurs)
 * Cible : diagnostiqueurs immobiliers indépendants (Avatar Benjamin 43 ans ex-cadre).
 * Brand : sage + dark + chartreuse (DS v5 — sobre productivité B2B).
 */
export const metadata = buildMetadata({
  title: 'KOVAS — Le logiciel terrain pour diagnostiqueurs immobiliers indépendants',
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
    feature: 'Import base depuis Liciel · OBBC · AnalysImmo',
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
    meta: 'Diagnostiqueur Normandie · 6 mois sur KOVAS',
  },
  {
    quote:
      'Import de ma base depuis OBBC en 1 journée. Tous mes anciens dossiers, clients et biens repris sans perte. Je continue à utiliser OBBC pour le calcul DPE, KOVAS me sert pour le terrain.',
    name: 'Sophie L.',
    meta: 'Cabinet Bordeaux · 3 mois sur KOVAS',
  },
  {
    quote:
      'L’annuaire m’apporte en moyenne 8 leads qualifiés par mois. Mon ROI sur l’abonnement était atteint dès le 3ᵉ mois.',
    name: 'Marc D.',
    meta: 'Solopreneur Lyon · 4 mois sur KOVAS',
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
      "15 minutes pour créer ton compte et démarrer ta première mission. Si tu souhaites importer tes données existantes (Liciel, OBBC, AnalysImmo ou autre), compte 1 à 2 jours ouvrés. Notre équipe t'accompagne gratuitement.",
  },
  {
    question: 'Comment importer ma base depuis Liciel, OBBC ou AnalysImmo ?',
    answer:
      'KOVAS est un compagnon, pas un remplaçant : ton logiciel certifié reste ton moteur ADEME. Pour récupérer ta base existante (clients, biens, copropriétés), nous prenons en charge gratuitement l’import. Tu nous envoies tes exports (ZIP, XML, Excel ou CSV selon ton éditeur), nous importons l’intégralité sans perte. Tu continues à utiliser ton logiciel pour le calcul DPE et la soumission ADEME.',
  },
  {
    question: 'Y a-t-il un engagement ?',
    answer:
      'Aucun. Tous nos forfaits sont mensuels sans engagement, résiliables à tout moment depuis ton compte (un clic). Pas de frais cachés, pas de durée minimum.',
  },
  {
    question: 'Comment puis-je résilier ?',
    answer:
      'Depuis ton compte > Facturation > Résilier. La résiliation est immédiate, sans question. Tes données restent accessibles en lecture seule pendant 90 jours avant suppression définitive (conformément au RGPD).',
  },
  {
    question: 'Quelles données puis-je exporter ?',
    answer:
      '100% de tes données, à tout moment, sans frais. Formats compatibles avec les trois éditeurs majeurs : Liciel (Imports spécifiques XML + Excel + ZIP), OBBC (Imports spécifiques XML) et AnalysImmo (XML CII + ZIP). Plus PDF, Word, CSV portables. Tu restes propriétaire de tes données. Aucun verrou éditeur.',
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
      "Oui. Onboarding personnalisé gratuit : visio de 45 min avec un membre de l’équipe pour t'accompagner sur ta première mission. Base de connaissances en ligne avec 50+ articles et tutoriels vidéo.",
  },
]

// Schema.org JSON-LD SoftwareApplication
const SOFTWARE_APPLICATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'KOVAS',
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
        {/* Mécanisme unique — Cross-Check 6 sources data.gouv
            Le différenciateur Tugan : aucun autre logiciel certifié ne
            combine ces 6 sources avant envoi ADEME. Mode static (server-
            friendly, pas d'animation au scroll). */}
        <section className="px-5 sm:px-12 py-20 sm:py-24 border-t border-[#0F1419]/[0.08] bg-sage">
          <div className="max-w-[1240px] mx-auto space-y-10">
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                02bis · Mécanisme unique
              </p>
              <h2
                className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
                style={{ fontSize: 'clamp(32px, 4vw, 52px)' }}
              >
                Avant chaque envoi ADEME, KOVAS croise{' '}
                <span className="font-serif italic font-normal">6 sources publiques</span>.
              </h2>
              <p className="text-[16px] sm:text-[17px] text-[#0F1419]/80 leading-relaxed max-w-xl">
                Cadastre, DVF, ADEME historique, BAN, IGN, Géorisques. Si une incohérence existe
                (DPE shopping, écart cadastre, classe énergie suspecte), KOVAS te le signale AVANT
                envoi. Aucun autre logiciel certifié ne combine ces 6 sources simultanément.
              </p>
            </div>
            <CrossCheck6Sources mode="static" />
          </div>
        </section>
        <B2BFeatures />
        <ComparisonTable
          eyebrow="03 · Comparatif"
          title="KOVAS vs logiciels existants."
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
          title="Réserve ta place dans les 50 premiers."
          description="Bénéficie du tarif Founder à vie sur tous nos forfaits, ainsi que d’un accès anticipé à toutes les fonctionnalités Phase 2."
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
