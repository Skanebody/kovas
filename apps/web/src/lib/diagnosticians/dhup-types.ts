/**
 * Annuaire diagnostiqueurs publics — types & helpers
 *
 * Source : table `diagnosticians` (cf. supabase/migrations/20260530100000_annuaire_diagnosticians.sql)
 * Importeur : Edge Function `import-dhup-annuaire` (cron mensuel, dataset DHUP data.gouv.fr).
 *
 * Mission A1 : fondation annuaire ~13 000 diagnostiqueurs FR certifies.
 * Les autres routes `/trouver-un-diagnostiqueur/*` (liste, fiche, claim, etc.) sont
 * livrees par d'autres agents — ce module fournit uniquement les contrats
 * de types et les helpers de lecture publique.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// 1. Types métiers (alignés sur la migration SQL)
// ============================================

/** 8 diagnostics couverts (cf. CLAUDE.md §3 "focus 8 diagnostics standards"). */
export type DiagnosticType =
  | 'DPE'
  | 'AMIANTE'
  | 'PLOMB'
  | 'GAZ'
  | 'ELECTRICITE'
  | 'TERMITES'
  | 'CARREZ'
  | 'ERP'

export type CertificationStatus = 'valid' | 'expired' | 'suspended'

export interface DiagnosticianCertification {
  type: DiagnosticType
  organism: string | null
  number: string | null
  /** ISO YYYY-MM-DD */
  valid_until: string | null
  status: CertificationStatus
}

export type ClaimStatus = 'unclaimed' | 'pending' | 'claimed' | 'rejected'

/** Indicatif tarifs en centimes (cohérent avec CLAUDE.md §10 — monnaie integer). */
export interface PricingIndicative {
  dpe?: { min_cents: number; max_cents: number }
  amiante?: { min_cents: number; max_cents: number }
  plomb?: { min_cents: number; max_cents: number }
  gaz?: { min_cents: number; max_cents: number }
  electricite?: { min_cents: number; max_cents: number }
  termites?: { min_cents: number; max_cents: number }
  carrez?: { min_cents: number; max_cents: number }
  erp?: { min_cents: number; max_cents: number }
}

/** Row complet en lecture (correspond exactement aux colonnes RLS-public-readable). */
export interface DiagnosticianRow {
  id: string
  // Identité
  first_name: string
  last_name: string
  full_name_normalized: string
  // Localisation
  city: string
  postal_code: string | null
  department_code: string
  region_code: string | null
  geo_lat: number | null
  geo_lng: number | null
  // Certifications
  certifications: DiagnosticianCertification[]
  // Contact officiel
  official_email: string | null
  official_phone: string | null
  official_company_name: string | null
  // Sirene
  sirene_siret: string | null
  sirene_naf_code: string | null
  // SEO
  slug: string
  slug_city: string
  slug_dept: string
  public_page_url: string
  // Statut
  is_indexable: boolean
  is_published: boolean
  withdrawal_requested: boolean
  withdrawal_requested_at: string | null
  // Claim
  claimed_by_user_id: string | null
  claimed_at: string | null
  claim_status: ClaimStatus
  // Enrichissements
  photo_url: string | null
  bio: string | null
  pricing_indicative: PricingIndicative | null
  services_offered: string[] | null
  intervention_radius_km: number | null
  availability_lead_time_days: number | null
  // GMB
  gmb_place_id: string | null
  gmb_review_count: number | null
  gmb_rating: number | null
  // Source
  dhup_source_id: string | null
  dhup_imported_at: string
  dhup_last_synced_at: string | null
  // Stats
  view_count: number
  quote_request_count: number
  // Audit
  created_at: string
  updated_at: string
}

// ============================================
// 2. DTO pour pages publiques (subset safe à exposer côté SEO)
// ============================================

