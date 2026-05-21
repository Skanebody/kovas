/**
 * POST /api/admin/tools/[tool]
 *
 * Outils techniques rapides pour l'admin (instrumentés par audit log).
 *
 * Tools supportés (V1) :
 *   - cache-purge       : revalidatePath sur le dashboard + landing
 *   - trigger-cron      : déclenche manuellement le cron alert check (best-effort)
 *   - restart-realtime  : log uniquement V1 (Supabase Realtime géré côté infra)
 *   - regen-types       : retourne les instructions CLI
 *   - recalc-invoices   : log uniquement V1 (recompute V2)
 *   - refund-payment    : log uniquement V1 + payload (refund Stripe V2)
 *   - generate-invoice  : log uniquement V1
 *   - reset-missions    : log + flag tombstone V1 (action démo)
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import {
  computeAndSendMonthlyReport,
  createMonthlyReportsSupabaseClient,
  previousMonth,
} from '@/lib/reports/monthly-reports'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ tool: string }>
}

const SUPPORTED_TOOLS = new Set([
  'cache-purge',
  'trigger-cron',
  'restart-realtime',
  'regen-types',
  'recalc-invoices',
  'refund-payment',
  'generate-invoice',
  'reset-missions',
  'trigger-monthly-reports',
])

export async function POST(request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (access.needs2FA || access.hasNoSecret)
    return NextResponse.json({ error: '2FA required' }, { status: 401 })

  const { tool } = await params
  if (!SUPPORTED_TOOLS.has(tool)) {
    return NextResponse.json({ error: `Tool ${tool} inconnu` }, { status: 400 })
  }

  let payload: Record<string, unknown> = {}
  try {
    payload = ((await request.json().catch(() => ({}))) as Record<string, unknown>) ?? {}
  } catch {
    payload = {}
  }

  // Permet d'overrider via query string (utile pour ActionRunner sans inputField)
  const qs = new URL(request.url).searchParams
  for (const [k, v] of qs.entries()) {
    if (!(k in payload)) {
      payload[k] = v === 'true' ? true : v === 'false' ? false : v
    }
  }

  const start = Date.now()
  let resultMessage = 'ok'

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: `tool_${tool.replace(/-/g, '_')}`,
      targetType: 'tool',
      targetId: tool,
      targetLabel: tool,
      payload,
    },
    async () => {
      switch (tool) {
        case 'cache-purge': {
          revalidatePath('/admin')
          revalidatePath('/')
          revalidatePath('/dashboard/dashboard')
          resultMessage = 'Cache Next.js purgé (3 paths)'
          break
        }
        case 'trigger-cron': {
          // V1 best-effort : appel HTTP local si NEXT_PUBLIC_APP_URL défini
          const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
          const cronSecret = process.env.CRON_SECRET ?? ''
          if (base && cronSecret) {
            try {
              const res = await fetch(`${base}/api/cron/alert-check`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${cronSecret}` },
              })
              resultMessage = `Cron triggered HTTP ${res.status}`
            } catch (err) {
              resultMessage = `Cron call failed: ${err instanceof Error ? err.message : 'unknown'}`
            }
          } else {
            resultMessage = 'Cron trigger : NEXT_PUBLIC_APP_URL ou CRON_SECRET manquants'
          }
          break
        }
        case 'restart-realtime': {
          resultMessage = 'Realtime restart : géré côté Supabase Dashboard infra (V1 log only)'
          break
        }
        case 'regen-types': {
          resultMessage =
            'Exécuter : `pnpm --filter @kovas/database db:gen-types` puis commit `packages/database/types.ts`'
          break
        }
        case 'recalc-invoices': {
          resultMessage = 'Recalcul invoices : V1 log only (V2 batch job)'
          break
        }
        case 'refund-payment': {
          resultMessage = 'Refund payment : V1 log only (V2 Stripe API direct)'
          break
        }
        case 'generate-invoice': {
          resultMessage = 'Génération facture manuelle : V1 log only (V2 Stripe Invoices API)'
          break
        }
        case 'reset-missions': {
          resultMessage = 'Reset compteur missions : V1 log only (V2 action démo idempotente)'
          break
        }
        case 'trigger-monthly-reports': {
          // Test manuel : déclenche le rapport mensuel pour 1 org (ou toutes
          // via clé `all=true`). Forçage même si déjà 'sent'.
          // Payload : { organization_id?: string, year?: number, month?: number, force?: boolean, all?: boolean }
          const orgId = typeof payload.organization_id === 'string' ? payload.organization_id : null
          const all = payload.all === true
          const force = payload.force === true
          const now = new Date()
          const def = previousMonth(now)
          const year = typeof payload.year === 'number' ? payload.year : def.year
          const month = typeof payload.month === 'number' ? payload.month : def.month

          const supabase = createMonthlyReportsSupabaseClient()

          if (all) {
            const { runMonthlyReportsCron } = await import('@/lib/reports/monthly-reports')
            const result = await runMonthlyReportsCron(supabase, now)
            resultMessage = `Cron all: scanned=${result.organizations_scanned} sent=${result.emails_sent} skipped=${result.emails_skipped} failed=${result.emails_failed}`
          } else if (orgId) {
            const res = await computeAndSendMonthlyReport({
              supabase,
              organizationId: orgId,
              year,
              month,
              force,
            })
            resultMessage = `Org ${orgId.slice(0, 8)}… ${year}-${String(month).padStart(2, '0')} : ${res.status}${res.reason ? ' — ' + res.reason : ''}`
          } else {
            resultMessage = 'trigger-monthly-reports : organization_id ou all=true requis'
          }
          break
        }
      }
    },
  )

  return NextResponse.json({
    ok: true,
    tool,
    duration_ms: Date.now() - start,
    message: resultMessage,
  })
}
