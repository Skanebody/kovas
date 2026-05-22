import type { MetadataRoute } from 'next'

/**
 * robots.txt généré par la Metadata Route de Next.js App Router.
 *
 * Source unique de vérité pour les directives crawler. Le hook `postbuild`
 * `next-sitemap` ne génère plus de robots.txt (cf. next-sitemap.config.js)
 * — ce fichier est la seule autorité.
 *
 * Disallow stricts :
 *  - /dashboard, /api, /admin → endpoints authentifiés + données privées
 *  - /validate, /upload, /upload-photo → flux interne mission
 *  - /(auth)/ → connexion / inscription (pas de valeur SEO, risque indexation)
 *  - /mes-demandes, /verifier-mon-email, /reclamer-ma-fiche → flux user privé
 *  - /d/ → espace défense diagnostiqueur (correction fiche, retrait, leads)
 *  - /clear-sw → utilitaire dev
 *
 * Sitemap déclaré : /sitemap.xml (index pointant vers tous les segments).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/api',
          '/validate',
          '/upload-photo',
          '/upload',
          '/admin',
          '/clear-sw',
          '/(auth)/',
          '/login',
          '/signup',
          '/mes-demandes',
          '/verifier-mon-email',
          '/reclamer-ma-fiche',
          '/d/',
        ],
      },
    ],
    sitemap: ['https://kovas.fr/sitemap.xml'],
    host: 'https://kovas.fr',
  }
}
