/**
 * Endpoint interne pour envoi d'un email RGPD préalable.
 * Appelé exclusivement par la cron Supabase Edge Function `diagnostician-rgpd-cron`.
 *
 * Auth : Bearer ${INTERNAL_RGPD_SECRET} (fallback CRON_SECRET).
 * Body : { diag_id: string, step: 1 | 2 | 3 }
 *
 * Note : route séparée du cron Edge car Next.js a accès au système de fichiers
 * (templates HTML dans /src/emails/) là où l'Edge Function n'a pas cet accès.
 */

import {
  sendPreNotificationEmail1,
  sendPreNotificationEmail2,
  sendPreNotificationEmail3,
} from '@/lib/emails/diagnostician-rgpd-sender'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // Auth
  const secret = process.env.INTERNAL_RGPD_SECRET ?? process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { diag_id?: unknown; step?: unknown }
  try {
    body = (await req.json()) as { diag_id?: unknown; step?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body.diag_id !== 'string') {
    return NextResponse.json({ error: 'diag_id (string) required' }, { status: 400 })
  }
  if (body.step !== 1 && body.step !== 2 && body.step !== 3) {
    return NextResponse.json({ error: 'step must be 1, 2, or 3' }, { status: 400 })
  }

  try {
    switch (body.step) {
      case 1:
        await sendPreNotificationEmail1(body.diag_id)
        break
      case 2:
        await sendPreNotificationEmail2(body.diag_id)
        break
      case 3:
        await sendPreNotificationEmail3(body.diag_id)
        break
    }
    return NextResponse.json({ ok: true, diag_id: body.diag_id, step: body.step })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[rgpd-send] Failed diag=${body.diag_id} step=${body.step}: ${message}`)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
