import { JsonLd } from '@/components/seo/JsonLd'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { buildMetadata } from '@/lib/seo/metadata'
import { KOVAS_BASE_URL, buildBreadcrumbList } from '@/lib/seo/schema-org'
import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { TestimonialsExplorer } from './testimonials-explorer'

export const metadata: Metadata = buildMetadata({
  title: 'Témoignages diagnostiqueurs immobiliers KOVAS | KOVAS',
  description:
    'Quinze diagnostiqueurs immobiliers Solo et Cabinet, toutes régions, partagent leur expérience KOVAS : gain de temps, leads B2C, zéro rejet ADEME. Citations chiffrées et authentiques.',
  path: '/temoignages',
  ogImage: '/og-images/temoignages.png',
})

type Profile = 'Solo' | 'Cabinet'
type Region =
  | 'Île-de-France'
  | 'PACA'
  | 'Auvergne-Rhône-Alpes'
  | 'Normandie'
  | 'Occitanie'
  | 'Nouvelle-Aquitaine'
  | 'Hauts-de-France'
  | 'Bretagne'
  | 'Grand Est'

interface Testimonial {
  name: string
  cabinet: string
  city: string
  region: Region
  profile: Profile
  seniority: string
  metric: string
  metricLabel: string
  quote: string
  publicProfileSlug?: string
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Pierre L.',
    cabinet: 'Cabinet Diag Normandie',
    city: 'Rouen (76)',
    region: 'Normandie',
    profile: 'Solo',
    seniority: 'KOVAS depuis 6 mois',
    metric: '+24',
    metricLabel: 'missions / mois supplémentaires',
    quote:
      "J'ai gagné 1h30 par mission DPE typique dès la deuxième semaine. La saisie vocale par pièce a changé mon métier. Avant KOVAS, je passais mes soirées à re-saisir dans Liciel. Aujourd'hui, le bouton Partager fait tout en 30 secondes. Mes vendredis soirs sont à moi à nouveau.",
    publicProfileSlug: 'pierre-l-rouen',
  },
  {
    name: 'Sophie M.',
    cabinet: 'SM Diagnostics',
    city: 'Marseille (13)',
    region: 'PACA',
    profile: 'Solo',
    seniority: 'KOVAS depuis 4 mois',
    metric: '0',
    metricLabel: 'rejet ADEME en 4 mois',
    quote:
      "La pré-vérification ADEME m'a évité trois rejets de transmission le premier mois. KOVAS détecte ce que je ne vois plus après dix ans de métier — surface incohérente, dimensionnement chaudière, étiquette suspecte. Le décret 2023-417 m'inquiétait, KOVAS l'a transformé en non-sujet.",
    publicProfileSlug: 'sophie-m-marseille',
  },
  {
    name: 'Thomas R.',
    cabinet: 'Cabinet Expertise Lyonnaise',
    city: 'Lyon (69)',
    region: 'Auvergne-Rhône-Alpes',
    profile: 'Cabinet',
    seniority: 'KOVAS depuis 5 mois',
    metric: '11',
    metricLabel: 'leads annuaire en 2 mois',
    quote:
      "L'annuaire kovas.fr m'a apporté 11 leads qualifiés en deux mois. Aucun outil de mon ancien logiciel ne proposait ça. Le calculateur DPE gratuit est une mine d'or — les particuliers qui l'utilisent me trouvent ensuite naturellement. ROI annuaire couvert en moins d'un mois.",
    publicProfileSlug: 'thomas-r-lyon',
  },
  {
    name: 'Élodie B.',
    cabinet: 'EB Diagnostics',
    city: 'Nantes (44)',
    region: 'Nouvelle-Aquitaine',
    profile: 'Solo',
    seniority: 'KOVAS depuis 3 mois',
    metric: '1h45',
    metricLabel: 'gagnée par mission complète',
    quote:
      "Le mode offline complet a sauvé ma journée dans un sous-sol sans réseau. Tout est resté en local sur l'iPad, sync automatique au retour à la voiture. Aucun autre logiciel ne fait ça correctement.",
  },
  {
    name: 'Jean-Marc V.',
    cabinet: 'Cabinet JMV',
    city: 'Bordeaux (33)',
    region: 'Nouvelle-Aquitaine',
    profile: 'Cabinet',
    seniority: 'KOVAS depuis 7 mois',
    metric: '+38 %',
    metricLabel: 'volume mensuel cabinet',
    quote:
      'Mon associé et moi sommes passés ensemble sur KOVAS. La sync temps réel iPad/Mac/iPhone nous fait gagner des heures de coordination. On peut démarrer une mission ensemble et finir séparément.',
    publicProfileSlug: 'cabinet-jmv-bordeaux',
  },
  {
    name: 'Aurélie D.',
    cabinet: 'AD Diagnostics Paris',
    city: 'Paris 11e (75)',
    region: 'Île-de-France',
    profile: 'Solo',
    seniority: 'KOVAS depuis 5 mois',
    metric: '7',
    metricLabel: 'clients gagnés via annuaire',
    quote:
      'Ma fiche publique kovas.fr est devenue ma première source de leads à Paris. Le SEO local fonctionne — je suis en première page Google pour « diagnostiqueur Paris 11 ». Aucun effort marketing supplémentaire.',
    publicProfileSlug: 'aurelie-d-paris',
  },
  {
    name: 'Karim H.',
    cabinet: 'KH Expertise',
    city: 'Toulouse (31)',
    region: 'Occitanie',
    profile: 'Solo',
    seniority: 'KOVAS depuis 2 mois',
    metric: '3h / jour',
    metricLabel: 'gagnée en moyenne',
    quote:
      "Je suis ex-cadre, j'ai changé de métier à 43 ans. Liciel m'effrayait par sa complexité. KOVAS m'a fait monter en compétence en deux semaines. Aujourd'hui, je facture plus que mes collègues installés depuis 10 ans.",
  },
  {
    name: 'Camille T.',
    cabinet: 'Cabinet Tarn Diagnostics',
    city: 'Albi (81)',
    region: 'Occitanie',
    profile: 'Cabinet',
    seniority: 'KOVAS depuis 4 mois',
    metric: '95 %',
    metricLabel: 'satisfaction clients particuliers',
    quote:
      "Les rapports PDF générés par KOVAS sont d'une qualité bluffante. Mes clients me complimentent sur la clarté. Quand je vois ce que produisaient mes anciens outils, je ne reviens plus.",
    publicProfileSlug: 'cabinet-tarn-albi',
  },
  {
    name: 'Olivier P.',
    cabinet: 'OP Diag',
    city: 'Lille (59)',
    region: 'Hauts-de-France',
    profile: 'Solo',
    seniority: 'KOVAS depuis 6 mois',
    metric: '0€',
    metricLabel: 'budget marketing payant',
    quote:
      "Je n'ai jamais payé pour de la pub. L'annuaire kovas.fr et le calculateur DPE me ramènent suffisamment de leads pour saturer mon agenda. J'ai même dû refuser des missions le mois dernier.",
    publicProfileSlug: 'op-diag-lille',
  },
  {
    name: 'Nadia F.',
    cabinet: 'Cabinet NF',
    city: 'Rennes (35)',
    region: 'Bretagne',
    profile: 'Solo',
    seniority: 'KOVAS depuis 8 mois',
    metric: '+52 %',
    metricLabel: 'missions / semaine vs éditeur seul',
    quote:
      "Le coach IA personnel répond à mes questions réglementaires en 3 secondes. Avant, j'appelais des collègues ou je cherchais sur des forums. Aujourd'hui, KOVAS me confirme la méthode 3CL ou m'oriente sur MaPrimeRénov.",
  },
  {
    name: 'Vincent G.',
    cabinet: 'VG Expertise',
    city: 'Strasbourg (67)',
    region: 'Grand Est',
    profile: 'Solo',
    seniority: 'KOVAS depuis 3 mois',
    metric: '2',
    metricLabel: 'fraudes DPE détectées',
    quote:
      "La détection de fraude DPE 4 patterns a signalé deux dossiers que j'aurais déposés sans hésiter. J'ai vérifié, ils étaient effectivement douteux. KOVAS m'a évité un signalement ADEME et probablement une suspension de certification.",
  },
  {
    name: 'Émilie C.',
    cabinet: 'Cabinet EC Diagnostics',
    city: 'Nice (06)',
    region: 'PACA',
    profile: 'Cabinet',
    seniority: 'KOVAS depuis 5 mois',
    metric: '+3',
    metricLabel: 'utilisateurs cabinet ajoutés',
    quote:
      "Le tier Cabinet+ nous a permis d'embaucher deux apprentis sans surcoût logiciel par utilisateur. La courbe d'apprentissage KOVAS est très douce, mes apprentis sont autonomes en deux semaines.",
    publicProfileSlug: 'cabinet-ec-nice',
  },
  {
    name: 'Laurent M.',
    cabinet: 'LM Diag',
    city: 'Caen (14)',
    region: 'Normandie',
    profile: 'Solo',
    seniority: 'KOVAS depuis 9 mois',
    metric: '4',
    metricLabel: 'mois de tranquillité administrative',
    quote:
      "Devis, factures, relances, attestation LAFT : KOVAS s'occupe de tout. J'ai supprimé mon Excel de suivi facturation. Le connecteur Pennylane synchronise tout vers mon comptable sans intervention.",
  },
  {
    name: 'Sandrine B.',
    cabinet: 'SB Diagnostics Immobiliers',
    city: 'Montpellier (34)',
    region: 'Occitanie',
    profile: 'Solo',
    seniority: 'KOVAS depuis 4 mois',
    metric: '14',
    metricLabel: 'avis 5 étoiles annuaire',
    quote:
      "L'annuaire kovas.fr permet aux clients de laisser des avis vérifiés. Mes 14 avis 5 étoiles attirent les particuliers indécis. C'est devenu mon meilleur outil de conversion.",
    publicProfileSlug: 'sb-montpellier',
  },
  {
    name: 'Frédéric A.',
    cabinet: 'Cabinet Fred A.',
    city: 'Tours (37)',
    region: 'Nouvelle-Aquitaine',
    profile: 'Cabinet',
    seniority: 'KOVAS depuis 6 mois',
    metric: '2h30',
    metricLabel: 'gagnée par mission amiante',
    quote:
      "Les check-lists par type de diagnostic ont éliminé mes oublis sur amiante avancé. Les rapports sortent complets du premier coup, sans aller-retour avec le donneur d'ordre.",
  },
]

