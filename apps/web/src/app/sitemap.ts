import type { MetadataRoute } from 'next'
import {
  buildAnnuaireSitemapPage,
  buildConseilsSitemap,
  buildLegalSitemap,
  buildMarketingSitemap,
  generateAnnuaireSitemapIds,
} from '@/lib/seo/sitemap-builders'

/**
 * Sitemap segmenté KOVAS.
 *
 * Next.js 15 expose un sitemap multi-fichiers via `generateSitemaps()` :
 * - Un index `/sitemap.xml` (auto-généré par Next.js)
 * - N sub-sitemaps `/sitemap/{id}.xml` (un par segment retourné)
 *
 * Segments produits :
 *  - `marketing`   : landing / pricing / pour-les-diagnostiqueurs / contact / faq
 *  - `legal`       : CGU / CGV / Confidentialité / Mentions légales / DPA
 *  - `conseils`    : articles SEO publiés (table `seo_publications`)
 *  - `annuaire-N`  : pages diagnostiqueurs + ville + département (paginés par 5000 URLs)
 *
 * Revalidation incrémentale : 1h (sitemap regénéré au max toutes les heures).
 */

/** Revalide le sitemap toutes les 1h (3600s). */
export const revalidate = 3600

export async function generateSitemaps(): Promise<{ id: string }[]> {
  const annuaireIds = await generateAnnuaireSitemapIds()
  return [{ id: 'marketing' }, { id: 'legal' }, { id: 'conseils' }, ...annuaireIds]
}

export default async function sitemap({ id }: { id: string }): Promise<MetadataRoute.Sitemap> {
  if (id === 'marketing') {
    return buildMarketingSitemap()
  }
  if (id === 'legal') {
    return buildLegalSitemap()
  }
  if (id === 'conseils') {
    return await buildConseilsSitemap()
  }
  if (id.startsWith('annuaire-')) {
    const indexStr = id.slice('annuaire-'.length)
    const index = Number.parseInt(indexStr, 10)
    if (Number.isNaN(index) || index < 0) {
      return []
    }
    return await buildAnnuaireSitemapPage(index)
  }
  return []
}
