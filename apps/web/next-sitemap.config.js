/**
 * next-sitemap — génération automatique du sitemap.xml statique post-build.
 *
 * Lancé via le `postbuild` script de @kovas/web. Couvre les pages App Router
 * connues à la compilation. Les routes dynamiques massives (fiches diagnostiqueurs,
 * blog) sont déléguées à des sitemaps séparés exposés par des Route Handlers :
 *
 *  - /sitemap-villes.xml → apps/web/src/app/sitemap-villes.xml/route.ts
 *  - /sitemap-blog.xml   → apps/web/src/app/sitemap-blog.xml/route.ts
 *
 * Ces enfants sont déclarés ici via `robotsTxtOptions.additionalSitemaps`
 * pour que Google les découvre automatiquement via robots.txt.
 *
 * @type {import('next-sitemap').IConfig}
 */
const config = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr',
  generateRobotsTxt: true,
  changefreq: 'weekly',
  priority: 0.7,
  sitemapSize: 5000,
  exclude: [
    '/dashboard/*',
    '/api/*',
    '/validate/*',
    '/mission/*',
    '/upload-photo/*',
    '/admin/*',
    '/app/*',
    '/(auth)/*',
    '/login',
    '/signup',
  ],
  robotsTxtOptions: {
    policies: [
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
    additionalSitemaps: [
      'https://kovas.fr/sitemap-villes.xml',
      'https://kovas.fr/sitemap-blog.xml',
    ],
  },
  /**
   * Custom priorités SEO :
   *  - 1.0  pour la home (intent commercial maximal)
   *  - 0.9  pour chaque fiche /diagnostiqueurs/{slug} (acquisition SEO local)
   *  - 0.6  pour chaque /blog/{slug}
   *  - 0.7  défaut pour le reste
   */
  transform: async (cfg, path) => {
    let priority = cfg.priority
    let changefreq = cfg.changefreq

    if (path === '/') {
      priority = 1.0
      changefreq = 'daily'
    } else if (path.startsWith('/diagnostiqueurs/')) {
      priority = 0.9
      changefreq = 'weekly'
    } else if (path.startsWith('/blog/')) {
      priority = 0.6
      changefreq = 'monthly'
    }

    return {
      loc: path,
      changefreq,
      priority,
      lastmod: new Date().toISOString(),
      alternateRefs: cfg.alternateRefs ?? [],
    }
  },
}

module.exports = config
