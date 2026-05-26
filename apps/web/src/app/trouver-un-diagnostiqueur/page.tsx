import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { type DiagCertCode, parseCertCodes } from '@/lib/diag-certifications'
import { getDepartmentName } from '@/lib/fr-departments'
import { ArrowLeft, ArrowRight, ChevronRight, Inbox, Info } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { DiagResultCard } from './diag-result-card'
import { FilterBar } from './filter-bar'
import { SearchBar } from './search-bar'

const PAGE_SIZE = 24
const EARTH_RADIUS_KM = 6371

/**
 * Paliers d'élargissement progressif (km) appliqués SI une géoloc est
 * disponible et que le rayon initial retourne 0 résultats. Après le dernier
 * palier `national`, on bascule en query "tout le pays" (sans rayon).
 *
 * Règle métier B2C : l'utilisateur DOIT toujours voir au moins 1 contact —
 * un particulier qui cherche un diagnostiqueur pour son DPE ne doit jamais
 * tomber sur une page vide, quitte à élargir au département voire au pays.
 */
const RADIUS_LADDER_KM = [20, 50, 100] as const
type WidenedScope = 'initial' | 'expanded-radius' | 'department' | 'national' | 'all'

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
  /** FIX-RR — Raison sociale (DHUP "Societe"). NULL pour les EI/EURL nom propre. */
  company_name: string | null
  city: string | null
  city_slug: string | null
  department_code: string | null
  /** Codes canoniques uppercase (DPE, DPE_MENTION, AMIANTE, ...). */
  certifications: string[] | null
  /** FIX-RR — True si certif DPE_MENTION (audit energetique avec mention). */
  has_mention_audit: boolean
  gmb_rating: number | null
  gmb_review_count: number | null
  claim_status: string | null
  photo_url: string | null
  latitude: number | null
  longitude: number | null
  created_at: string | null
}

