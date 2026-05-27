/**
 * KOVAS — POST /api/ademe/sync-now
 *
 * Déclenche manuellement la sync ADEME (admin only). Délègue à
 * l'Edge Function Supabase `ademe-sync-daily`.
 *
 * Pour l'instant on relaye via fetch direct. La vérification admin
 * passe par `profiles.role = 'admin'` (RLS côté DB).
 */

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const { orgId, supabase, user } = await getCurrentUser()

  // Vérif admin via profil
  const { data: profileRow } = await supabase
    .from('profiles')
    // biome-ignore lint/suspicious/noExplicitAny: champ `role` ajouté en migration ultérieure
    .select('role' as any)
    .eq('id', user.id)
    .maybeSingle()

  const role = (profileRow as { role?: string } | null)?.role
  if (role !== 'admin' && role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  // Récupère le JWT user pour propager l'auth à l'Edge Function
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'no session' }, { status: 401 })

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/ademe-sync-daily`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ organization_id: orgId, source: 'manual_trigger' }),
    })
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json({ ok: res.ok, status: res.status, result: json })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Edge Function call failed',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 502 },
    )
  }
}
