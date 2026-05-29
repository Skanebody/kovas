import { JsonLd } from '@/components/seo/JsonLd'
import {
  type DiagnosticianSireneBadge,
  fetchDiagnosticianSireneBadge,
} from '@/lib/data-gouv/recherche-entreprises/diagnostician-badge'
import type { AvailabilitySignals } from '@/lib/diag-availability'
import { fetchAvailabilitySignals as fetchAvailabilitySignalsRpc } from '@/lib/diag-availability-fetch'
import { getDiagDisplayName } from '@/lib/diag-certifications'
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
  // Page publique : admin client (bypass RLS) — la fiche d'un diagnostiqueur
  // est visible par tous (anon + authenticated). On évite l'asymétrie d'auth
  // qui masquait la fiche aux users connectés (RLS verified-only).
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()
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
  // Page publique : admin client (bypass RLS) idem fetchDiagnosticianBySlug.
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()
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

/**
 * Fetch verification status — sert à afficher le badge "Vérifié" / "Vérifié+"
 * + la bande Trust Badges (Airbnb pattern) sous le hero.
 *
 * Lecture via service_role pour bypasser le RLS strict de la table.
 */
async function fetchVerificationBadge(diagId: string): Promise<{
  overallStatus: string | null
  badgeLevel: 'unverified' | 'verified' | 'verified_plus'
  identityVerifiedAt: string | null
  cofracVerifiedAt: string | null
  rcproVerifiedAt: string | null
  sireneVerifiedAt: string | null
}> {
  const supabase = await createClient()
  // biome-ignore lint/suspicious/noExplicitAny: table cross-schema; types regen pending
  const { data } = await (supabase as any)
    .from('diagnostician_verification_status')
    .select(
      'overall_status, badge_level, identity_verified_at, cofrac_verified_at, rcpro_verified_at, sirene_verified_at',
    )
    .eq('diagnostician_id', diagId)
    .maybeSingle()
  if (!data) {
    return {
      overallStatus: null,
      badgeLevel: 'unverified',
      identityVerifiedAt: null,
      cofracVerifiedAt: null,
      rcproVerifiedAt: null,
      sireneVerifiedAt: null,
    }
  }
  return {
    overallStatus: (data.overall_status as string | null) ?? null,
    badgeLevel:
      (data.badge_level as 'unverified' | 'verified' | 'verified_plus' | null) ?? 'unverified',
    identityVerifiedAt: (data.identity_verified_at as string | null) ?? null,
    cofracVerifiedAt: (data.cofrac_verified_at as string | null) ?? null,
    rcproVerifiedAt: (data.rcpro_verified_at as string | null) ?? null,
    sireneVerifiedAt: (data.sirene_verified_at as string | null) ?? null,
  }
}

/**
 * Wrapper local — instancie le client admin et délègue au module testable
 * `lib/diag-availability-fetch` (Lot B42).
 */
async function fetchAvailabilitySignals(
  diagId: string,
  diagRow: { last_verified_at?: string | null; updated_at?: string | null },
): Promise<AvailabilitySignals> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()
  return fetchAvailabilitySignalsRpc({
    diagnosticianId: diagId,
    diagRow,
    // biome-ignore lint/suspicious/noExplicitAny: SupabaseClient surface > SupabaseRpcClient
    supabase: supabase as any,
  })
}

/**
 * Récupère le badge "Activité diagnostic immobilier vérifiée" depuis le cache
 * SIRENE 7j (table `sirene_check_cache`). Open data INSEE, lecture publique.
 */
