import type { MetadataRoute } from 'next'

/**
 * Robots.txt généré par la Metadata Route de Next.js App Router.
 *
 * Source unique de vérité pour les directives crawler. `next-sitemap` génère
 * également un robots.txt statique (postbuild) — celui-ci sert de fallback /
 * doublon utile pour les preview deployments où `next-sitemap` ne tourne pas.
 *
 * Les /app/*, /api/*, /admin/* etc. sont strictement interdits aux crawlers
 * (données personnelles, endpoints authentifiés). Le /dashboard/ historique
 * est conservé par sécurité.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/api/',
          '/validate/',
          '/mission/',
          '/admin/',
          '/app/',
          '/upload-photo/',
          '/login',
          '/signup',
        ],
      },
    ],
    sitemap: [
      'https://kovas.fr/sitemap.xml',
      'https://kovas.fr/sitemap-villes.xml',
      'https://kovas.fr/sitemap-blog.xml',
    ],
    host: 'https://kovas.fr',
  }
}
