import { SEO_CITIES } from '@/lib/seo/cities'

/**
 * sitemap-villes.xml — fiches /diagnostiqueurs/{slug} pour acquisition SEO local.
 *
 * Phase 1 : lecture depuis la source statique `SEO_CITIES` (30 villes seed).
 * Phase 2 : remplacer par une requête Supabase quand la table `cities` sera
 * créée (sprint SEO M3-M4). À ce moment-là, ajouter aussi un `revalidate`
 * de l'ordre de 24h.
 *
 * Cache-Control 1h pour limiter le coût Edge sans bloquer une mise à jour
 * rapide en cas de re-référencement.
 */
export const dynamic = 'force-static'
export const revalidate = 3600

export function GET(): Response {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'
  const lastmod = new Date().toISOString()

  const urls = SEO_CITIES.map((city) => {
    const loc = `${baseUrl}/diagnostiqueurs/${city.slug}`
    return [
      '  <url>',
      `    <loc>${loc}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      '    <changefreq>weekly</changefreq>',
      '    <priority>0.9</priority>',
      '  </url>',
    ].join('\n')
  }).join('\n')

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
