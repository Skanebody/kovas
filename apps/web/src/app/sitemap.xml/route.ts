/**
 * /sitemap.xml — INDEX racine qui agrège les segments KOVAS.
 *
 * Architecture multi-segments (Google recommande < 50 000 URLs / 50 MB par fichier) :
 *  - /sitemap-static.xml             → pages institutionnelles (~30 URLs)
 *  - /sitemap-villes.xml             → /diagnostiqueurs/{ville} (30 seeds → ~10k Phase 2)
 *  - /sitemap-diagnostiqueurs.xml    → fiches publiques /diagnostiqueurs/{dept}/{ville}/{slug}
 *  - /sitemap-blog.xml               → articles /conseils/{slug}
 *  - /sitemap-guides.xml             → /guide/{type} (8 diagnostics + audit énergétique)
 *  - /sitemap-pros.xml               → /pour-les-diagnostiqueurs et pages B2B
 *  - /sitemap-diagnostics-villes.xml → pages programmatiques croisées (type × ville)
 *
 * Le `lastmod` est calculé à la requête (now) : suffisant pour la fraîcheur
 * Phase 1. En Phase 2, basculer sur `Max(updated_at)` par segment via Supabase.
 *
 * Cache Edge : 1h pour limiter le coût (Cache-Control public, s-maxage=3600).
 */

export const dynamic = 'force-static'
export const revalidate = 3600

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'

const SEGMENTS: readonly string[] = [
  'sitemap-static.xml',
  'sitemap-villes.xml',
  'sitemap-diagnostiqueurs.xml',
  'sitemap-blog.xml',
  'sitemap-guides.xml',
  'sitemap-pros.xml',
  'sitemap-diagnostics-villes.xml',
]

export function GET(): Response {
  const lastmod = new Date().toISOString()

  const entries = SEGMENTS.map((segment) =>
    [
      '  <sitemap>',
      `    <loc>${BASE_URL}/${segment}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      '  </sitemap>',
    ].join('\n'),
  ).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>
`

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
