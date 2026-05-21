import type { MetadataRoute } from 'next'
import {
  buildAnnuaireSitemapPage,
  buildConseilsSitemap,
  buildLegalSitemap,
  buildMarketingSitemap,
  generateAnnuaireSitemapIds,
} from '@/lib/seo/sitemap-builders'

/**
 * Sitemap KOVAS consolidé — un seul `/sitemap.xml` qui agrège tous les segments.
 *
 * Choix V1 : pas de `generateSitemaps()` (qui forcerait des URLs en `/sitemap/[id].xml`
 * sans index `/sitemap.xml` natif). On retourne tout en un seul fichier, conforme
 * aux limites Google (50 000 URLs / 50 MB par sitemap).
 *
 * Segments agrégés :
 *  - marketing   : /, /pricing, /pour-les-diagnostiqueurs, /conseils, /contact, /faq
 *  - legal       : /cgu, /cgv, /confidentialite, /mentions-legales, /dpa
 *  - conseils    : articles SEO publiés (table `seo_publications`)
 *  - annuaire    : pages diagnostiqueurs + ville + département (paginés par 5000 URLs
 *                  dans les builders, on agrège ici toutes les pages)
 *
 * Revalidation incrémentale : 1h.
 */

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [marketing, legal, conseils, annuaireIds] = await Promise.all([
    Promise.resolve(buildMarketingSitemap()),
    Promise.resolve(buildLegalSitemap()),
    buildConseilsSitemap(),
    generateAnnuaireSitemapIds(),
  ])

  const annuairePages = await Promise.all(
    annuaireIds.map((s) => {
      const indexStr = s.id.replace(/^annuaire-/, '')
      const index = Number.parseInt(indexStr, 10)
      return Number.isNaN(index) ? Promise.resolve([] as MetadataRoute.Sitemap) : buildAnnuaireSitemapPage(index)
    }),
  )

  const annuaire = annuairePages.flat()

  return [...marketing, ...legal, ...conseils, ...annuaire]
}
