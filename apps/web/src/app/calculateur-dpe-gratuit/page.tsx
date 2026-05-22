/**
 * KOVAS — Calculateur DPE gratuit (Lot #143)
 *
 * Server Component — pivot SEO + lead capture B2C.
 *
 *  - Métadonnées SEO complètes (title, description, OG, Twitter, canonical)
 *  - JSON-LD : WebApplication + Service (Calcul DPE) + BreadcrumbList
 *  - Geoloc IP via headers Vercel (`x-vercel-ip-city`) → personnalisation CTA
 *  - Délégation à `<CalculatorClient>` pour toute la logique interactive
 *
 * Avatar particulier propriétaire : ton SOBRE PROFESSIONNEL, vouvoiement,
 * pas d'emoji marketing.
 */

import { ShieldCheck, Sparkles, Timer } from 'lucide-react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import type {
  BreadcrumbList,
  Service,
  WebApplication,
  WithContext,
} from 'schema-dts'

import { CalculatorClient } from './calculator-client'

export const metadata: Metadata = {
  title: 'Calculateur DPE gratuit en ligne · Estimation immédiate · KOVAS',
  description:
    'Estimez gratuitement la classe énergétique de votre bien en 2 minutes. 8 questions simples. Résultat immédiat. Recevez ensuite des devis de diagnostiqueurs certifiés près de chez vous.',
  alternates: {
    canonical: 'https://kovas.fr/calculateur-dpe-gratuit',
  },
  openGraph: {
    title: 'Calculateur DPE gratuit en ligne · Estimation immédiate · KOVAS',
    description:
      'Estimez gratuitement la classe énergétique de votre bien en 2 minutes. Résultat immédiat. Devis de diagnostiqueurs certifiés en option.',
    url: 'https://kovas.fr/calculateur-dpe-gratuit',
    siteName: 'KOVAS',
    locale: 'fr_FR',
    type: 'website',
    images: [
      {
        url: '/og-calculateur-dpe.png',
        width: 1200,
        height: 630,
        alt: 'Calculateur DPE KOVAS — estimation gratuite en 2 minutes',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calculateur DPE gratuit · Estimation immédiate · KOVAS',
    description:
      '8 questions, 2 minutes : estimez la classe énergétique de votre bien et trouvez un diagnostiqueur certifié.',
    images: ['/og-calculateur-dpe.png'],
  },
  robots: { index: true, follow: true },
}

const SITE_URL = 'https://kovas.fr' as const

function getWebApplicationSchema(): WithContext<WebApplication> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Calculateur DPE KOVAS',
    url: `${SITE_URL}/calculateur-dpe-gratuit`,
    description:
      'Outil en ligne gratuit pour estimer la classe énergétique probable (A-G) d’un logement en France. Basé sur 8 questions simples.',
    inLanguage: 'fr-FR',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any (PWA)',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
    },
    publisher: {
      '@type': 'Organization',
      name: 'NEXUS 1993',
      url: SITE_URL,
    },
  }
}

function getServiceSchema(): WithContext<Service> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Estimation de classe énergétique DPE',
    serviceType: 'Estimation énergétique en ligne',
    provider: {
      '@type': 'Organization',
      name: 'NEXUS 1993',
      url: SITE_URL,
    },
    areaServed: { '@type': 'Country', name: 'France' },
    description:
      'Estimation indicative et gratuite de la classe énergétique d’un logement à partir de 8 critères. Ne remplace pas un DPE officiel établi par un diagnostiqueur certifié.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
    },
  }
}

function getBreadcrumbSchema(): WithContext<BreadcrumbList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Accueil',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Calculateur DPE gratuit',
        item: `${SITE_URL}/calculateur-dpe-gratuit`,
      },
    ],
  }
}

interface GeolocResult {
  city: string | null
  department: string | null
}

async function getRequestGeoloc(): Promise<GeolocResult> {
  try {
    const h = await headers()
    const cityRaw = h.get('x-vercel-ip-city')
    const city = cityRaw ? decodeURIComponent(cityRaw) : null

    // Département : on essaie d'utiliser x-vercel-ip-postal-code (2 premiers chiffres)
    const postal = h.get('x-vercel-ip-postal-code')
    const department = postal && /^\d{2}/.test(postal) ? postal.slice(0, 2) : null

    return { city, department }
  } catch {
    return { city: null, department: null }
  }
}

/**
 * Helper local pour injecter du JSON-LD typé `schema-dts`.
 *
 * On reproduit ici le composant `<StructuredData>` plutôt que d'importer
 * depuis `@/components/seo/structured-data` (qui n'existe peut-être pas dans
 * tous les forks du worktree). Logique identique : sérialisation +
 * neutralisation de `</script>`.
 */
function StructuredData<T extends import('schema-dts').Thing>({
  schema,
  id,
}: {
  schema: WithContext<T>
  id?: string
}) {
  const safeJson = JSON.stringify(schema).replace(/</g, '\\u003c')
  return (
    <script
      type="application/ld+json"
      id={id}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: nécessaire pour JSON-LD non-HTML-encodé
      dangerouslySetInnerHTML={{ __html: safeJson }}
    />
  )
}

export default async function CalculateurDpeGratuitPage() {
  const { city, department } = await getRequestGeoloc()

  return (
    <>
      <StructuredData schema={getWebApplicationSchema()} id="webapp-jsonld" />
      <StructuredData schema={getServiceSchema()} id="service-jsonld" />
      <StructuredData schema={getBreadcrumbSchema()} id="breadcrumb-jsonld" />

      <div className="min-h-dvh bg-cream">
        {/* Hero compact */}
        <header className="border-b border-border bg-paper">
          <div className="mx-auto max-w-3xl px-4 py-8 text-center sm:py-12">
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-pill border border-border bg-cream px-3 py-1 text-[11px] font-mono uppercase tracking-wide text-ink-mute">
              <Sparkles className="size-3" aria-hidden />
              Outil gratuit
            </p>
            <h1 className="font-display text-[32px] font-bold leading-tight text-ink sm:text-[44px]">
              Calculateur DPE gratuit{' '}
              <span className="font-serif italic text-chartreuse-deep">
                en 2 minutes
              </span>
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-ink-mute sm:text-[16px]">
              Estimez la classe énergétique probable de votre logement en répondant
              à 8 questions simples. Résultat immédiat et confidentiel.
            </p>

            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-ink-mute">
              <li className="inline-flex items-center gap-1.5">
                <Timer className="size-3.5 text-chartreuse-deep" aria-hidden />
                Moins de 2 minutes
              </li>
              <li className="inline-flex items-center gap-1.5">
                <ShieldCheck
                  className="size-3.5 text-chartreuse-deep"
                  aria-hidden
                />
                Confidentiel, RGPD
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-chartreuse-deep" aria-hidden />
                Sans inscription
              </li>
            </ul>
          </div>
        </header>

        <CalculatorClient
          detectedCity={city}
          detectedDepartment={department}
        />

        {/* Disclaimer légal en bas */}
        <footer className="border-t border-border bg-paper">
          <div className="mx-auto max-w-3xl px-4 py-6 text-center text-[12px] leading-relaxed text-ink-mute">
            <p>
              Cette estimation est <strong>indicative et non opposable</strong>.
              Seul un DPE officiel établi par un diagnostiqueur certifié a une
              valeur réglementaire pour une vente, une location ou une
              déclaration d'audit énergétique.
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}
