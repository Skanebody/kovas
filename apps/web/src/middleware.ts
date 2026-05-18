import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image, favicon, sw.js, manifest.json
     * - Image extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
