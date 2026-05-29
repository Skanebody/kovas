/**
 * /sitemap-pros.xml — pages B2B logiciel KOVAS pour diagnostiqueurs.
 *
 * URLs canoniques post-restructure /pros/* → /* (Lot B33) :
 * /, /fonctionnalites, /tarifs, /comparatif, /temoignages, /demo,
 * /blog, /api-publique, /pour-les-diagnostiqueurs.
 *
 * Note : ces pages ciblent le SEO B2B "logiciel diagnostic immobilier",
 * "compagnon Liciel / OBBC / AnalysImmo", "couche terrain diagnostic",
 * "automatisation diagnostic". Priorité 0.7-0.9 selon intent commercial.
 */

export const dynamic = 'force-static'
export const revalidate = 3600

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'

interface ProsEntry {
  readonly path: string
  readonly changefreq: 'weekly' | 'monthly'
  readonly priority: number
}

const PROS_PAGES: readonly ProsEntry[] = [
  // Pages B2B canoniques post-restructure Lot B33
  { path: '/', changefreq: 'weekly', priority: 1.0 },
  { path: '/pour-les-diagnostiqueurs', changefreq: 'monthly', priority: 0.9 },
  { path: '/fonctionnalites', changefreq: 'monthly', priority: 0.8 },
  { path: '/tarifs', changefreq: 'weekly', priority: 0.9 },
  { path: '/pricing', changefreq: 'monthly', priority: 0.8 },
  { path: '/pricing/compare', changefreq: 'monthly', priority: 0.6 },
  { path: '/pricing/calculator', changefreq: 'monthly', priority: 0.6 },
  { path: '/comparatif', changefreq: 'monthly', priority: 0.7 },
  { path: '/temoignages', changefreq: 'monthly', priority: 0.6 },
  { path: '/demo', changefreq: 'monthly', priority: 0.6 },
  { path: '/blog', changefreq: 'weekly', priority: 0.6 },
  { path: '/api-publique', changefreq: 'monthly', priority: 0.5 },
]

export function GET(): Response {
  const lastmod = new Date().toISOString()

  const urls = PROS_PAGES.map((entry) =>
    [
      '  <url>',
      `    <loc>${BASE_URL}${entry.path}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${entry.changefreq}</changefreq>`,
      `    <priority>${entry.priority.toFixed(1)}</priority>`,
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
