import { JsonLd } from '@/components/seo/JsonLd'
import {
  type DiagnosticianForSchema,
  buildBreadcrumbList,
  buildLocalBusinessSchema,
} from '@/lib/seo/schema-org'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DiagnosticianPageContent } from './diagnostician-page-content'

type RouteParams = {
  dept: string
  city: string
  slug: string
}

type PageProps = {
  params: Promise<RouteParams>
}

const SITE_URL = 'https://kovas.fr'

// Type minimal — A1 régénère le type définitif depuis Supabase
// biome-ignore lint/suspicious/noExplicitAny: A1 creates the type
type DiagnosticianRow = any

async function fetchDiagnosticianBySlug(slug: string): Promise<DiagnosticianRow | null> {
  const supabase = await createClient()
  // A1 creates the type — table `diagnosticians` not yet in generated types.
  // biome-ignore lint/suspicious/noExplicitAny: A1 creates the type
  const { data, error } = await (supabase as any)
    .from('diagnosticians')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) return null
  return data as DiagnosticianRow
}

async function fetchRelatedDiagnosticians(
  city: string,
  excludeId: string,
  limit = 3,
): Promise<DiagnosticianRow[]> {
  const supabase = await createClient()
  // biome-ignore lint/suspicious/noExplicitAny: A1 creates the type
  const { data, error } = await (supabase as any)
    .from('diagnosticians')
    .select('*')
    .eq('city', city)
    .neq('id', excludeId)
    .eq('withdrawal_requested', false)
    .limit(limit)

  if (error || !data) return []
  return data as DiagnosticianRow[]
}

