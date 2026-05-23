/**
 * /sitemap-guides.xml — guides longs SEO par type de diagnostic.
 *
 * URLs canoniques : /guide/{type}
 *
 * Liste statique (8 diagnostics standards + audit énergétique). Ces pages
 * sont construites comme des landing pages SEO Long-tail haute valeur :
 *  - 2000-3500 mots
 *  - Schema HowTo + FAQPage
 *  - Backlinks internes vers /calculateur-dpe-gratuit + /trouver-un-diagnostiqueur
 *
 * Priorité 0.7 (juste sous la home et les pages CTA principales).
 *
 * Phase 2 : ajouter des sous-pages /guide/{type}/{angle}
 *  (ex. /guide/dpe/2024, /guide/dpe/maison-individuelle, etc.)
 */

export const dynamic = 'force-static'
export const revalidate = 3600

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'

const GUIDE_SLUGS: readonly string[] = [
  'dpe',
  'amiante',
  'plomb',
  'gaz',
  'electricite',
  'termites',
  'carrez',
  'erp',
  'audit-energetique',
]

export function GET(): Response {
  const lastmod = new Date().toISOString()

  const urls = GUIDE_SLUGS.map((slug) =>
    [
      '  <url>',
      `    <loc>${BASE_URL}/guide/${slug}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      '    <changefreq>monthly</changefreq>',
      '    <priority>0.7</priority>',
      '  </url>',
    ].join('\n'),
  ).join('\n')

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
