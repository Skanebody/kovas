/**
 * POST /api/admin/2fa/refresh
 *
 * Repousse la fenêtre glissante de validation 2FA (sliding window 72 h).
 *
 * À chaque navigation admin, le composant client TwoFaSlidingRefresh appelle
 * cet endpoint en best-effort. Si le cookie 2FA courant est valide pour l'user
 * authentifié, on le ré-émet avec un timestamp FRAIS → la fenêtre de 72 h
 * repart à zéro. Tant que l'admin reste actif, il n'est jamais re-challengé.
 * Après 72 h SANS aucune navigation (donc sans refresh), le cookie expire et
 * la garde (layout) renvoie vers /admin/verify-2fa.
 *
 * No-op défensif : si le cookie est absent/invalide, ou si l'user n'est pas
 * authentifié, on renvoie { ok: true, refreshed: false } sans jamais bloquer
 * ni throw. La (re)vérification 2FA reste gérée par la garde du layout.
 *
 * Runtime nodejs (node:crypto via signTwoFaCookie/verifyTwoFaCookie) — JAMAIS
 * d'Edge ici.
 */

import {
  TWO_FA_COOKIE_NAME,
  TWO_FA_COOKIE_TTL_MS,
  signTwoFaCookie,
  verifyTwoFaCookie,
} from '@/lib/admin/2fa-cookie'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST() {
  // 1. User courant (sans redirect : on lit la session directement). Pas
  //    d'user → no-op, jamais d'erreur bloquante.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: true, refreshed: false })
  }

  // 2. Lit le cookie 2FA courant.
  const cookieStore = await cookies()
  const currentCookie = cookieStore.get(TWO_FA_COOKIE_NAME)?.value

  // 3. Cookie absent/invalide/expiré → no-op (la garde du layout fera le reste).
  if (!verifyTwoFaCookie(currentCookie, user.id)) {
    return NextResponse.json({ ok: true, refreshed: false })
  }

  // 4. Cookie valide → ré-émission avec timestamp frais (sliding window).
  cookieStore.set(TWO_FA_COOKIE_NAME, signTwoFaCookie(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: Math.floor(TWO_FA_COOKIE_TTL_MS / 1000),
  })

  return NextResponse.json({ ok: true, refreshed: true })
}
