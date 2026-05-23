import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { parseCertCodes, type DiagCertCode } from '@/lib/diag-certifications'
import { getDepartmentName } from '@/lib/fr-departments'
import { ArrowLeft, ArrowRight, ChevronRight, Inbox } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { DiagResultCard } from './diag-result-card'
import { FilterBar } from './filter-bar'
import { SearchBar } from './search-bar'

const PAGE_SIZE = 24
const EARTH_RADIUS_KM = 6371

interface PageProps {
  searchParams: Promise<{
    q?: string
    dept?: string
    city?: string
    cert?: string | string[]
    page?: string
    lat?: string
    lng?: string
    dist?: string
  }>
}

interface DiagRow {
  id: string
  slug: string | null
  full_name: string | null
  city: string | null
  city_slug: string | null
  department_code: string | null
  certifications: string[] | null
  gmb_rating: number | null
  gmb_review_count: number | null
  claim_status: string | null
  photo_url: string | null
  latitude: number | null
  longitude: number | null
  created_at: string | null
}

/**
 * Annuaire racine `/diagnostiqueurs` — Server Component.
 *
 * Architecture :
 * - Searchable via `?q=` (texte sur nom/ville), `?dept=` (code département),
 *   `?cert=` (multi, codes diagnostic), `?lat/lng/dist=` (géoloc + rayon Haversine).
 * - Pagination 24/page via `?page=`.
 * - Order : claimed first → gmb_rating desc nulls last → created_at desc.
 *
 * La table `diagnosticians` est créée par l'agent A1 (parallèle). Les types Database
 * ne sont pas encore régénérés → cast `as any` pragmatique sur le client Supabase.
 */
export default async function DiagnostiqueursPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const dept = (sp.dept ?? '').trim() || undefined
  const certs = parseCertCodes(sp.cert)
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)
  const lat = parseFloatSafe(sp.lat)
  const lng = parseFloatSafe(sp.lng)
  const dist = parseFloatSafe(sp.dist)
  const hasGeo = lat !== undefined && lng !== undefined

  const { rows, count, error } = await fetchDiagnosticians({
    q,
    dept,
    certs,
    page,
    lat,
    lng,
    dist: hasGeo ? dist : undefined,
  })

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const hasResults = rows.length > 0

  // Params à préserver dans les liens enfants
  const preservedParams: Record<string, string | string[] | undefined> = {
    q: q || undefined,
    dept,
    cert: certs.length > 0 ? certs : undefined,
    lat: hasGeo ? sp.lat : undefined,
    lng: hasGeo ? sp.lng : undefined,
    dist: hasGeo && dist !== undefined ? String(dist) : undefined,
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PublicHeader />
      <main className="flex-1">
        {/* Hero header */}
        <section className="px-6 py-12 sm:py-16 border-b border-rule/60">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="space-y-3 max-w-3xl">
              <Badge variant="outline">Annuaire public</Badge>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-ink">
                Annuaire des diagnostiqueurs immobiliers
              </h1>
              <p className="text-base sm:text-lg text-ink-mute max-w-2xl">
                13 000+ professionnels certifiés DPE, Amiante, Plomb, Gaz, Électricité,
                Termites partout en France.
              </p>
            </div>

            {/* Search bar (client) */}
            <div className="max-w-4xl">
              <SearchBar initialQuery={q} preservedParams={preservedParams} />
            </div>

            {/* Filter bar (client) */}
            <div className="pt-2">
              <FilterBar
                dept={dept}
                certs={certs}
                distance={dist}
                hasGeo={hasGeo}
                preservedParams={preservedParams}
              />
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="px-6 py-10">
          <div className="mx-auto max-w-6xl space-y-6">
            {/* Header résultats */}
            <div className="flex items-end justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-ink">
                  {error
                    ? 'Résultats indisponibles'
                    : count === 0
                      ? 'Aucun professionnel trouvé'
                      : `${count.toLocaleString('fr-FR')} ${count > 1 ? 'professionnels' : 'professionnel'}`}
                </h2>
                <p className="text-[12px] text-ink-mute">
                  {dept ? (
                    <>Département {dept} · {getDepartmentName(dept) ?? ''} </>
                  ) : null}
                  {certs.length > 0 ? (
                    <>{certs.length > 0 ? `· ${certs.length} certification(s) sélectionnée(s)` : null}</>
                  ) : null}
                  {hasGeo && dist !== undefined ? <> · dans un rayon de {dist} km</> : null}
                </p>
              </div>
              {hasResults && (
                <p className="text-[11px] text-ink-faint shrink-0 hidden sm:block">
                  Page {page} sur {totalPages}
                </p>
              )}
            </div>

            {/* Grid résultats */}
            {error ? (
              <ErrorState />
            ) : hasResults ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rows.map((row) => {
                    const distanceKm =
                      hasGeo &&
                      row.latitude !== null &&
                      row.longitude !== null &&
                      lat !== undefined &&
                      lng !== undefined
                        ? haversineKm(lat, lng, row.latitude, row.longitude)
                        : null

                    return (
                      <DiagResultCard
                        key={row.id}
                        slug={row.slug ?? row.id}
                        deptCode={row.department_code ?? '00'}
                        citySlug={row.city_slug ?? 'inconnu'}
                        fullName={row.full_name ?? 'Diagnostiqueur'}
                        city={row.city}
                        certifications={row.certifications ?? []}
                        gmbRating={row.gmb_rating}
                        gmbReviewCount={row.gmb_review_count}
                        claimStatus={row.claim_status}
                        distanceKm={distanceKm}
                        photoUrl={row.photo_url}
                      />
                    )
                  })}
                </div>

                {/* Pagination */}
                <Pagination page={page} totalPages={totalPages} preservedParams={preservedParams} />
              </>
            ) : (
              <EmptyState />
            )}
          </div>
        </section>
      </main>
      <SiteFooter />

      {/* SEO — Schema.org ItemList */}
      <ItemListJsonLd rows={rows} />
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Server-side data layer                                                   */
/* ──────────────────────────────────────────────────────────────────────── */

