/**
 * Catalogue d'articles de blog (placeholder).
 *
 * Quand un schéma `blog_posts` Supabase sera ajouté (sprint M2 contenu SEO),
 * cette source statique sera remplacée par une requête DB. Pour l'instant,
 * tableau vide ⇒ sitemap-blog.xml présent mais sans entrée jusqu'à la mise
 * en production des premiers articles.
 */

export interface BlogPostSeed {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly publishedAt: string
  readonly updatedAt?: string
  readonly authorName: string
}

export const BLOG_POSTS: ReadonlyArray<BlogPostSeed> = [
  // Aucun article publié pour l'instant — pipeline M2.
]