/**
 * Annuaire racine `/trouver-un-diagnostiqueur` — Server Component.
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

  const { rows, count, error, widened, effectiveRadiusKm } = await fetchDiagnosticians({
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
                13 000+ professionnels certifiés DPE, Amiante, Plomb, Gaz, Électricité, Termites
                partout en France.
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
                    <>
                      Département {dept} · {getDepartmentName(dept) ?? ''}{' '}
                    </>
                  ) : null}
                  {certs.length > 0 ? (
                    <>
                      {certs.length > 0
                        ? `· ${certs.length} certification(s) sélectionnée(s)`
                        : null}
                    </>
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

            {/* Banner d'élargissement progressif (B2C : toujours ≥ 1 résultat).
             * S'affiche quand l'algo a dû élargir au-delà du rayon initial. */}
            {hasResults && widened !== 'initial' ? (
              <WideningNotice
                widened={widened}
                effectiveRadiusKm={effectiveRadiusKm}
                deptCode={dept}
              />
            ) : null}

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
                        companyName={row.company_name}
                        city={row.city}
                        certifications={row.certifications ?? []}
                        hasMentionAudit={row.has_mention_audit}
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
  /**
   * Indique si l'algorithme d'élargissement progressif a dû élargir le
   * périmètre pour garantir au moins 1 résultat. `initial` = rayon demandé
   * suffisant ; les autres valeurs signalent un widening progressif que la
   * page rend visible via un banner d'information sobre.
   */
  widened: WidenedScope
  /** Rayon effectivement utilisé (km). Null pour scope dept/national/all. */
  effectiveRadiusKm: number | null
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
  /** FIX-RR — Raison sociale. La RPC SQL existante peut ne pas la retourner. */
  company_name?: string | null
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
    // Page publique : admin client (bypass RLS) pour éviter l'asymétrie
    // anon / authenticated (RLS policies différentes selon auth.uid()).
    // La table reste publique par design (annuaire SEO), pas de fuite — on
    // filtre is_published côté query.
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()
    // Types Database pas encore régénérés post-migration 20260524110000.
    // biome-ignore lint/suspicious/noExplicitAny: types Database à régénérer post-FIX-D
    const client = supabase as any

    const offset = (args.page - 1) * PAGE_SIZE
    const useGeoSort = args.lat !== undefined && args.lng !== undefined

    /**
     * Exécute une tentative de recherche unique. Retourne soit la liste des
     * rows, soit `null` si la RPC est absente (déclenche fallback table).
     *
     * `dropQuery` : utilisé par les paliers d'élargissement département /
     * national pour ignorer le filtre texte ILIKE. Quand l'utilisateur a
     * sélectionné une adresse BAN ("12 Rue X, 75008 Paris, Île-de-France"),
     * le `q` arrivant en URL peut contenir des fragments qui ne matchent
     * AUCUN champ full_name/city/address/postcode → le widening était cassé
     * silencieusement (la requête nationale renvoyait toujours 0). Les
     * paliers d'élargissement priorisent maintenant la garantie B2C ≥1
     * résultat sur le matching textuel exact.
     */
    async function runRpc(params: {
      lat?: number
      lng?: number
      radiusKm?: number
      dept?: string
      limit?: number
      offset?: number
      dropQuery?: boolean
    }): Promise<{ rows: RpcDiagRow[]; missing: boolean; errMsg: string | null }> {
      const queryArg = params.dropQuery ? null : args.q || null
      const { data: rpcData, error: rpcError } = await client.rpc('search_diagnosticians', {
        p_query: queryArg,
        p_city_slug: null,
        p_dept_code: params.dept ?? null,
        p_certs: args.certs.length > 0 ? args.certs : null,
        p_lat: params.lat ?? null,
        p_lng: params.lng ?? null,
        p_radius_km: params.radiusKm ?? null,
        p_limit: params.limit ?? PAGE_SIZE,
        p_offset: params.offset ?? 0,
      })
      if (rpcError) {
        const msg = rpcError.message || ''
        const isMissing =
          msg.includes('does not exist') ||
          msg.includes('not found') ||
          msg.includes('function') ||
          rpcError.code === 'PGRST202' ||
          rpcError.code === 'PGRST205' ||
          rpcError.code === '42P01' ||
          rpcError.code === '42883'
        return { rows: [], missing: isMissing, errMsg: msg }
      }
      return { rows: (rpcData ?? []) as RpcDiagRow[], missing: false, errMsg: null }
    }

    // ────────────────────────────────────────────────────────────────────
    // Pipeline d'élargissement progressif (B2C garantie ≥ 1 résultat)
    //
    // 1. Si géoloc dispo (sélection BAN) : essais à 20, 50, 100 km
    // 2. Si toujours vide ET dept connu : query "tout le département"
    // 3. Si toujours vide : query "tout le pays" (LIMIT PAGE_SIZE)
    //
    // L'utilisateur doit TOUJOURS voir au moins 1 contact, quitte à voir
    // un diag à 200 km — un B2C qui cherche un diagnostiqueur DPE ne doit
    // jamais tomber sur une page vide.
    // ────────────────────────────────────────────────────────────────────

    let rpcRows: RpcDiagRow[] = []
    let widened: WidenedScope = 'initial'
    let effectiveRadiusKm: number | null = null

    if (useGeoSort) {
      // Si l'utilisateur a explicitement choisi une distance via filter-bar,
      // on commence par celle-ci puis on élargit progressivement. Sinon on
      // démarre à 20 km (palier le plus serré du ladder).
      const userRadius = args.dist
      const ladder =
        userRadius !== undefined
          ? [userRadius, ...RADIUS_LADDER_KM.filter((r) => r > userRadius)]
          : [...RADIUS_LADDER_KM]

      for (const r of ladder) {
        const attempt = await runRpc({
          lat: args.lat,
          lng: args.lng,
          radiusKm: r,
          dept: args.dept,
          limit: PAGE_SIZE,
          offset,
        })
        if (attempt.missing) return fallbackTableQuery(client, args, offset)
        if (attempt.errMsg) return mkErr(attempt.errMsg)
        if (attempt.rows.length > 0) {
          rpcRows = attempt.rows
          effectiveRadiusKm = r
          // Élargi si r > rayon initial demandé (par défaut 20 km au minimum).
          const baseline = userRadius ?? RADIUS_LADDER_KM[0]
          widened = r > baseline ? 'expanded-radius' : 'initial'
          break
        }
      }
    } else {
      // Pas de géoloc → query classique sans rayon. Le RPC ignore p_lat/p_lng
      // si NULL et applique seulement les filtres texte/dept/certs.
      const attempt = await runRpc({
        dept: args.dept,
        limit: PAGE_SIZE,
        offset,
      })
      if (attempt.missing) return fallbackTableQuery(client, args, offset)
      if (attempt.errMsg) return mkErr(attempt.errMsg)
      rpcRows = attempt.rows
      effectiveRadiusKm = null
    }

    // Étape 2 — élargissement au département (si géoloc épuisée + dept connu)
    // À ce palier on drop le filtre texte : la sélection d'une adresse BAN
    // pousse en `q` un label qui ne matche AUCUN diag par texte (ex. "12 Rue
    // de la Paix, 76540 Ouville-La-Rivière"), le widening était stérile.
    if (rpcRows.length === 0 && args.dept) {
      const attempt = await runRpc({
        dept: args.dept,
        limit: PAGE_SIZE,
        offset,
        dropQuery: true,
      })
      if (attempt.missing) return fallbackTableQuery(client, args, offset)
      if (attempt.errMsg) return mkErr(attempt.errMsg)
      if (attempt.rows.length > 0) {
        rpcRows = attempt.rows
        widened = 'department'
        effectiveRadiusKm = null
      }
    }

    // Étape 3 — élargissement national (dernier filet B2C ≥1 résultat).
    // On drop ici aussi le filtre texte ET les certifs si rien remonte, pour
    // garantir qu'un particulier ait au moins 1 contact à afficher.
    if (rpcRows.length === 0) {
      // Premier essai national : garde les certifs (respect intent) mais drop q
      const attempt = await runRpc({
        limit: PAGE_SIZE,
        offset: 0,
        dropQuery: true,
      })
      if (attempt.missing) return fallbackTableQuery(client, args, offset)
      if (attempt.errMsg) return mkErr(attempt.errMsg)
      rpcRows = attempt.rows
      widened = rpcRows.length > 0 ? 'national' : 'all'
      effectiveRadiusKm = null
    }

    // Count total approximatif (cf. logique avant : la RPC ne renvoie pas
    // de count exact, on borne via PAGE_SIZE)
    const approxCount =
      rpcRows.length === PAGE_SIZE ? offset + PAGE_SIZE + 1 : offset + rpcRows.length

    const rows: DiagRow[] = rpcRows.map((r) => {
      const certCodes = extractCertCodes(r.certifications)
      return {
        id: r.id,
        slug: r.slug,
        full_name: r.full_name,
        // FIX-RR — RPC `search_diagnosticians` peut ne pas exposer company_name
        // (signature SQL pre-migration 20260524410000). Safe-read avec fallback null.
        company_name: r.company_name ?? null,
        city: r.city,
        city_slug: r.city_slug,
        department_code: r.department_code,
        certifications: certCodes,
        has_mention_audit: certCodes.includes('DPE_MENTION'),
        gmb_rating: r.gmb_rating,
        gmb_review_count: r.gmb_review_count,
        claim_status: r.claim_status,
        photo_url: r.photo_url,
        latitude: r.latitude,
        longitude: r.longitude,
        created_at: r.created_at,
      }
    })

    return {
      rows,
      count: approxCount,
      error: null,
      widened,
      effectiveRadiusKm,
    }
  } catch (e) {
    return mkErr(e instanceof Error ? e.message : 'Erreur inconnue')
  }
}

