/**
 * KOVAS — Endpoint interne appelé par l'Edge Function `ghost-lifecycle-cron`.
 *
 * POST /api/internal/ghost-notify
 * Headers : Authorization: Bearer <INTERNAL_CRON_SECRET | CRON_SECRET>
 * Body    : { diagnosticianId: string, status: 'warned' | 'demoted' | 'soft_disabled' }
 *
 * Charge le template HTML approprié + envoie via Resend.
 * L'edge function n'a pas accès au fs Next.js → on délègue ici.
 */

import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  renderGhostDemotedEmail,
  renderGhostSoftDisabledEmail,
  renderGhostWarnedEmail,
} from '@/emails/quote-request/ghost-lifecycle'
import { sendEmail } from '@/lib/email/send'

export const runtime = 'nodejs'
export const maxDuration = 15

const bodySchema = z.object({
  diagnosticianId: z.string().uuid(),
  status: z.enum(['warned', 'demoted', 'soft_disabled']),
})

interface DiagRow {
  id: string
  display_name: string
  city: string | null
  official_email: string | null
  consecutive_ignored_leads: number | null
}

export async function POST(request: Request): Promise<Response> {
  // Auth interne
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const internalSecret = process.env.INTERNAL_CRON_SECRET ?? cronSecret
  if (!internalSecret) {
    return NextResponse.json(
      { error: 'INTERNAL_CRON_SECRET not configured' },
      { status: 500 },
    )
  }
  if (authHeader !== `Bearer ${internalSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { diagnosticianId, status } = parsed.data

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // biome-ignore lint/suspicious/noExplicitAny: A1 table
  const { data: row, error } = await (admin as any)
    .from('diagnosticians')
    .select('id, display_name, city, official_email, consecutive_ignored_leads')
    .eq('id', diagnosticianId)
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json({ error: 'Diagnostician not found' }, { status: 404 })
  }
  const diag = row as DiagRow
  if (!diag.official_email) {
    return NextResponse.json(
      { error: 'No email available for diagnostician' },
      { status: 422 },
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'
  const reactivationUrl = `${baseUrl}/dashboard/compte/disponibilites`

  const windowDays = status === 'warned' ? 30 : status === 'demoted' ? 60 : 90

  const ignoredCount = Math.max(diag.consecutive_ignored_leads ?? 0, 1)

  const params = {
    display_name: diag.display_name,
    city: diag.city,
    ignored_count: ignoredCount,
    window_days: windowDays,
    base_url: baseUrl,
    reactivation_url: reactivationUrl,
  }

  const rendered =
    status === 'warned'
      ? renderGhostWarnedEmail(params)
      : status === 'demoted'
        ? renderGhostDemotedEmail(params)
        : renderGhostSoftDisabledEmail(params)

  const result = await sendEmail({
    to: diag.official_email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    category: 'alert',
    tags: [
      { name: 'kovas_flow', value: 'ghost_lifecycle' },
      { name: 'ghost_status', value: status },
    ],
  })

  if (!result.success) {
    return NextResponse.json(
      { error: 'Email send failed', details: result.error },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, status, diagnosticianId, stub: result.stub })
}
