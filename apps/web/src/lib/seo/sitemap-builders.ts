import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { MetadataRoute } from 'next'

/**
 * Builders sitemap segmentés.
 *
 * Architecture :
 * - Sitemap index : `/sitemap.xml` (généré par `app/sitemap.ts` via `generateSitemaps`)
 * - Sub-sitemaps :
 *    - `marketing`   : landing, pricing, /pour-les-diagnostiqueurs, /trouver-un-diagnostiqueur (root)
 *    - `legal`       : CGU, CGV, confidentialité, mentions légales, DPA
 *    - `conseils`    : articles SEO (table `seo_publications`)
 *    - `annuaire-N`  : pages diagnostiqueurs + pages ville + pages département (paginé)
 *
 * Bordures protectrices :
 * - Si une table SEO est absente de la DB (avant migrations Phase B/C/D),
 *   le builder retourne `[]` au lieu de planter. Le sitemap segment reste valide
 *   et se remplira automatiquement dès que la table sera créée + populée.
 *
 * Référence métier : voir CLAUDE.md §1.1 (architecture URLs publiques KOVAS Annuaire + KOVAS).
 */

/** URL racine canonique. Doit matcher `metadataBase` dans `app/layout.tsx`. */
export const KOVAS_BASE_URL = 'https://kovas.fr'

/**
 * Taille max d'URLs par sub-sitemap annuaire.
 * Google plafonne à 50 000 par fichier. On garde une grosse marge pour rester
 * sous le seuil de 50 MB non-gzippé et accélérer la régénération incrémentale.
 */
export const ANNUAIRE_PAGE_SIZE = 5000

/** Date de dernière mise à jour des pages légales (à versionner à la main lors d'un update CGU/CGV/Privacy). */
const LEGAL_LAST_MODIFIED = new Date('2026-05-21')

/**
 * Erreur Supabase pouvant remonter du runtime PostgREST.
 * Tables SEO encore non migrées => 42P01 / PGRST205. Pas de filtre / mauvais code => PGRST204.
 */
interface PostgrestLikeError {
  code?: string | null
  message?: string | null
}

/**
 * Vue minimaliste du client Supabase utilisée par les builders SEO.
 * On contourne les types `Database` stricts car les tables `seo_publications`
 * et `diagnosticians` ne sont pas encore présentes dans `@kovas/database/types`.
 * La sécurité runtime est assurée par les RLS Supabase + détection 42P01.
 */
interface SitemapQueryBuilder {
  select: (columns: string, options?: { count?: 'exact'; head?: boolean }) => SitemapQueryBuilder
  eq: (column: string, value: unknown) => SitemapQueryBuilder
  order: (column: string) => SitemapQueryBuilder
  range: (from: number, to: number) => SitemapQueryBuilder
  then: <T>(
    resolve: (result: {
      data: Record<string, unknown>[] | null
      error: PostgrestLikeError | null
      count?: number | null
    }) => T,
  ) => Promise<T>
}

interface SitemapSupabaseClient {
  from: (table: string) => SitemapQueryBuilder
}

/**
 * Vérifie si l'erreur Supabase correspond à une table inexistante.
 * Code Postgres 42P01 = `undefined_table`. Postgrest peut aussi remonter `PGRST205`
 * lorsque la table est absente du cache du schéma.
 */
function isMissingTableError(error: PostgrestLikeError | null): boolean {
  if (error === null) return false
  return error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST204'
}

/**
 * Sitemap marketing : pages publiques d'acquisition et entrées annuaire.
 * Mises à jour fréquentes (landing, pricing) — `changeFrequency: weekly`.
 */
export function buildMarketingSitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    {
      url: `${KOVAS_BASE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${KOVAS_BASE_URL}/pricing`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${KOVAS_BASE_URL}/pricing/compare`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${KOVAS_BASE_URL}/pricing/calculator`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${KOVAS_BASE_URL}/pour-les-diagnostiqueurs`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${KOVAS_BASE_URL}/trouver-un-diagnostiqueur`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${KOVAS_BASE_URL}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${KOVAS_BASE_URL}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ]
}

/**
 * Sitemap legal : CGU, CGV, Confidentialité, Mentions légales, DPA.
 * Faible priorité (pages obligatoires mais peu de valeur SEO).
 */
