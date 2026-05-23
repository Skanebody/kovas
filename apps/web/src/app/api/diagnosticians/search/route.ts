/**
 * API publique de recherche dans l'annuaire diagnostiqueurs.
 *
 * Route : `GET /api/diagnosticians/search`
 *
 * Query parameters :
 *   - q          (string)   : recherche libre nom/ville (ILIKE + unaccent)
 *   - city_slug  (string)   : slug ville (paris, lyon-69003, …)
 *   - dept       (string)   : code département (75, 13, 2A, …)
 *   - certs      (string)   : types certif CSV (DPE,AMIANTE,PLOMB,…)
 *   - lat        (number)   : latitude (avec lng + radius = filtre rayon km)
 *   - lng        (number)   : longitude
 *   - radius_km  (number)   : rayon de recherche en km (défaut 30)
 *   - limit      (number)   : taille page (défaut 24, max 100)
 *   - offset     (number)   : offset pagination
 *
 * Backed by RPC PG `search_diagnosticians` (migration 20260524110000).
 *
 * Sécurité : pas d'auth requise (annuaire public). Rate-limit via middleware
 * global (cf. middleware.ts). RLS gère la visibilité (is_published, certif_valid_count).
 */

import { createClient } from '@/lib/supabase/server'
import { type NextRequest, NextResponse } from 'next/server'

interface RpcRow {
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

export interface DirectorySearchResult {
  id: string
  slug: string | null
  full_name: string | null
  city: string | null
  city_slug: string | null
  department_code: string | null
  postcode: string | null
  certifications: string[]
  gmb_rating: number | null
  gmb_review_count: number | null
  claim_status: string | null
  photo_url: string | null
  latitude: number | null
  longitude: number | null
  distance_km: number | null
}

export interface DirectorySearchResponse {
  ok: boolean
  results: DirectorySearchResult[]
  count: number
  error?: string
}

function parseNumber(v: string | null, fallback?: number): number | undefined {
  if (v === null) return fallback
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

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

export async function GET(req: NextRequest): Promise<NextResponse<DirectorySearchResponse>> {
  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').trim() || null
  const citySlug = (sp.get('city_slug') ?? '').trim() || null
  const dept = (sp.get('dept') ?? '').trim() || null
  const certsRaw = (sp.get('certs') ?? '').trim()
  const certs = certsRaw
    ? certsRaw
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
    : null
  const lat = parseNumber(sp.get('lat'))
  const lng = parseNumber(sp.get('lng'))
  const radiusKm = Math.min(200, Math.max(1, parseNumber(sp.get('radius_km'), 30) ?? 30))
  const limit = Math.min(100, Math.max(1, parseNumber(sp.get('limit'), 24) ?? 24))
  const offset = Math.max(0, parseNumber(sp.get('offset'), 0) ?? 0)

  try {
    const supabase = await createClient()
    // biome-ignore lint/suspicious/noExplicitAny: types Database à régénérer post-FIX-D
    const client = supabase as any

    const { data, error } = await client.rpc('search_diagnosticians', {
      p_query: q,
      p_city_slug: citySlug,
      p_dept_code: dept,
      p_certs: certs && certs.length > 0 ? certs : null,
      p_lat: lat ?? null,
      p_lng: lng ?? null,
      p_radius_km: radiusKm,
      p_limit: limit,
      p_offset: offset,
    })

    if (error) {
      return NextResponse.json(
        { ok: false, results: [], count: 0, error: error.message },
        { status: 500 },
      )
    }

    const rows = (data ?? []) as RpcRow[]
    const results: DirectorySearchResult[] = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      full_name: r.full_name,
      city: r.city,
      city_slug: r.city_slug,
      department_code: r.department_code,
      postcode: r.postcode,
      certifications: extractCertCodes(r.certifications),
      gmb_rating: r.gmb_rating,
      gmb_review_count: r.gmb_review_count,
      claim_status: r.claim_status,
      photo_url: r.photo_url,
      latitude: r.latitude,
      longitude: r.longitude,
      distance_km: r.distance_km,
    }))

    return NextResponse.json(
      { ok: true, results, count: results.length },
      {
        status: 200,
        headers: {
          // Cache 5 min sur l'edge (annuaire public, peu volatile)
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        },
      },
    )
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        results: [],
        count: 0,
        error: e instanceof Error ? e.message : 'Erreur inconnue',
      },
      { status: 500 },
    )
  }
}
