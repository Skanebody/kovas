/**
 * /sitemap-diagnostiqueurs.xml — fiches publiques diagnostiqueurs.
 *
 * URLs canoniques : /diagnostiqueurs/{slug_dept}/{slug_city}/{slug}
 *
 * Source : table Supabase `diagnosticians` (où `is_published = true` et
 * `withdrawal_requested = false`). RLS doit autoriser le lecture publique
 * de ces colonnes minimales pour permettre l'accès anonyme depuis l'edge.
 *
 * Limite stricte : 50 000 URLs / fichier. Au-delà → pagination
 * `sitemap-diagnostiqueurs-1.xml`, `-2.xml`, etc. À implémenter quand le
 * volume dépassera 40 000 (réserve 20%). À ce stade, on agrège tout en un.
 *
 * Plan Phase 2 :
 *  - bascule sur un `generateStaticParams` + ISR par dept (94 depts FR)
 *    pour répartir la charge de génération et améliorer le `lastmod` granulaire
 *  - injection `<image:image>` Google Image Sitemap pour les photos profil
 */

import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'

interface DiagnosticianRow {
  slug: string | null
  slug_city: string | null
  slug_dept: string | null
  updated_at: string | null
}

export async function GET(): Promise<Response> {
  const supabase = await createClient()

  // Type-cast `unknown` pour échapper aux types Database (table non encore
  // typée dans @kovas/database/types — cf. Phase B migrations annuaire).
  // biome-ignore lint/suspicious/noExplicitAny: shape table non typée Phase 1.
  const { data, error } = await (supabase as any)
    .from('diagnosticians')
    .select('slug, slug_city, slug_dept, updated_at')
    .eq('is_published', true)
    .eq('withdrawal_requested', false)
    .order('updated_at', { ascending: false })
    .limit(50000)

  // Table absente ou RLS bloqué → urlset vide accepté par les crawlers.
  const rows: DiagnosticianRow[] = error || !data ? [] : (data as DiagnosticianRow[])

  const urls = rows
    .filter(
      (r): r is { slug: string; slug_city: string; slug_dept: string; updated_at: string | null } =>
        r.slug !== null && r.slug_city !== null && r.slug_dept !== null,
    )
    .map((r) => {
      const loc = `${BASE_URL}/diagnostiqueurs/${r.slug_dept}/${r.slug_city}/${r.slug}`
      const lastmod =
        r.updated_at !== null ? new Date(r.updated_at).toISOString() : new Date().toISOString()
      return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        '    <changefreq>weekly</changefreq>',
        '    <priority>0.6</priority>',
        '  </url>',
      ].join('\n')
    })
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
