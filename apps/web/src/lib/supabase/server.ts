import type { Database } from '@kovas/database/types'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Client Supabase pour Server Components et Route Handlers.
 * cookies() est async dans Next.js 15.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Component contexts can't mutate cookies — silently ignored.
            // Le middleware refresh la session via updateSession() de toute façon.
          }
        },
      },
    },
  )
}