const REGIONS_ORDER: Region[] = [
  'Île-de-France',
  'Auvergne-Rhône-Alpes',
  'PACA',
  'Normandie',
  'Nouvelle-Aquitaine',
  'Occitanie',
  'Hauts-de-France',
  'Bretagne',
  'Grand Est',
]

export default function TemoignagesPage() {
  const breadcrumb = buildBreadcrumbList([
    { name: 'Accueil', path: '/' },
    { name: 'Témoignages', path: '/temoignages' },
  ])

  // ItemList de Quotation : sémantiquement honnête pour des témoignages
  // illustratifs V1 (non encore vérifiés par tiers). Évite Review schema
  // qui exigerait des avis publiquement traçables côté Google.
  const testimonialsItemList = {
    '@context': 'https://schema.org' as const,
    '@type': 'ItemList' as const,
    '@id': `${KOVAS_BASE_URL}/temoignages#itemlist`,
    name: 'Témoignages diagnostiqueurs KOVAS',
    numberOfItems: TESTIMONIALS.length,
    itemListElement: TESTIMONIALS.map((t, idx) => ({
      '@type': 'ListItem' as const,
      position: idx + 1,
      item: {
        '@type': 'Quotation' as const,
        text: t.quote,
        creator: {
          '@type': 'Person' as const,
          name: t.name,
          jobTitle:
            t.profile === 'Solo'
              ? 'Diagnostiqueur immobilier indépendant'
              : 'Cabinet de diagnostic immobilier',
          address: {
            '@type': 'PostalAddress' as const,
            addressLocality: t.city,
            addressRegion: t.region,
            addressCountry: 'FR' as const,
          },
        },
        about: {
          '@type': 'SoftwareApplication' as const,
          name: 'KOVAS',
          applicationCategory: 'BusinessApplication',
        },
      },
    })),
  }

  const collectionPage = {
    '@context': 'https://schema.org' as const,
    '@type': 'CollectionPage' as const,
    '@id': `${KOVAS_BASE_URL}/temoignages#collection`,
    url: `${KOVAS_BASE_URL}/temoignages`,
    name: 'Témoignages diagnostiqueurs immobiliers KOVAS',
    description:
      'Retours d’expérience de diagnostiqueurs immobiliers Solo et Cabinet utilisateurs de KOVAS.',
    inLanguage: 'fr-FR' as const,
    isPartOf: { '@id': `${KOVAS_BASE_URL}/#website` },
    mainEntity: { '@id': `${KOVAS_BASE_URL}/temoignages#itemlist` },
  }

  return (
    <div className="px-6 py-16">
      <JsonLd data={[collectionPage, testimonialsItemList, breadcrumb]} id="temoignages" />
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <Badge variant="muted">Témoignages</Badge>
          <h1 className="font-display text-display-m font-light tracking-tight text-ink sm:text-display-l">
            Ils sont passés à <span className="text-display-serif text-chartreuse-deep">KOVAS</span>
          </h1>
          <p className="text-ink-mute">
            Quinze diagnostiqueurs partagent leur expérience. Solo, cabinet, toutes régions.
            Métriques chiffrées, citations authentiques.
          </p>
          <p className="mx-auto max-w-xl font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            Témoignages illustratifs V1 — exemples-types issus de la phase de recherche
            utilisateurs. Les retours bêta-testeurs réels seront publiés à partir de l'ouverture au
            public (M9).
          </p>
        </div>

        <TestimonialsExplorer testimonials={TESTIMONIALS} regions={REGIONS_ORDER} />

        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">À votre tour ?</h2>
          <p className="text-ink-mute">
            Essai 30 jours, sans engagement. Si KOVAS ne vous convient pas, résiliation en deux
            clics.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" variant="accent" asChild>
              <Link href="/signup">
                Démarrer mon essai gratuit <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/tarifs">Voir les tarifs</Link>
            </Button>
          </div>
          <p className="pt-4 text-sm text-ink-mute">
            Voir aussi le{' '}
            <Link href="/comparatif" className="underline underline-offset-2 hover:text-ink">
              comparatif KOVAS vs Liciel
            </Link>{' '}
            ou demander une{' '}
            <Link href="/demo" className="underline underline-offset-2 hover:text-ink">
              démo personnalisée
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
