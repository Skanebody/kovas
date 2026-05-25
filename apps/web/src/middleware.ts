import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (isRemovedRoute(pathname)) {
    const target = pathname.startsWith('/dashboard') || pathname.startsWith('/admin') ? '/dashboard' : '/'
    return NextResponse.redirect(new URL(target, request.url))
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
