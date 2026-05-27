import type { Database } from '@kovas/database/types'
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * Rafraîchit la session Supabase à chaque requête + protège les routes /dashboard/*
 * (et /app/* en rétrocompat avant redirect 301).
 * Appelé depuis src/middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    // Env vars missing — fail-closed : refuse l'accès route protégée
    return response
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // IMPORTANT : ne PAS écrire de logique entre createServerClient et getUser().
  // Cf. https://supabase.com/docs/guides/auth/server-side/nextjs
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Routes protégées : /dashboard/* est le nouveau préfixe, /app/* reste protégé
  // pour les requêtes qui n'auraient pas encore suivi le redirect 301.
  const isAppRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/app')
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup')

  if (isAppRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // pathname est garanti commencer par '/' (parsé par Next.js depuis request.nextUrl)
    // donc safe vs open-redirect. Defense-in-depth : on ne propage que si commence par '/' et pas par '//'.
    const safeNext =
      pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/dashboard/dashboard'
    url.searchParams.set('next', safeNext)
    return NextResponse.redirect(url)
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}
