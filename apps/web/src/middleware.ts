import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * REFONTE ACQUI-TARGET 2026-05 — routes définitivement retirées (post-pivot).
 *
 * Liste réduite après revue 2026-05-27 (Benjamin a clarifié la direction
 * hybride pragmatique) : on garde gain, annuaire, veille, progression,
 * parrainage qui sont activement utilisés. On retire vraiment les features
 * non-moat (coach IA, communauté, prescripteurs, gimmicks identité visuelle,
 * connecteurs doublons Indy/Tiime, calculatrice standalone).
 *
 * Redirection préventive (signets utilisateur, liens externes, crawlers).
 */
const REMOVED_ROUTES = [
  // Coach IA conversationnel (Phase 3 M19+, pas de moat vs ChatGPT)
  '/dashboard/coach',
  // Chat IA veille (V1.5 différé, page article reste accessible)
  '/dashboard/veille/chat',
  // Communauté B2B vertical solo (piège chronophage non-moat)
  '/dashboard/communaute',
  // Prescripteurs (pas dans roadmap V1)
  '/dashboard/prescripteurs',
  // Gimmicks identité visuelle (pas de différenciation business)
  '/dashboard/compte/carte-visite',
  '/dashboard/compte/branding',
  // Calculatrice standalone (présente dans flow mission)
  '/dashboard/outils/calculatrice-surface',
  // Connecteurs comptables doublons (Qonto + Pennylane = 2 PDP agréées DGFiP)
  '/dashboard/account/integrations/indy',
  '/dashboard/account/integrations/tiime',
  // Premature optimization pre-PMF
  '/admin/ab-testing',
  '/admin/(gated)/ab-testing',
  // Page publique remplacée par formulaire claim
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
  // Lot B63 — legacy /pros/aide vers le nouveau centre d'aide racine
  '/pros/aide': '/aide',
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
