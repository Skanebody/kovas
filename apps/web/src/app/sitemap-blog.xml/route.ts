import { BLOG_POSTS } from '@/lib/seo/blog-posts'
import { createClient } from '@/lib/supabase/server'

/**
 * sitemap-blog.xml — articles /conseils/{slug}.
 *
 * Source unique : table Supabase `seo_publications` (Phase D). Fallback sur la
 * source statique `BLOG_POSTS` si la table n'est pas encore disponible.
 *
 * URL canonique : `/conseils/{slug}` (et non /blog/{slug}, l'app utilise /conseils).
 *
 * Cache 1h. Phase 2 : ajouter Image Sitemap pour les covers articles.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 3600

interface PublicationRow {
  published_url: string | null
  published_at: string | null
  last_gsc_sync_at: string | null
}

export async function GET(): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'
  const supabase = await createClient()

  // biome-ignore lint/suspicious/noExplicitAny: table seo_publications pas encore typée.
  const { data, error } = await (supabase as any)
    .from('seo_publications')
    .select('published_url, published_at, last_gsc_sync_at')

  const dbUrls: string[] = []
  if (!error && Array.isArray(data)) {
    const rows = data as PublicationRow[]
    for (const row of rows) {
      if (typeof row.published_url !== 'string' || row.published_url.length === 0) continue
      const path = row.published_url.startsWith('/') ? row.published_url : `/${row.published_url}`
      const lastmod = row.last_gsc_sync_at ?? row.published_at ?? new Date().toISOString()
      dbUrls.push(
        [
          '  <url>',
          `    <loc>${baseUrl}${path}</loc>`,
          `    <lastmod>${new Date(lastmod).toISOString()}</lastmod>`,
          '    <changefreq>monthly</changefreq>',
          '    <priority>0.6</priority>',
          '  </url>',
        ].join('\n'),
      )
    }
  }

  // Fallback statique si la DB est vide (avant pipeline contenu démarré).
  const fallbackUrls =
    dbUrls.length === 0
      ? BLOG_POSTS.map((post) => {
          const loc = `${baseUrl}/conseils/${post.slug}`
          const lastmod = post.updatedAt ?? post.publishedAt
          return [
            '  <url>',
            `    <loc>${loc}</loc>`,
            `    <lastmod>${lastmod}</lastmod>`,
            '    <changefreq>monthly</changefreq>',
            '    <priority>0.6</priority>',
            '  </url>',
          ].join('\n')
        })
      : []

  const urls = (dbUrls.length > 0 ? dbUrls : fallbackUrls).join('\n')

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
