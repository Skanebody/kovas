import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * REFONTE ACQUI-TARGET 2026-05 — routes Bucket C supprimées.
 * Cf. docs/refonte-2026-05/REFONTE-ACQUI-TARGET-V2.md
 *
 * Redirection préventive (signets utilisateur, liens externes, crawlers).
 */
const REMOVED_ROUTES = [
  // Coach / Veille IA produit (ChatGPT free alternative)
  '/dashboard/coach',
  '/dashboard/veille/articles',
  '/dashboard/veille/chat',
  // Communauté B2B vertical solo (piège chronophage)
  '/dashboard/communaute',
  // Gamification fluff
  '/dashboard/gain',
  '/dashboard/account/progression',
  '/dashboard/account/parrainage/badges',
  // Annuaire/Prescripteurs (pas de moat Liciel)
  '/dashboard/annuaire',
  '/dashboard/prescripteurs',
  // Gimmicks
  '/dashboard/compte/carte-visite',
  '/dashboard/compte/branding',
  '/dashboard/outils/calculatrice-surface',
  // Connecteurs doublons (Qonto + Pennylane suffisent)
  '/dashboard/account/integrations/indy',
  '/dashboard/account/integrations/tiime',
  // Premature optimization pre-PMF
  '/admin/ab-testing',
  '/admin/(gated)/ab-testing',
  // Public misc
  '/signaler-un-diagnostiqueur',
] as const

function isRemovedRoute(pathname: string): boolean {
  return REMOVED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
}

/**
 * Restructure /pros/* → /* (post-pivot SaaS-only, Lot B33).
 * Redirect 301 permanent pour préserver SEO + signets utilisateurs.
 *
 * **CRITIQUE** : les CLÉS sont les ANCIENS chemins `/pros/*`, les VALUES
 * sont les NOUVEAUX chemins racine. Mapper `/tarifs → /tarifs` causerait
 * une boucle infinie ERR_TOO_MANY_REDIRECTS (fix B62 du 2026-05-26).
 *
 * Note : `/pros/api` redirige vers `/api-publique` car `/api/*` est réservé
 * par Next.js pour les route handlers.
 */
const PROS_REDIRECTS: Record<string, string> = {
  '/pros': '/',
  '/pros/fonctionnalites': '/fonctionnalites',
  '/pros/tarifs': '/tarifs',
  '/pros/temoignages': '/temoignages',
  '/pros/demo': '/demo',
  '/pros/blog': '/blog',
  '/pros/comparatif': '/comparatif',
  '/pros/api': '/api-publique',
  '/pros/api-publique': '/api-publique',
}

function matchProsRedirect(pathname: string): string | null {
  if (pathname in PROS_REDIRECTS) return PROS_REDIRECTS[pathname] ?? null
  for (const [from, to] of Object.entries(PROS_REDIRECTS)) {
    if (from === '/pros') continue // évite prefix match qui capturerait toutes les sous-routes
    if (pathname.startsWith(`${from}/`)) {
      return `${to}${pathname.slice(from.length)}`
    }
  }
  return null
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Bucket C routes supprimées
  if (isRemovedRoute(pathname)) {
    const target =
      pathname.startsWith('/dashboard') || pathname.startsWith('/admin') ? '/dashboard' : '/'
    return NextResponse.redirect(new URL(target, request.url))
  }

  // 2. Restructure /pros/* → /* (301 permanent)
  const prosTarget = matchProsRedirect(pathname)
  if (prosTarget) {
    return NextResponse.redirect(new URL(prosTarget, request.url), 301)
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image, favicon, sw.js, manifest.json
     * - Image extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icons|upload|api/upload-owner-document|api/ban|api/calendar|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