export interface DiagnosticianListItem {
  id: string
  first_name: string
  last_name: string
  city: string
  postal_code: string | null
  department_code: string
  certifications: DiagnosticianCertification[]
  slug: string
  slug_city: string
  slug_dept: string
  public_page_url: string
  official_company_name: string | null
  photo_url: string | null
  intervention_radius_km: number | null
  gmb_rating: number | null
  gmb_review_count: number | null
  geo_lat: number | null
  geo_lng: number | null
}

export interface DiagnosticianDetail extends DiagnosticianListItem {
  bio: string | null
  pricing_indicative: PricingIndicative | null
  services_offered: string[] | null
  availability_lead_time_days: number | null
  official_email: string | null
  official_phone: string | null
  is_indexable: boolean
  claim_status: ClaimStatus
}

// ============================================
// 3. Mapping DTO
// ============================================

const LIST_FIELDS =
  'id, first_name, last_name, city, postal_code, department_code, certifications, slug, slug_city, slug_dept, public_page_url, official_company_name, photo_url, intervention_radius_km, gmb_rating, gmb_review_count, geo_lat, geo_lng'

const DETAIL_FIELDS = `${LIST_FIELDS}, bio, pricing_indicative, services_offered, availability_lead_time_days, official_email, official_phone, is_indexable, claim_status`

function toListItem(row: Record<string, unknown>): DiagnosticianListItem {
  return {
    id: String(row.id),
    first_name: String(row.first_name ?? ''),
    last_name: String(row.last_name ?? ''),
    city: String(row.city ?? ''),
    postal_code: (row.postal_code as string | null) ?? null,
    department_code: String(row.department_code ?? ''),
    certifications: (row.certifications as DiagnosticianCertification[]) ?? [],
    slug: String(row.slug ?? ''),
    slug_city: String(row.slug_city ?? ''),
    slug_dept: String(row.slug_dept ?? ''),
    public_page_url: String(row.public_page_url ?? ''),
    official_company_name: (row.official_company_name as string | null) ?? null,
    photo_url: (row.photo_url as string | null) ?? null,
    intervention_radius_km: (row.intervention_radius_km as number | null) ?? null,
    gmb_rating: (row.gmb_rating as number | null) ?? null,
    gmb_review_count: (row.gmb_review_count as number | null) ?? null,
    geo_lat: (row.geo_lat as number | null) ?? null,
    geo_lng: (row.geo_lng as number | null) ?? null,
  }
}

function toDetail(row: Record<string, unknown>): DiagnosticianDetail {
  return {
    ...toListItem(row),
    bio: (row.bio as string | null) ?? null,
    pricing_indicative: (row.pricing_indicative as PricingIndicative | null) ?? null,
    services_offered: (row.services_offered as string[] | null) ?? null,
    availability_lead_time_days: (row.availability_lead_time_days as number | null) ?? null,
    official_email: (row.official_email as string | null) ?? null,
    official_phone: (row.official_phone as string | null) ?? null,
    is_indexable: Boolean(row.is_indexable),
    claim_status: (row.claim_status as ClaimStatus | null) ?? 'unclaimed',
  }
}

// ============================================
// 4. Helpers de lecture publique
// ============================================

/**
 * Charge une fiche complete par slug. Lecture publique (RLS filtre is_published + withdrawal).
 * Renvoie null si non trouvée ou retirée.
 */
export async function getDiagnosticianBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<DiagnosticianDetail | null> {
  const { data, error } = await supabase
    .from('diagnosticians')
    .select(DETAIL_FIELDS)
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) return null
  return toDetail(data as Record<string, unknown>)
}

/** Filtres recherche annuaire. Tous optionnels. */
export interface DiagnosticianSearchFilters {
  /** Code département FR ("76", "2A", "971") */
  department_code?: string
  /** Slug ville (ex "dieppe") */
  slug_city?: string
  /** Type de diagnostic — filtre certifications.type IN (...) */
  diagnostic_type?: DiagnosticType
  /** Recherche textuelle nom (trigram + ilike) */
  query?: string
  /** Géoloc proximité — KNN earthdistance */
  near?: { lat: number; lng: number; radius_km?: number }
  /** Pagination */
  limit?: number
  offset?: number
}