function mkErr(message: string): FetchResult {
  return { rows: [], count: 0, error: message, widened: 'initial', effectiveRadiusKm: null }
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
        'id, slug, full_name, company_name, city, city_slug, department_code, dept_code, certifications, gmb_rating, gmb_review_count, claim_status, photo_url, latitude, longitude, geo_lat, geo_lng, created_at',
        { count: 'exact' },
      )

    if (args.dept) {
      query = query.or(`department_code.eq.${args.dept},dept_code.eq.${args.dept}`)
    }
    if (args.q) {
      const safe = args.q.replace(/[%_,]/g, '\\$&')
      // FIX-RR — recherche etendue a company_name (raison sociale).
      // Le particulier connait souvent le cabinet ("Cabinet Diag Pro 75")
      // plus que le gerant ("Raoul Chipot").
      query = query.or(
        `full_name.ilike.%${safe}%,company_name.ilike.%${safe}%,city.ilike.%${safe}%`,
      )
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
        return { rows: [], count: 0, error: null, widened: 'all', effectiveRadiusKm: null }
      }
      return { rows: [], count: 0, error: msg, widened: 'initial', effectiveRadiusKm: null }
    }

    const rows: DiagRow[] = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => {
      const certCodes = extractCertCodes(r.certifications)
      return {
        id: String(r.id),
        slug: (r.slug as string | null) ?? null,
        full_name: (r.full_name as string | null) ?? null,
        company_name: (r.company_name as string | null) ?? null,
        city: (r.city as string | null) ?? null,
        city_slug: (r.city_slug as string | null) ?? null,
        department_code:
          (r.department_code as string | null) ?? (r.dept_code as string | null) ?? null,
        certifications: certCodes,
        has_mention_audit: certCodes.includes('DPE_MENTION'),
        gmb_rating: (r.gmb_rating as number | null) ?? null,
        gmb_review_count: (r.gmb_review_count as number | null) ?? null,
        claim_status: (r.claim_status as string | null) ?? null,
        photo_url: (r.photo_url as string | null) ?? null,
        latitude: (r.latitude as number | null) ?? (r.geo_lat as number | null) ?? null,
        longitude: (r.longitude as number | null) ?? (r.geo_lng as number | null) ?? null,
        created_at: (r.created_at as string | null) ?? null,
      }
    })

    return {
      rows,
      count: count ?? 0,
      error: null,
      widened: 'initial',
      effectiveRadiusKm: null,
    }
  } catch (e) {
    return {
      rows: [],
      count: 0,
      error: e instanceof Error ? e.message : 'Erreur inconnue',
      widened: 'initial',
      effectiveRadiusKm: null,
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
      if (Array.isArray(val)) {
        for (const v of val) params.append(key, v)
      } else {
        params.set(key, val)
      }
    }
    if (p > 1) params.set('page', String(p))
    const s = params.toString()
    return s ? `/trouver-un-diagnostiqueur?${s}` : '/trouver-un-diagnostiqueur'
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
          Essayez d'élargir votre recherche : retirez un filtre, élargissez la distance ou parcourez
          les départements voisins.
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 pt-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/trouver-un-diagnostiqueur">Réinitialiser</Link>
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
        Un incident technique nous empêche d'afficher l'annuaire en ce moment. Réessayez dans
        quelques instants.
      </p>
    </Card>
  )
}

