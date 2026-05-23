/**
 * next-sitemap — DÉPRÉCIÉ depuis Lot #145 SEO.
 *
 * La génération du sitemap et du robots.txt est désormais 100% assurée par les
 * Route Handlers Next.js App Router :
 *  - /sitemap.xml             → app/sitemap.xml/route.ts (INDEX)
 *  - /sitemap-static.xml      → segments institutionnels
 *  - /sitemap-villes.xml      → pages villes annuaire
 *  - /sitemap-trouver-un-diagnostiqueur.xml → fiches publiques
 *  - /sitemap-blog.xml        → articles /conseils/[slug]
 *  - /sitemap-guides.xml      → guides longs /guide/[type]
 *  - /sitemap-pros.xml        → pages B2B /pros/*
 *  - /sitemap-diagnostics-villes.xml → pages programmatiques croisées
 *  - /robots.txt              → app/robots.ts
 *
 * Ce fichier reste présent pour ne pas casser le `postbuild` si réactivé en
 * urgence, mais `generateRobotsTxt: false` et `generateIndexSitemap: false`
 * désactivent toute production de fichiers concurrents.
 *
 * @type {import('next-sitemap').IConfig}
 */
const config = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr',
  generateRobotsTxt: false,
  generateIndexSitemap: false,
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
   *  - 0.9  pour chaque fiche /trouver-un-diagnostiqueur/{slug} (acquisition SEO local)
   *  - 0.6  pour chaque /blog/{slug}
   *  - 0.7  défaut pour le reste
   */
  transform: async (cfg, path) => {
    let priority = cfg.priority
    let changefreq = cfg.changefreq

    if (path === '/') {
      priority = 1.0
      changefreq = 'daily'
    } else if (path.startsWith('/trouver-un-diagnostiqueur/')) {
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
