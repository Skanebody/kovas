/**
 * /sitemap-diagnostics-villes.xml — sitemap des pages programmatiques SEO.
 *
 * Refonte Acqui-Target 2026-05 : suppression de 4 templates programmatiques
 * (prix, comparatif, audit-energetique, maprimerenov, urgent) au profit d'un
 * unique template enrichi.
 *
 * Couvre désormais 1 pattern d'URL :
 *   - /diagnostic/{type}/{ville}      (9 diagnostics × N villes)
 *
 * Volume V1 (213 villes registry × 9 diagnostics) : ~1 917 URLs.
 *
 * Priorité sitemap : 0.6 par défaut + boost top cities (+0.1) / penalité low (-0.05).
 *
 * Note : si volume dépasse 50k URLs (sprint V2 avec 5000+ villes), passer en
 * sitemap-index paginé via Next.js `generateSitemaps`.
 */

import { CITIES } from '@/lib/cities/registry'
import { DIAGNOSTIC_TYPES } from '@/lib/diagnostics/types'

export const dynamic = 'force-static'
export const revalidate = 86400

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'

interface SitemapEntry {
  readonly loc: string
  readonly priority: number
  readonly changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

function priorityForCity(priority: 'top' | 'mid' | 'low'): number {
  if (priority === 'top') return 0.1
  if (priority === 'mid') return 0
  return -0.05
}

function buildEntries(): ReadonlyArray<SitemapEntry> {
  const entries: SitemapEntry[] = []

  for (const city of CITIES) {
    const boost = priorityForCity(city.priority)

    for (const type of DIAGNOSTIC_TYPES) {
      entries.push({
        loc: `${BASE_URL}/diagnostic/${type}/${city.slug}`,
        priority: Math.max(0.3, Math.min(0.9, 0.6 + boost)),
        changefreq: 'monthly',
      })
    }
  }

  return entries
}

export function GET(): Response {
  const lastmod = new Date().toISOString()
  const entries = buildEntries()

  const urls = entries
    .map((entry) =>
      [
        '  <url>',
        `    <loc>${entry.loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority.toFixed(2)}</priority>`,
        '  </url>',
      ].join('\n'),
    )
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