interface FetchArgs {
  q: string
  dept?: string
  certs: DiagCertCode[]
  page: number
  lat?: number
  lng?: number
  dist?: number
}

interface FetchResult {
  rows: DiagRow[]
  count: number
  error: string | null
}

/**
 * Row renvoyée par la RPC `search_diagnosticians` (cf. migration 20260524110000).
 * On garde le mapping souple : la RPC renvoie `department_code` mais on alias
 * vers le champ `DiagRow.department_code` directement.
 */
interface RpcDiagRow {
  id: string
  slug: string | null
  full_name: string | null
  city: string | null
  city_slug: string | null
  department_code: string | null
  postcode: string | null
  certifications: unknown
  certif_valid_count: number | null
  gmb_rating: number | null
  gmb_review_count: number | null
  claim_status: string | null
  photo_url: string | null
  latitude: number | null
  longitude: number | null
  distance_km: number | null
  created_at: string | null
}

/**
 * Extrait les codes de type de certif (DPE, AMIANTE, ...) depuis le JSONB.
 * La page liste les certifs en tant que string[], pas en objets complets.
 */
function extractCertCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const codes = new Set<string>()
  for (const item of raw) {
    if (item && typeof item === 'object') {
      const t = (item as { type?: unknown }).type
      if (typeof t === 'string') codes.add(t)
    } else if (typeof item === 'string') {
      codes.add(item)
    }
  }
  return Array.from(codes)
}

async function fetchDiagnosticians(args: FetchArgs): Promise<FetchResult> {
  try {
    const supabase = await createClient()
    // Types Database pas encore régénérés post-migration 20260524110000.
    // biome-ignore lint/suspicious/noExplicitAny: types Database à régénérer post-FIX-D
    const client = supabase as any

    const offset = (args.page - 1) * PAGE_SIZE
    const useGeoSort = args.lat !== undefined && args.lng !== undefined
    const radiusKm = useGeoSort ? (args.dist ?? 50) : 50

    // Appel RPC unifiée. On surdimensionne le LIMIT (5×page) pour permettre
    // le count exact côté serveur en post-filtrage (cf. count séparé ci-dessous).
    const { data, error } = await client.rpc('search_diagnosticians', {
      p_query: args.q || null,
      p_city_slug: null,
      p_dept_code: args.dept ?? null,
      p_certs: args.certs.length > 0 ? args.certs : null,
      p_lat: args.lat ?? null,
      p_lng: args.lng ?? null,
      p_radius_km: radiusKm,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    })

    if (error) {
      // RPC inexistante = migration pas encore appliquée → fallback gracieux.
      const msg = error.message || ''
      const isMissing =
        msg.includes('does not exist') ||
        msg.includes('not found') ||
        msg.includes('function') ||
        error.code === 'PGRST202' ||
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        error.code === '42883'
      if (isMissing) {
        return fallbackTableQuery(client, args, offset)
      }
      return { rows: [], count: 0, error: msg }
    }

    const rpcRows = (data ?? []) as RpcDiagRow[]

    // Count total (mêmes filtres, sans pagination) — appel RPC count séparé.
    // Pour éviter une 2e RPC, on prend le LIMIT comme borne haute + 1 pour
    // détecter la dernière page. Implémentation simple : si rpcRows.length
    // === PAGE_SIZE on suppose qu'il y en a au moins une page de plus.
    const approxCount = rpcRows.length === PAGE_SIZE ? offset + PAGE_SIZE + 1 : offset + rpcRows.length

    const rows: DiagRow[] = rpcRows.map((r) => ({
      id: r.id,
      slug: r.slug,
      full_name: r.full_name,
      city: r.city,
      city_slug: r.city_slug,
      department_code: r.department_code,
      certifications: extractCertCodes(r.certifications),
      gmb_rating: r.gmb_rating,
      gmb_review_count: r.gmb_review_count,
      claim_status: r.claim_status,
      photo_url: r.photo_url,
      latitude: r.latitude,
      longitude: r.longitude,
      created_at: r.created_at,
    }))

    return { rows, count: approxCount, error: null }
  } catch (e) {
    return {
      rows: [],
      count: 0,
      error: e instanceof Error ? e.message : 'Erreur inconnue',
    }
  }
}