export interface DiagnosticianSearchResult {
  items: DiagnosticianListItem[]
  total: number
}

/**
 * Recherche paginée. Defaults limit=20, offset=0.
 * Note geoloc : sans extension PostGIS dedie cote client, on filtre cote SQL via RPC
 * dans une version V1.5. Ici on filtre dept+city+type+text. La proximite km strict
 * est laissee a une edge fn dediee (out of scope mission A1).
 */
export async function searchDiagnosticians(
  supabase: SupabaseClient,
  filters: DiagnosticianSearchFilters = {},
): Promise<DiagnosticianSearchResult> {
  const limit = Math.min(filters.limit ?? 20, 100)
  const offset = Math.max(filters.offset ?? 0, 0)

  let q = supabase.from('diagnosticians').select(LIST_FIELDS, { count: 'exact' })

  if (filters.department_code) {
    q = q.eq('department_code', filters.department_code)
  }
  if (filters.slug_city) {
    q = q.eq('slug_city', filters.slug_city)
  }
  if (filters.query && filters.query.trim().length >= 2) {
    // ilike sur colonne normalisée (insensible aux accents). RLS gere is_published.
    const safe = filters.query.trim().toLowerCase().replace(/[%_]/g, '')
    q = q.ilike('full_name_normalized', `%${safe}%`)
  }
  if (filters.diagnostic_type) {
    // JSONB contains : certifications @> '[{"type":"DPE"}]'
    q = q.contains('certifications', [{ type: filters.diagnostic_type }])
  }

  q = q.order('last_name', { ascending: true }).range(offset, offset + limit - 1)

  const { data, count, error } = await q
  if (error) {
    return { items: [], total: 0 }
  }

  const items = ((data ?? []) as Record<string, unknown>[]).map(toListItem)
  return { items, total: count ?? items.length }
}

/**
 * Liste les départements ayant au moins un diagnostiqueur publié.
 * Pour la page index `/trouver-un-diagnostiqueur`.
 */
export async function listDepartmentsWithCount(
  supabase: SupabaseClient,
): Promise<Array<{ department_code: string; slug_dept: string; count: number }>> {
  // Pas d'agrégation native cote SDK — on ramène (dept, slug_dept) et on agrège côté JS.
  const { data, error } = await supabase
    .from('diagnosticians')
    .select('department_code, slug_dept')
    .limit(20000)

  if (error || !data) return []

  const map = new Map<string, { department_code: string; slug_dept: string; count: number }>()
  for (const row of data as Array<{ department_code: string; slug_dept: string }>) {
    const key = row.department_code
    const existing = map.get(key)
    if (existing) {
      existing.count++
    } else {
      map.set(key, { department_code: row.department_code, slug_dept: row.slug_dept, count: 1 })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.department_code.localeCompare(b.department_code))
}

// ============================================
// 5. Helpers UI (labels FR)
// ============================================

export const DIAGNOSTIC_LABEL_FR: Record<DiagnosticType, string> = {
  DPE: 'DPE',
  AMIANTE: 'Amiante',
  PLOMB: 'Plomb (CREP)',
  GAZ: 'Gaz',
  ELECTRICITE: 'Électricité',
  TERMITES: 'Termites',
  CARREZ: 'Loi Carrez / Boutin',
  ERP: 'État des risques (ERP)',
}

export function formatDiagnosticianFullName(
  d: Pick<DiagnosticianRow, 'first_name' | 'last_name'>,
): string {
  return `${d.first_name} ${d.last_name}`.trim()
}

export function hasActiveCertification(
  d: Pick<DiagnosticianRow, 'certifications'>,
  type: DiagnosticType,
): boolean {
  return d.certifications.some((c) => c.type === type && c.status === 'valid')
}