async function incrementViewCount(id: string): Promise<void> {
  try {
    const supabase = await createClient()
    // Fire-and-forget — pas critique si ça échoue.
    // biome-ignore lint/suspicious/noExplicitAny: A1 creates the type / RPC
    await (supabase as any).rpc('increment_diagnostician_view', { p_id: id })
  } catch {
    /* swallow */
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { dept, city, slug } = await params
  const diag = await fetchDiagnosticianBySlug(slug)

  if (!diag || diag.withdrawal_requested === true) {
    return {
      title: 'Diagnostiqueur introuvable',
      robots: { index: false, follow: false },
    }
  }

  const fullName = [diag.first_name, diag.last_name].filter(Boolean).join(' ').trim()
  const cityLabel = decodeURIComponent(city)
  const title = `${fullName} — Diagnostiqueur immobilier à ${cityLabel}`
  const certTypes: string[] = Array.isArray(diag.certifications)
    ? diag.certifications.map((c: { type?: string }) => c.type).filter(Boolean)
    : []
  const certSentence = certTypes.length ? ` Certifié ${certTypes.slice(0, 4).join(', ')}.` : ''
  const description = `${fullName}, diagnostiqueur immobilier indépendant à ${cityLabel}.${certSentence} Devis gratuit sous 24h.`
  const canonical = `${SITE_URL}/trouver-un-diagnostiqueur/${dept}/${city}/${slug}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'profile',
      url: canonical,
      title,
      description,
      siteName: 'KOVAS',
      locale: 'fr_FR',
      images: diag.photo_url ? [{ url: diag.photo_url }] : undefined,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    robots: {
      index: diag.claim_status !== 'flagged_removed',
      follow: true,
    },
  }
}

export default async function DiagnosticianPage({ params }: PageProps) {
  const { dept, city, slug } = await params
  const diag = await fetchDiagnosticianBySlug(slug)

  if (!diag || diag.withdrawal_requested === true) {
    notFound()
  }

  // Fire-and-forget incrément vue (n'attend pas, n'interrompt jamais le rendu)
  void incrementViewCount(String(diag.id))

  const related = await fetchRelatedDiagnosticians(diag.city ?? '', String(diag.id), 3)

  // Schema.org JSON-LD Person
  const fullName = [diag.first_name, diag.last_name].filter(Boolean).join(' ').trim()
  const credentials: Array<{ type?: string; valid_until?: string | null }> = Array.isArray(
    diag.certifications,
  )
    ? diag.certifications
    : []

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: fullName,
    jobTitle: 'Diagnostiqueur immobilier',
    image: diag.photo_url ?? undefined,
    telephone: diag.official_phone ?? undefined,
    email: diag.official_email ?? undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: diag.city ?? undefined,
      postalCode: diag.postal_code ?? undefined,
      addressCountry: 'FR',
    },
    worksFor: diag.company_name ? { '@type': 'Organization', name: diag.company_name } : undefined,
    hasCredential: credentials.map((c) => ({
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: `Certification ${c.type ?? ''}`.trim(),
      validIn: c.valid_until ?? undefined,
    })),
    aggregateRating:
      typeof diag.gmb_rating === 'number' && typeof diag.gmb_review_count === 'number'
        ? {
            '@type': 'AggregateRating',
            ratingValue: diag.gmb_rating,
            reviewCount: diag.gmb_review_count,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
    url: `${SITE_URL}/trouver-un-diagnostiqueur/${dept}/${city}/${slug}`,
  }

  // LocalBusiness Schema.org enrichi (complète le Person ci-dessus).
  const certForSchema: Array<{ type: string }> = credentials
    .map((c) => ({ type: c.type ?? '' }))
    .filter((c) => c.type !== '')

  const diagSchemaInput: DiagnosticianForSchema = {
    fullName,
    slug: String(diag.slug ?? slug),
    city: String(diag.city ?? decodeURIComponent(city)),
    postalCode: typeof diag.postal_code === 'string' ? diag.postal_code : undefined,
    dept: String(diag.slug_dept ?? dept),
    streetAddress: typeof diag.street_address === 'string' ? diag.street_address : undefined,
    geoLat: typeof diag.geo_lat === 'number' ? diag.geo_lat : undefined,
    geoLng: typeof diag.geo_lng === 'number' ? diag.geo_lng : undefined,
    certifications: certForSchema.length ? certForSchema : undefined,
    phone: typeof diag.official_phone === 'string' ? diag.official_phone : undefined,
    email: typeof diag.official_email === 'string' ? diag.official_email : undefined,
    photoUrl: typeof diag.photo_url === 'string' ? diag.photo_url : undefined,
    bio: typeof diag.bio === 'string' ? diag.bio : undefined,
    rating: typeof diag.gmb_rating === 'number' ? diag.gmb_rating : undefined,
    reviewCount: typeof diag.gmb_review_count === 'number' ? diag.gmb_review_count : undefined,
  }

  // Libellés breadcrumb humanlisibles (dérive du slug si pas de label dédié).
  const deptLabel = humanizeSlug(String(diag.slug_dept ?? dept))
  const cityLabel = String(diag.city ?? decodeURIComponent(city))
  const slugDept = String(diag.slug_dept ?? dept)
  const slugCity = String(diag.slug_city ?? city)
  const slugProfile = String(diag.slug ?? slug)

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <JsonLd
        id={`diag-${slugProfile}`}
        data={[
          buildLocalBusinessSchema(diagSchemaInput),
          buildBreadcrumbList([
            { name: 'Accueil', path: '/' },
            { name: 'Diagnostiqueurs', path: '/trouver-un-diagnostiqueur' },
            { name: deptLabel, path: `/trouver-un-diagnostiqueur/${slugDept}` },
            {
              name: cityLabel,
              path: `/trouver-un-diagnostiqueur/${slugDept}/${slugCity}`,
            },
            {
              name: fullName,
              path: `/trouver-un-diagnostiqueur/${slugDept}/${slugCity}/${slugProfile}`,
            },
          ]),
        ]}
      />
      <DiagnosticianPageContent diagnostician={diag} related={related} dept={dept} city={city} />
    </>
  )
}

/** Convertit un slug ("seine-maritime") en label humain ("Seine Maritime"). */
function humanizeSlug(slugInput: string): string {
  if (!slugInput) return ''
  return slugInput
    .split('-')
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}