/**
 * Fallback : si la RPC `search_diagnosticians` n'est pas encore créée
 * (cas migration pas appliquée), on tente une requête table directe en
 * mode best-effort. Filtre minimal : dept + ILIKE nom/ville.
 */
async function fallbackTableQuery(
  // biome-ignore lint/suspicious/noExplicitAny: supabase client cast pré-typegen
  client: any,
  args: FetchArgs,
  offset: number,
): Promise<FetchResult> {
  try {
    let query = client
      .from('diagnosticians')
      .select(
        'id, slug, full_name, city, city_slug, department_code, dept_code, certifications, gmb_rating, gmb_review_count, claim_status, photo_url, latitude, longitude, geo_lat, geo_lng, created_at',
        { count: 'exact' },
      )

    if (args.dept) {
      query = query.or(`department_code.eq.${args.dept},dept_code.eq.${args.dept}`)
    }
    if (args.q) {
      const safe = args.q.replace(/[%_,]/g, '\\$&')
      query = query.or(`full_name.ilike.%${safe}%,city.ilike.%${safe}%`)
    }

    query = query
      .order('claim_status', { ascending: false })
      .order('gmb_rating', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    const { data, count, error } = await query
    if (error) {
      const msg = error.message || ''
      if (
        msg.includes('does not exist') ||
        msg.includes('relation') ||
        error.code === 'PGRST205' ||
        error.code === '42P01'
      ) {
        return { rows: [], count: 0, error: null }
      }
      return { rows: [], count: 0, error: msg }
    }

    const rows: DiagRow[] = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      slug: (r.slug as string | null) ?? null,
      full_name: (r.full_name as string | null) ?? null,
      city: (r.city as string | null) ?? null,
      city_slug: (r.city_slug as string | null) ?? null,
      department_code:
        (r.department_code as string | null) ?? (r.dept_code as string | null) ?? null,
      certifications: extractCertCodes(r.certifications),
      gmb_rating: (r.gmb_rating as number | null) ?? null,
      gmb_review_count: (r.gmb_review_count as number | null) ?? null,
      claim_status: (r.claim_status as string | null) ?? null,
      photo_url: (r.photo_url as string | null) ?? null,
      latitude: (r.latitude as number | null) ?? (r.geo_lat as number | null) ?? null,
      longitude: (r.longitude as number | null) ?? (r.geo_lng as number | null) ?? null,
      created_at: (r.created_at as string | null) ?? null,
    }))

    return { rows, count: count ?? 0, error: null }
  } catch (e) {
    return {
      rows: [],
      count: 0,
      error: e instanceof Error ? e.message : 'Erreur inconnue',
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Sub-composants                                                            */
/* ──────────────────────────────────────────────────────────────────────── */

function Pagination({
  page,
  totalPages,
  preservedParams,
}: {
  page: number
  totalPages: number
  preservedParams: Record<string, string | string[] | undefined>
}) {
  if (totalPages <= 1) return null

  function hrefFor(p: number) {
    const params = new URLSearchParams()
    for (const [key, val] of Object.entries(preservedParams)) {
      if (val === undefined) continue
      if (Array.isArray(val)) val.forEach((v) => params.append(key, v))
      else params.set(key, val)
    }
    if (p > 1) params.set('page', String(p))
    const s = params.toString()
    return s ? `/diagnostiqueurs?${s}` : '/diagnostiqueurs'
  }

  return (
    <nav
      className="flex items-center justify-between pt-4 border-t border-rule/60"
      aria-label="Pagination des résultats"
    >
      <div>
        {page > 1 ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={hrefFor(page - 1)}>
              <ArrowLeft className="size-3.5" />
              Précédent
            </Link>
          </Button>
        ) : (
          <span />
        )}
      </div>
      <p className="text-[12px] text-ink-mute">
        Page <span className="font-semibold text-ink">{page}</span> sur {totalPages}
      </p>
      <div>
        {page < totalPages ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={hrefFor(page + 1)}>
              Suivant
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        ) : (
          <span />
        )}
      </div>
    </nav>
  )
}