async function fetchSireneBadge(siret: string | null): Promise<DiagnosticianSireneBadge> {
  if (!siret) {
    return {
      isVerified: false,
      nafCode: null,
      nafLabel: null,
      companyName: null,
      legalForm: null,
      siret: null,
    }
  }
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()
  return fetchDiagnosticianSireneBadge(supabase, siret)
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

  const rawFullName =
    (typeof diag.full_name === 'string' && diag.full_name.trim()) ||
    [diag.first_name, diag.last_name].filter(Boolean).join(' ').trim()
  // FIX-RR — Title SEO prefere la raison sociale (DHUP "Societe").
  const displayName =
    getDiagDisplayName({
      company_name: typeof diag.company_name === 'string' ? diag.company_name : null,
      full_name: rawFullName,
    }) || rawFullName
  const cityLabel = decodeURIComponent(city)
  const title = `${displayName} — Diagnostiqueur immobilier à ${cityLabel}`
  const certTypes: string[] = Array.isArray(diag.certifications)
    ? diag.certifications.map((c: { type?: string }) => c.type).filter(Boolean)
    : []
  // FIX-RR — Description : mention "audit energetique avec mention" si applicable.
  const hasMention = certTypes.includes('DPE_MENTION')
  const otherCerts = certTypes.filter((c) => c !== 'DPE_MENTION')
  const certSentence = otherCerts.length ? ` Certifié ${otherCerts.slice(0, 4).join(', ')}.` : ''
  const mentionSentence = hasMention
    ? ' Habilité audit énergétique réglementaire (passoires F/G).'
    : ''
  const description = `${displayName}, diagnostiqueur immobilier à ${cityLabel}.${certSentence}${mentionSentence} Devis gratuit sous 24h.`
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

  // Récupère le SIRET du cabinet — colonne `sirene_siret` (DHUP) ou fallback
  // `siret` legacy. Utilisé pour le badge "Activité diagnostic vérifiée".
  const diagSiret: string | null =
    (typeof diag.sirene_siret === 'string' && diag.sirene_siret) ||
    (typeof diag.siret === 'string' && diag.siret) ||
    null

  const [related, verification, availability, sireneBadge] = await Promise.all([
    fetchRelatedDiagnosticians(diag.city ?? '', String(diag.id), 3),
    fetchVerificationBadge(String(diag.id)),
    fetchAvailabilitySignals(String(diag.id), {
      last_verified_at: typeof diag.last_verified_at === 'string' ? diag.last_verified_at : null,
      updated_at: typeof diag.updated_at === 'string' ? diag.updated_at : null,
    }),
    fetchSireneBadge(diagSiret),
  ])

  // Schema.org JSON-LD Person
  const rawFullName =
    (typeof diag.full_name === 'string' && diag.full_name.trim()) ||
    [diag.first_name, diag.last_name].filter(Boolean).join(' ').trim()
  // FIX-RR — nom commercial public (raison sociale > nom du gerant).
  const displayName =
    getDiagDisplayName({
      company_name: typeof diag.company_name === 'string' ? diag.company_name : null,
      full_name: rawFullName,
    }) || rawFullName
  // `fullName` conserve la valeur "gerant" pour le JSON-LD Person (`name` = personne physique).
  const fullName = rawFullName
  const credentials: Array<{ type?: string; valid_until?: string | null }> = Array.isArray(
    diag.certifications,
  )
    ? diag.certifications
    : []

  // AUDIT-A — Mapping schema canonique consolidé :
  //   official_phone → phone, official_email → email, postal_code → postcode,
  //   street_address → address, slug_dept → department_code/dept_code,
  //   geo_lat/geo_lng → latitude/longitude (fallback geo_lat/lng),
  //   company_name → supprimée (n'existe plus en DB ; on dérive label cabinet via SIRET ailleurs).
  // FIX-PP — `phoneCanonical` ET `emailCanonical` ne sont JAMAIS exposés publiquement
  // (Schema.org `telephone`/`email` exclus, pas de `<a href="tel:|mailto:">`).
  // KOVAS monétise les leads via /devis/[slug]. Le téléphone/email restent en DB,
  // visibles côté dashboard interne via /dashboard/leads/incoming pour le diag claimé.
  const postcodeCanonical: string | null =
    (typeof diag.postcode === 'string' && diag.postcode) ||
    (typeof diag.postal_code === 'string' && diag.postal_code) ||
    null
  const addressCanonical: string | null =
    (typeof diag.address === 'string' && diag.address) ||
    (typeof diag.street_address === 'string' && diag.street_address) ||
    null
  const latCanonical: number | null =
    typeof diag.latitude === 'number'
      ? diag.latitude
      : typeof diag.geo_lat === 'number'
        ? diag.geo_lat
        : null
  const lngCanonical: number | null =
    typeof diag.longitude === 'number'
      ? diag.longitude
      : typeof diag.geo_lng === 'number'
        ? diag.geo_lng
        : null
  const deptCanonical: string =
    (typeof diag.department_code === 'string' && diag.department_code) ||
    (typeof diag.dept_code === 'string' && diag.dept_code) ||
    dept

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: fullName,
    jobTitle: 'Diagnostiqueur immobilier',
    image: diag.photo_url ?? undefined,
    // FIX-PP — `telephone` et `email` volontairement OMIS du JSON-LD public.
    // Modèle Doctolib : pas d'exposition direct du numéro ni de l'email côté SERP/SEO.
    address: {
      '@type': 'PostalAddress',
      addressLocality: diag.city ?? undefined,
      postalCode: postcodeCanonical ?? undefined,
      addressCountry: 'FR',
    },
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
    // FIX-RR — LocalBusiness.name = raison sociale en priorite (nom commercial Google).
    fullName: displayName,
    slug: String(diag.slug ?? slug),
    city: String(diag.city ?? decodeURIComponent(city)),
    postalCode: postcodeCanonical ?? undefined,
    dept: deptCanonical,
    streetAddress: addressCanonical ?? undefined,
    geoLat: latCanonical ?? undefined,
    geoLng: lngCanonical ?? undefined,
    certifications: certForSchema.length ? certForSchema : undefined,
    // FIX-PP — phone ET email OMIS du LocalBusiness Schema.org.
    // Tout lead doit passer par /devis/[slug] (monétisation + RGPD).
    photoUrl: typeof diag.photo_url === 'string' ? diag.photo_url : undefined,
    bio: typeof diag.bio === 'string' ? diag.bio : undefined,
    rating: typeof diag.gmb_rating === 'number' ? diag.gmb_rating : undefined,
    reviewCount: typeof diag.gmb_review_count === 'number' ? diag.gmb_review_count : undefined,
  }

  // Libellés breadcrumb humanlisibles (dérive du slug si pas de label dédié).
  const deptLabel = humanizeSlug(deptCanonical)
  const cityLabel = String(diag.city ?? decodeURIComponent(city))
  const slugDept = deptCanonical
  const slugCity = String(diag.city_slug ?? diag.slug_city ?? city)
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
              // FIX-RR — Breadcrumb terminal = raison sociale (nom commercial public).
              name: displayName,
              path: `/trouver-un-diagnostiqueur/${slugDept}/${slugCity}/${slugProfile}`,
            },
          ]),
        ]}
      />
      <DiagnosticianPageContent
        diagnostician={sanitizeDiagPublic(diag)}
        related={related.map(sanitizeDiagPublic)}
        dept={dept}
        city={city}
        badgeLevel={verification.badgeLevel}
        availability={availability}
        sireneBadge={sireneBadge}
        trustBadges={{
          identityVerifiedAt: verification.identityVerifiedAt,
          cofracVerifiedAt: verification.cofracVerifiedAt,
          hasCertifications: Array.isArray(diag.certifications) && diag.certifications.length > 0,
          rcproVerifiedAt: verification.rcproVerifiedAt,
          sireneVerified: Boolean(sireneBadge?.isVerified) || Boolean(diagSiret),
          responseBucketFast: availability?.responseBucket === 'fast',
        }}
      />
    </>
  )
}

