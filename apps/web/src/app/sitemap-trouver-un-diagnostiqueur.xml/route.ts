/**
 * /sitemap-trouver-un-diagnostiqueur.xml — fiches publiques diagnostiqueurs.
 *
 * URLs canoniques : /trouver-un-diagnostiqueur/{dept_code}/{city_slug}/{slug}
 *
 * Source : table Supabase `diagnosticians`. Le sitemap doit refléter ce qui
 * est réellement visible publiquement (donc les fiches `is_published=true` ET
 * `withdrawal_requested=false`).
 *
 * Important :
 *  - Bypass RLS via `createAdminClient` (service_role) — la RLS publique exige
 *    désormais `verification_status='verified'` ce qui exclurait les fiches
 *    DHUP unclaimed pourtant légitimement publiques.
 *  - Schéma canonique unifié : `department_code` (alias `dept_code`) +
 *    `city_slug`. Les anciens `slug_dept`/`slug_city` n'existent plus comme
 *    colonnes canoniques (legacy).
 *
 * Limite : 50 000 URLs/fichier. Au-delà → pagination (Phase 2).
 */

export const dynamic = 'force-dynamic'
export const revalidate = 3600

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'

interface DiagnosticianRow {
  slug: string | null
  city_slug: string | null
  department_code: string | null
  dept_code: string | null
  updated_at: string | null
}

export async function GET(): Promise<Response> {
  // Admin client (service_role) — sitemap doit refléter toutes les fiches
  // publiques (is_published=true) sans être bridé par la RLS verified-only.
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = createAdminClient()

  // Type-cast pour échapper aux types Database (régen pending).
  // biome-ignore lint/suspicious/noExplicitAny: shape table non typée Phase 1.
  const { data, error } = await (supabase as any)
    .from('diagnosticians')
    .select('slug, city_slug, department_code, dept_code, updated_at')
    .eq('is_published', true)
    .eq('withdrawal_requested', false)
    .order('updated_at', { ascending: false })
    .limit(50000)

  // Table absente ou query qui échoue → urlset vide accepté par les crawlers.
  const rows: DiagnosticianRow[] = error || !data ? [] : (data as DiagnosticianRow[])

  const urls = rows
    .map((r) => {
      const dept = r.department_code ?? r.dept_code
      const city = r.city_slug
      const slug = r.slug
      if (!dept || !city || !slug) return null
      const loc = `${BASE_URL}/trouver-un-diagnostiqueur/${dept}/${city}/${slug}`
      const lastmod =
        r.updated_at !== null ? new Date(r.updated_at).toISOString() : new Date().toISOString()
      return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        '    <changefreq>weekly</changefreq>',
        '    <priority>0.6</priority>',
        '  </url>',
      ].join('\n')
    })
    .filter((u): u is string => u !== null)
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