export function buildLegalSitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${KOVAS_BASE_URL}/cgu`,
      lastModified: LEGAL_LAST_MODIFIED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${KOVAS_BASE_URL}/cgv`,
      lastModified: LEGAL_LAST_MODIFIED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${KOVAS_BASE_URL}/confidentialite`,
      lastModified: LEGAL_LAST_MODIFIED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${KOVAS_BASE_URL}/mentions-legales`,
      lastModified: LEGAL_LAST_MODIFIED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${KOVAS_BASE_URL}/dpa`,
      lastModified: LEGAL_LAST_MODIFIED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}

/**
 * Récupère le client Supabase typé "loose" pour interroger des tables non encore
 * déclarées dans `@kovas/database/types` (migrations Phase B/C/D à venir).
 */
async function getSeoClient(): Promise<SitemapSupabaseClient> {
  const supabase = await createClient()
  return supabase as unknown as SitemapSupabaseClient
}

/**
 * Sitemap conseils : articles SEO publiés (table `seo_publications`).
 * Retourne `[]` si la table n'existe pas encore (Phase D non livrée).
 */
export async function buildConseilsSitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await getSeoClient()
  const { data, error } = await supabase
    .from('seo_publications')
    .select('published_url, published_at, last_gsc_sync_at')

  if (error !== null) {
    // Table absente OU autre erreur (RLS, réseau) : on laisse vide.
    if (isMissingTableError(error)) return []
    return []
  }

  const rows = (data ?? []) as Array<{
    published_url: string | null
    published_at: string | null
    last_gsc_sync_at: string | null
  }>

  return rows
    .filter(
      (
        row,
      ): row is {
        published_url: string
        published_at: string | null
        last_gsc_sync_at: string | null
      } => typeof row.published_url === 'string' && row.published_url.length > 0,
    )
    .map((row) => {
      const lastMod = row.last_gsc_sync_at ?? row.published_at
      const path = row.published_url.startsWith('/') ? row.published_url : `/${row.published_url}`
      return {
        url: `${KOVAS_BASE_URL}${path}`,
        lastModified: lastMod !== null ? new Date(lastMod) : new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }
    })
}

/**
 * Récupère un client Supabase admin (service_role) pour les builders sitemap.
 * Bypass RLS — nécessaire car la policy `diag_public_read_verified_only`
 * filtrerait les fiches DHUP unclaimed unverified pourtant légitimement
 * publiques côté annuaire.
 *
 * Le sitemap est généré côté server (jamais bundlé côté client), l'usage du
 * service_role est légitime ici.
 */
// biome-ignore lint/suspicious/noExplicitAny: typage loose post Phase B/C (Database types pas régénérés)
function getAdminSeoClient(): any {
  return createAdminClient()
}

/**
 * Calcule le nombre de sub-sitemaps annuaire nécessaires en fonction
 * du volume actuel de diagnostiqueurs publiés.
 *
 * Retourne au minimum `[{ id: 'annuaire-0' }]` même si la table est vide,
 * pour signaler que la chaîne sitemap annuaire est en place.
 */
export async function generateAnnuaireSitemapIds(): Promise<{ id: string }[]> {
  const supabase = getAdminSeoClient()
  const { count, error } = await supabase
    .from('diagnosticians')
    .select('id', { count: 'exact', head: true })
    .eq('is_published', true)
    .eq('withdrawal_requested', false)

  if (error !== null) {
    // Pas encore de migration annuaire OU table vide : un seul sitemap vide pour garder l'architecture.
    return [{ id: 'annuaire-0' }]
  }

  const total = count ?? 0
  const pages = Math.max(1, Math.ceil(total / ANNUAIRE_PAGE_SIZE))
  return Array.from({ length: pages }, (_, i) => ({ id: `annuaire-${i}` }))
}

/**
 * Sitemap annuaire (paginé) : pages diagnostiqueurs individuels + pages ville + département.
 *
 * Pour éviter les doublons, les pages ville et département sont uniquement
 * insérées dans la page d'index 0. Les diagnostiqueurs individuels sont
 * répartis sur toutes les pages.
 *
 * Schéma canonique unifié : URLs construites depuis `department_code` (alias
 * `dept_code` legacy) + `city_slug` + `slug`. Les colonnes `slug_dept` /
 * `slug_city` legacy ne sont plus utilisées (cf. migration 20260524180000
 * qui consolide le schéma).
 */
export async function buildAnnuaireSitemapPage(pageIndex: number): Promise<MetadataRoute.Sitemap> {
  const supabase = getAdminSeoClient()
  const from = pageIndex * ANNUAIRE_PAGE_SIZE
  const to = (pageIndex + 1) * ANNUAIRE_PAGE_SIZE - 1

  const { data, error } = await supabase
    .from('diagnosticians')
    .select('slug, city_slug, department_code, dept_code, updated_at')
    .eq('is_published', true)
    .eq('withdrawal_requested', false)
    .order('id')
    .range(from, to)

  if (error !== null) {
    // Table absente ou RLS bloqué : sitemap annuaire vide.
    return []
  }

  const diagnosticians = (data ?? []) as Array<{
    slug: string | null
    city_slug: string | null
    department_code: string | null
    dept_code: string | null
    updated_at: string | null
  }>

  const urls: MetadataRoute.Sitemap = []

  // Pages individuelles diagnostiqueurs
  for (const diag of diagnosticians) {
    const dept = diag.department_code ?? diag.dept_code
    if (diag.slug === null || diag.city_slug === null || !dept) {
      continue
    }
    urls.push({
      url: `${KOVAS_BASE_URL}/trouver-un-diagnostiqueur/${dept}/${diag.city_slug}/${diag.slug}`,
      lastModified: diag.updated_at !== null ? new Date(diag.updated_at) : new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    })
  }

  // Pages ville + département uniquement sur la page 0 pour déduplication globale
  if (pageIndex === 0) {
    const cityKeys = new Set<string>()
    const deptKeys = new Set<string>()
    const now = new Date()

    for (const diag of diagnosticians) {
      const dept = diag.department_code ?? diag.dept_code
      if (!dept) continue

      // Page département
      if (!deptKeys.has(dept)) {
        deptKeys.add(dept)
        urls.push({
          url: `${KOVAS_BASE_URL}/trouver-un-diagnostiqueur/${dept}`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.8,
        })
      }

      // Page ville
      if (diag.city_slug !== null) {
        const cityKey = `${dept}/${diag.city_slug}`
        if (!cityKeys.has(cityKey)) {
          cityKeys.add(cityKey)
          urls.push({
            url: `${KOVAS_BASE_URL}/trouver-un-diagnostiqueur/${dept}/${diag.city_slug}`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.7,
          })
        }
      }
    }
  }

  return urls
}
