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

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  )

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
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}
