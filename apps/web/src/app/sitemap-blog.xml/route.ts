import { BLOG_POSTS } from '@/lib/seo/blog-posts'

/**
 * sitemap-blog.xml — articles /blog/{slug}.
 *
 * Phase 1 : alimenté par la source statique `BLOG_POSTS` (vide tant que le
 * pipeline contenu n'est pas démarré). Quand un schéma `blog_posts` Supabase
 * sera ajouté, basculer sur une requête DB et un `revalidate` 5-15 min.
 *
 * Le sitemap reste émis (XML valide, urlset vide accepté par les crawlers)
 * même si aucun article : robots.txt peut le déclarer sans condition.
 */
export const dynamic = 'force-static'
export const revalidate = 3600

export function GET(): Response {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'

  const urls = BLOG_POSTS.map((post) => {
    const loc = `${baseUrl}/blog/${post.slug}`
    const lastmod = post.updatedAt ?? post.publishedAt
    return [
      '  <url>',
      `    <loc>${loc}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      '    <changefreq>monthly</changefreq>',
      '    <priority>0.6</priority>',
      '  </url>',
    ].join('\n')
  }).join('\n')

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
