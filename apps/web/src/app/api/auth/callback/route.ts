import { enforceRateLimit } from '@/lib/rate-limit-middleware'
import { createClient } from '@/lib/supabase/server'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * Callback OAuth + magic link Supabase.
 * Cf. https://supabase.com/docs/guides/auth/server-side/nextjs
 */

/**
 * Valide qu'un chemin de redirection post-login est interne et sûr.
 *
 * Reject : URLs absolues (http://, https://, javascript:, data:, etc.),
 * protocol-relative (//evil.com), chemins ne commençant pas par `/`.
 * Accept : chemins relatifs internes (`/dashboard/...`).
 *
 * Anti open-redirect (sécurité critique post-OAuth/magic link).
 */
function isValidNextPath(path: string | null): boolean {
  if (!path) return false
  // Must start with / but not // (anti protocol-relative)
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  // Reject absolute URLs (any case, any scheme : http:, https:, javascript:, data:, vbscript:, file:…)
  if (/^\s*[a-z]+:/i.test(path)) return false
  // Reject backslash-prefixed paths (\evil.com → certains parsers traitent comme //)
  if (path.startsWith('/\\') || path.startsWith('\\')) return false
  return true
}

export async function GET(request: NextRequest) {
  // Rate-limit IP (anti credential-stuffing via OAuth callback brute force)
  const limited = await enforceRateLimit(request, 'auth')
  if (limited) return limited

  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next')
  // isValidNextPath garantit rawNext !== null quand il retourne true, mais
  // TS ne peut pas narrow ici (utilise un type guard explicite).
  const next: string = isValidNextPath(rawNext) && rawNext ? rawNext : '/dashboard/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
