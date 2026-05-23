import { getAllTop5000Slugs } from '@/lib/cities/top-5000'

/**
 * sitemap-villes-5000.xml — pages programmatiques /trouver-un-diagnostiqueur/[dept]/[city]
 *
 * Stratégie Core Update mai 2026 (déployé 21/05/2026) :
 *  - 213 villes premium (registry) + 445 villes extras top-5000 = ~640 URLs.
 *  - Priority 0.7 sur toutes les URLs (qualité homogène).
 *  - changefreq weekly (data déterministe locale + diagnostiqueurs DHUP MAJ).
 *  - lastmod = build time (les pages sont régénérées ISR 24h).
 *
 * Limite Google : 50 000 URLs / fichier max. Nous sommes très en-dessous.
 *
 * À termes, quand le dataset INSEE COG complet sera intégré et que nous
 * monterons à 5000 villes réelles validées, ce sitemap restera unique.
 */

export const dynamic = 'force-static'
export const revalidate = 86400 // 24h

export function GET(): Response {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'
  const lastmod = new Date().toISOString()

  const slugs = getAllTop5000Slugs()

  const urls = slugs
    .map((s) => {
      const loc = `${baseUrl}/trouver-un-diagnostiqueur/${s.dept}/${s.city}`
      return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        '    <changefreq>weekly</changefreq>',
        '    <priority>0.7</priority>',
        '  </url>',
      ].join('\n')
    })
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
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
