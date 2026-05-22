/**
 * /sitemap-static.xml — pages institutionnelles statiques.
 *
 * Liste figée maintenue à la main. Toute nouvelle page publique non dynamique
 * doit être ajoutée ici. Les pages dynamiques (villes, blog, fiches) sont
 * dans leurs propres segments.
 *
 * Priorités SEO :
 *  - 1.0  /                              (home, intent commercial maximal)
 *  - 0.9  /pour-les-diagnostiqueurs      (page d'entrée B2B)
 *  - 0.9  /calculateur-dpe-gratuit       (lead magnet B2C)
 *  - 0.8  /observatoire                  (data PR + backlinks)
 *  - 0.8  /diagnostiqueurs               (index annuaire)
 *  - 0.7  /pricing                       (page tarifs)
 *  - 0.7  /guide/*                       (guides longs SEO)
 *  - 0.6  /conseils                      (index blog)
 *  - 0.4  /contact /faq /a-propos /presse /carrieres /partenaires
 *  - 0.2  /(legal)/*                     (CGU, CGV, etc. — noindex côté metadata)
 */

export const dynamic = 'force-static'
export const revalidate = 3600

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'

interface StaticEntry {
  readonly path: string
  readonly changefreq:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never'
  readonly priority: number
}

const STATIC_PAGES: readonly StaticEntry[] = [
  // Pages cœur — high priority
  { path: '/', changefreq: 'weekly', priority: 1.0 },
  { path: '/pour-les-diagnostiqueurs', changefreq: 'monthly', priority: 0.9 },
  { path: '/calculateur-dpe-gratuit', changefreq: 'monthly', priority: 0.9 },
  { path: '/observatoire', changefreq: 'monthly', priority: 0.8 },
  { path: '/diagnostiqueurs', changefreq: 'daily', priority: 0.8 },

  // Tarifs & support — mid priority
  { path: '/pricing', changefreq: 'monthly', priority: 0.7 },
  { path: '/pricing/compare', changefreq: 'monthly', priority: 0.6 },
  { path: '/pricing/calculator', changefreq: 'monthly', priority: 0.6 },

  // Guides longs SEO (8 diagnostics + audit énergétique)
  { path: '/guide/dpe', changefreq: 'monthly', priority: 0.7 },
  { path: '/guide/amiante', changefreq: 'monthly', priority: 0.7 },
  { path: '/guide/plomb', changefreq: 'monthly', priority: 0.7 },
  { path: '/guide/gaz', changefreq: 'monthly', priority: 0.7 },
  { path: '/guide/electricite', changefreq: 'monthly', priority: 0.7 },
  { path: '/guide/termites', changefreq: 'monthly', priority: 0.7 },
  { path: '/guide/carrez', changefreq: 'monthly', priority: 0.7 },
  { path: '/guide/erp', changefreq: 'monthly', priority: 0.7 },
  { path: '/guide/audit-energetique', changefreq: 'monthly', priority: 0.7 },

  // Index conseils
  { path: '/conseils', changefreq: 'weekly', priority: 0.6 },

  // Pages corporate — low priority
  { path: '/a-propos', changefreq: 'monthly', priority: 0.4 },
  { path: '/contact', changefreq: 'monthly', priority: 0.4 },
  { path: '/faq', changefreq: 'monthly', priority: 0.4 },
  { path: '/presse', changefreq: 'monthly', priority: 0.4 },
  { path: '/carrieres', changefreq: 'monthly', priority: 0.4 },
  { path: '/partenaires', changefreq: 'monthly', priority: 0.4 },

  // Pages légales — très faible (noindex via robots metadata côté pages)
  // Présentes ici pour traçabilité bot, pas pour SEO.
  { path: '/mentions-legales', changefreq: 'yearly', priority: 0.2 },
  { path: '/cgv', changefreq: 'yearly', priority: 0.2 },
  { path: '/cgu', changefreq: 'yearly', priority: 0.2 },
  { path: '/confidentialite', changefreq: 'yearly', priority: 0.2 },
  { path: '/cookies', changefreq: 'yearly', priority: 0.2 },
]

export function GET(): Response {
  const lastmod = new Date().toISOString()

  const urls = STATIC_PAGES.map((entry) =>
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