function EmptyState() {
  return (
    <Card variant="opaque" padding="lg" className="text-center space-y-4">
      <div className="mx-auto size-12 rounded-full bg-cream-deep flex items-center justify-center">
        <Inbox className="size-5 text-ink-mute" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-bold text-ink">Aucun professionnel ne correspond</h3>
        <p className="text-[13px] text-ink-mute max-w-md mx-auto">
          Essayez d'élargir votre recherche : retirez un filtre, élargissez la distance
          ou parcourez les départements voisins.
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 pt-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/diagnostiqueurs">Réinitialiser</Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/reclamer-ma-fiche">
            Réclamer ma fiche
            <ChevronRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </Card>
  )
}

function ErrorState() {
  return (
    <Card variant="opaque" padding="lg" className="text-center space-y-3">
      <h3 className="text-base font-bold text-ink">Résultats indisponibles</h3>
      <p className="text-[13px] text-ink-mute">
        Un incident technique nous empêche d'afficher l'annuaire en ce moment. Réessayez
        dans quelques instants.
      </p>
    </Card>
  )
}


function ItemListJsonLd({ rows }: { rows: DiagRow[] }) {
  if (rows.length === 0) return null
  const itemListElement = rows.map((row, idx) => ({
    '@type': 'ListItem',
    position: idx + 1,
    item: {
      '@type': 'LocalBusiness',
      name: row.full_name ?? 'Diagnostiqueur',
      address: row.city
        ? {
            '@type': 'PostalAddress',
            addressLocality: row.city,
            addressRegion: row.department_code,
            addressCountry: 'FR',
          }
        : undefined,
      ...(row.gmb_rating !== null && row.gmb_review_count !== null
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: row.gmb_rating,
              reviewCount: row.gmb_review_count,
            },
          }
        : {}),
      url: `https://kovas.fr/diagnostiqueurs/${row.department_code ?? '00'}/${row.city_slug ?? 'inconnu'}/${row.slug ?? row.id}`,
    },
  }))

  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement,
  }

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Utils                                                                     */
/* ──────────────────────────────────────────────────────────────────────── */

function parseFloatSafe(v: string | undefined): number | undefined {
  if (v === undefined) return undefined
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : undefined
}

/** Distance Haversine en km entre deux points (lat/lng en degrés). */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Metadata SEO                                                              */
/* ──────────────────────────────────────────────────────────────────────── */

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams
  const dept = (sp.dept ?? '').trim() || undefined
  const certs = parseCertCodes(sp.cert)

  if (dept) {
    const deptName = getDepartmentName(dept) ?? dept
    return {
      title: `Diagnostiqueurs immobiliers ${deptName} (${dept}) | KOVAS`,
      description: `Trouvez un diagnostiqueur immobilier certifié dans le département ${deptName} (${dept}) : DPE, Amiante, Plomb, Gaz, Électricité, Termites, Carrez, ERP.`,
      alternates: {
        canonical: `https://kovas.fr/diagnostiqueurs?dept=${dept}`,
      },
    }
  }

  if (certs.length === 1) {
    return {
      title: `Diagnostiqueurs ${certs[0]} en France | KOVAS`,
      description: `Annuaire des diagnostiqueurs immobiliers certifiés ${certs[0]} en France.`,
      alternates: { canonical: 'https://kovas.fr/diagnostiqueurs' },
    }
  }

  return {
    title: 'Annuaire des diagnostiqueurs immobiliers en France | KOVAS',
    description:
      "13 000+ diagnostiqueurs immobiliers certifiés partout en France. Cherchez par ville, département ou certification : DPE, Amiante, Plomb, Gaz, Électricité, Termites, Carrez, ERP.",
    alternates: { canonical: 'https://kovas.fr/diagnostiqueurs' },
    openGraph: {
      title: 'Annuaire des diagnostiqueurs immobiliers en France',
      description:
        '13 000+ professionnels certifiés DPE, Amiante, Plomb, Gaz, Électricité, Termites.',
      url: 'https://kovas.fr/diagnostiqueurs',
      type: 'website',
    },
  }
}

export const revalidate = 300 // ISR 5 min