/**
 * Retire les champs sensibles (phone, email, claim tokens, etc.) avant
 * sérialisation RSC vers les Client Components.
 *
 * FIX-PP — bug critique de fuite : Next.js sérialise l'intégralité des
 * props passées aux RSC dans `__next_f` du HTML pour l'hydratation. Si on
 * passe `diag` complet (qui contient `phone`, `email` lus depuis la table
 * `diagnosticians`), ces données apparaissent en clair dans le HTML rendu
 * — même si elles ne sont pas affichées visuellement. Conséquence : un
 * particulier qui inspecte la source ou consulte le cache Google trouve
 * le téléphone du diag → contact direct → KOVAS ne touche pas la
 * commission du lead.
 *
 * Whitelist des champs publics SEULEMENT. Tout nouveau champ DB doit être
 * explicitement ajouté ici si on veut le rendre visible côté client public.
 */
// biome-ignore lint/suspicious/noExplicitAny: DiagnosticianRow = any (types DB pas régénérés)
function sanitizeDiagPublic(diag: any): any {
  if (!diag || typeof diag !== 'object') return diag
  return {
    id: diag.id,
    slug: diag.slug,
    full_name: diag.full_name,
    // FIX-RR — company_name (raison sociale DHUP "Societe") whitelistee
    // pour l'UI publique. Si NULL, l'UI fallback sur full_name.
    company_name: diag.company_name,
    first_name: diag.first_name,
    last_name: diag.last_name,
    bio: diag.bio,
    photo_url: diag.photo_url,
    city: diag.city,
    city_slug: diag.city_slug,
    postcode: diag.postcode,
    address: diag.address, // adresse postale — publique (annuaire SEO)
    department_code: diag.department_code,
    dept_code: diag.dept_code,
    region_code: diag.region_code,
    region_name: diag.region_name,
    latitude: diag.latitude,
    longitude: diag.longitude,
    geo_lat: diag.geo_lat,
    geo_lng: diag.geo_lng,
    // Rayon d'intervention (km) — whitelisté pour que la carte affiche le rayon
    // réel du diagnostiqueur (sinon fallback 30 km côté client).
    intervention_radius_km: diag.intervention_radius_km,
    certifications: diag.certifications,
    years_active: diag.years_active,
    years_experience: diag.years_experience, // alias legacy, lecture safe
    gmb_rating: diag.gmb_rating,
    gmb_review_count: diag.gmb_review_count,
    claim_status: diag.claim_status,
    is_published: diag.is_published,
    withdrawal_requested: diag.withdrawal_requested,
    created_at: diag.created_at,
    // Identité légale OPEN DATA INSEE — registre SIRENE accessible librement
    // via api.gouv.fr Recherche d'Entreprises (sans clé, sans inscription).
    // C'est l'équivalent du RPPS de Doctolib : preuve d'existence légale
    // que l'on EXPOSE volontairement pour la transparence annuaire.
    // Cf. CLAUDE.md §6 + docs/data-gouv-opportunities.md §2.5.
    sirene_siret: diag.sirene_siret,
    naf_code: diag.naf_code,
    naf_label: diag.naf_label,
    legal_form: diag.legal_form,
    creation_date: diag.creation_date,
    // Tier d'abonnement annuaire — détermine le rendu visuel de la carte
    // d'intervention. Publique (l'utilisateur le voit visuellement, pas de
    // données sensibles cachées derrière). Cf. migration 20260527160000.
    annuaire_tier: diag.annuaire_tier,
    highlighted_cities: diag.highlighted_cities,
    // VOLONTAIREMENT OMIS — données vraiment sensibles non-publiques :
    //   phone, email, official_phone, official_email, phone_e164,
    //   contact_email, dhup_source_id, claimed_by_user_id, fraud_flags,
    //   validation_status_reason, etc.
  }
}

/** Convertit un slug ("seine-maritime") en label humain ("Seine Maritime"). */
function humanizeSlug(slugInput: string): string {
  if (!slugInput) return ''
  return slugInput
    .split('-')
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}
