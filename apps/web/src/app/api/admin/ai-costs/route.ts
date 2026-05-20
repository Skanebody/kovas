/**
 * GET /api/admin/ai-costs
 *
 * Vue agrégée des coûts IA (Anthropic + OpenAI + Deepgram) — combine les helpers
 * existants `ia-analytics.ts` pour exposer une API REST consommable côté UI
 * (utility pages, dashboards externes, exports).
 *
 * Sortie : breakdown par modèle (mois courant) + top consumers + total mois.
 * Gate verifyAdminAccess() puis service-role admin client.
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { getIAUsageMonth, getModelBreakdown, getTopConsumers } from '@/lib/admin/ia-analytics'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

export interface CostsBreakdownResponse {
  month: {
    costEur: number
    callsCount: number
    byOperation: Record<string, { cost: number; calls: number }>
  }
  byModel: Array<{
    model: string
    costEur: number
    callsCount: number
    percentOfTotal: number
  }>
  topConsumers: Array<{
    orgId: string
    orgName: string
    costEur: number
    callsCount: number
    percentOfTotal: number
  }>
  generatedAt: string
}

export async function GET() {
  const access = await verifyAdminAccess()
  if (!access.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const [month, byModel, topConsumers] = await Promise.all([
    getIAUsageMonth(supabase),
    getModelBreakdown(supabase),
    getTopConsumers(supabase, 10),
  ])

  const response: CostsBreakdownResponse = {
    month,
    byModel,
    topConsumers,
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } })
}
