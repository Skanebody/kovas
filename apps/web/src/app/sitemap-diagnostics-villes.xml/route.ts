/**
 * /sitemap-diagnostics-villes.xml — pages programmatiques croisées (type × ville).
 *
 * URLs canoniques : /diagnostic/{type}/{ville}
 *
 * Cible SEO : longue traîne "diagnostic dpe paris", "amiante lyon", etc.
 * Volume potentiel : 9 types × 30 villes seeds = 270 URLs Phase 1.
 *  Phase 2 : 9 × 1000 villes Supabase = ~9000 URLs (toujours sous limite 50k).
 *
 * Composition :
 *  - 9 types de diagnostic (8 standards + audit énergétique)
 *  - 30 villes seeds depuis `SEO_CITIES`
 *
 * Priorité 0.5 (longue traîne, mais volume cumulé important).
 */

import { SEO_CITIES } from '@/lib/seo/cities'

export const dynamic = 'force-static'
export const revalidate = 3600

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'

const DIAGNOSTIC_TYPES: readonly string[] = [
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

  const urls: string[] = []

  for (const type of DIAGNOSTIC_TYPES) {
    for (const city of SEO_CITIES) {
      urls.push(
        [
          '  <url>',
          `    <loc>${BASE_URL}/diagnostic/${type}/${city.slug}</loc>`,
          `    <lastmod>${lastmod}</lastmod>`,
          '    <changefreq>monthly</changefreq>',
          '    <priority>0.5</priority>',
          '  </url>',
        ].join('\n'),
      )
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
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
