/**
 * KOVAS — Alertes Cockpit ADEME
 *
 *   GET  /api/ademe/alerts          — alertes actives (resolved_at IS NULL)
 *   PATCH /api/ademe/alerts         — body { id, action: 'acknowledge' | 'resolve' }
 */

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface AdemeAlertRow {
  id: string
  organization_id: string
  alert_type: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  title: string
  description: string
  recommendation: string | null
  context: Record<string, unknown> | null
  triggered_at: string
  acknowledged_at: string | null
  resolved_at: string | null
}

export async function GET() {
  const { orgId, supabase } = await getCurrentUser()

  const { data, error } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore régénérés
    .from('ademe_alerts' as any)
    .select('*')
    .eq('organization_id', orgId)
    .is('resolved_at', null)
    .order('triggered_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load alerts', detail: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ alerts: (data ?? []) as unknown as AdemeAlertRow[] })
}

export async function PATCH(request: Request) {
  const { orgId, supabase } = await getCurrentUser()
  const body = (await request.json().catch(() => null)) as
    | { id?: string; action?: 'acknowledge' | 'resolve' }
    | null

  if (!body?.id || !body.action) {
    return NextResponse.json({ error: 'Missing id or action' }, { status: 400 })
  }

  const patch =
    body.action === 'acknowledge'
      ? { acknowledged_at: new Date().toISOString() }
      : { resolved_at: new Date().toISOString() }

  const { error } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore régénérés
    .from('ademe_alerts' as any)
    .update(patch)
    .eq('id', body.id)
    .eq('organization_id', orgId)

  if (error) {
    return NextResponse.json(
      { error: 'Failed to update alert', detail: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, action: body.action })
}