/**
 * Banner sobre informant l'utilisateur que le périmètre a été élargi pour
 * lui garantir au moins un résultat (règle métier B2C). Design System v5 :
 * couleur warm-soft (ambre pâle), pas d'emoji, vouvoiement.
 */
function WideningNotice({
  widened,
  effectiveRadiusKm,
  deptCode,
}: {
  widened: WidenedScope
  effectiveRadiusKm: number | null
  deptCode: string | undefined
}) {
  if (widened === 'initial') return null
  const initialRadius = RADIUS_LADDER_KM[0]
  const deptLabel = deptCode
    ? `${getDepartmentName(deptCode) ?? `département ${deptCode}`}`
    : 'département'

  const message =
    widened === 'expanded-radius' && effectiveRadiusKm !== null
      ? `Aucun professionnel dans un rayon de ${initialRadius} km. Voici les plus proches (rayon élargi à ${effectiveRadiusKm} km).`
      : widened === 'department'
        ? `Aucun professionnel dans un rayon de ${initialRadius} km. Voici les diagnostiqueurs du ${deptLabel}.`
        : widened === 'national'
          ? `Aucun professionnel à proximité ni dans le ${deptLabel}. Voici les diagnostiqueurs disponibles ailleurs en France susceptibles d'intervenir.`
          : ''

  if (!message) return null

  return (
    <Card variant="opaque" padding="default" className="bg-accent-warm-soft border-accent-warm/30">
      <div className="flex items-start gap-2.5">
        <Info className="size-4 mt-0.5 text-ink-mute shrink-0" aria-hidden />
        <p className="text-[13px] text-ink-soft leading-relaxed">{message}</p>
      </div>
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
      // FIX-RR — JSON-LD prefere la raison sociale au nom du gerant
      // (cf. Google guidelines LocalBusiness : `name` = nom commercial public).
      name: row.company_name?.trim() || row.full_name || 'Diagnostiqueur',
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
      url: `https://kovas.fr/trouver-un-diagnostiqueur/${row.department_code ?? '00'}/${row.city_slug ?? 'inconnu'}/${row.slug ?? row.id}`,
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
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD Schema.org SEO — pas de XSS car JSON.stringify échappe correctement
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
        canonical: `https://kovas.fr/trouver-un-diagnostiqueur?dept=${dept}`,
      },
    }
  }

  if (certs.length === 1) {
    return {
      title: `Diagnostiqueurs ${certs[0]} en France | KOVAS`,
      description: `Annuaire des diagnostiqueurs immobiliers certifiés ${certs[0]} en France.`,
      alternates: { canonical: 'https://kovas.fr/trouver-un-diagnostiqueur' },
    }
  }

  return {
    title: 'Annuaire des diagnostiqueurs immobiliers en France | KOVAS',
    description:
      '13 000+ diagnostiqueurs immobiliers certifiés partout en France. Cherchez par ville, département ou certification : DPE, Amiante, Plomb, Gaz, Électricité, Termites, Carrez, ERP.',
    alternates: { canonical: 'https://kovas.fr/trouver-un-diagnostiqueur' },
    openGraph: {
      title: 'Annuaire des diagnostiqueurs immobiliers en France',
      description:
        '13 000+ professionnels certifiés DPE, Amiante, Plomb, Gaz, Électricité, Termites.',
      url: 'https://kovas.fr/trouver-un-diagnostiqueur',
      type: 'website',
    },
  }
}

export const revalidate = 300 // ISR 5 min
