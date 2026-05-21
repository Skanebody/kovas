import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
  const certSentence = certTypes.length
    ? ` Certifié ${certTypes.slice(0, 4).join(', ')}.`
    : ''
  const description = `${fullName}, diagnostiqueur immobilier indépendant à ${cityLabel}.${certSentence} Devis gratuit sous 24h.`
  const canonical = `${SITE_URL}/diagnostiqueurs/${dept}/${city}/${slug}`

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
    worksFor: diag.company_name
      ? { '@type': 'Organization', name: diag.company_name }
      : undefined,
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
    url: `${SITE_URL}/diagnostiqueurs/${dept}/${city}/${slug}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DiagnosticianPageContent
        diagnostician={diag}
        related={related}
        dept={dept}
        city={city}
      />
    </>
  )
}
