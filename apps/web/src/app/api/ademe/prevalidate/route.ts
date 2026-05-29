import { hasPrevalidationDetailAccess } from '@/lib/ademe/prevalidation-access'
import { calculateAdemeRisk } from '@/lib/ademe/risk-calculator'
import type { PrevalidationInput, RiskWarning } from '@/lib/ademe/risk-calculator'
import { createSupabaseRiskLoader } from '@/lib/ademe/risk-loader'
import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * POST /api/ademe/prevalidate
 *
 * Maillon manquant entre le formulaire de pré-validation (client) et le moteur
 * de risque (`risk-calculator.ts`). Auth → calcule le risque → persiste dans
 * `ademe_prevalidations` (rattaché au DOSSIER via `dossier_id`) → renvoie le
 * verdict.
 *
 * Freemium (décision Benjamin) : le verdict global est gratuit, le DÉTAIL des
 * corrections est réservé aux abonnés Pack Conformité (cf.
 * `hasPrevalidationDetailAccess`). La DB conserve toujours le détail complet
 * (audit + déblocage rétroactif) ; seul le payload renvoyé au client est filtré.
 */

interface PrevalidatePayload {
  type_batiment?: unknown
  annee_construction?: unknown
  surface_habitable_m2?: unknown
  type_energie_chauffage?: unknown
  type_climatisation?: unknown
  etiquette_dpe?: unknown
  etiquette_ges?: unknown
  conso_5_usages_par_m2_ep?: unknown
  latitude?: unknown
  longitude?: unknown
  source_dossier_id?: unknown
}

const BUILDING_TYPES = ['maison', 'appartement', 'immeuble'] as const
const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

export async function POST(request: Request) {
  let orgId: string
  let userId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
    userId = u.user.id
    supabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let raw: PrevalidatePayload
  try {
    raw = (await request.json()) as PrevalidatePayload
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // ── Validation minimale ──────────────────────────────────────────
  const type_batiment = raw.type_batiment as PrevalidationInput['type_batiment']
  if (!BUILDING_TYPES.includes(type_batiment)) {
    return NextResponse.json({ error: 'type_batiment_invalid' }, { status: 400 })
  }
  const etiquette_dpe = raw.etiquette_dpe as PrevalidationInput['etiquette_dpe']
  const etiquette_ges = raw.etiquette_ges as PrevalidationInput['etiquette_ges']
  if (!LABELS.includes(etiquette_dpe) || !LABELS.includes(etiquette_ges)) {
    return NextResponse.json({ error: 'etiquette_invalid' }, { status: 400 })
  }

  const input: PrevalidationInput = {
    type_batiment,
    annee_construction: asNumber(raw.annee_construction) ?? 0,
    surface_habitable_m2: asNumber(raw.surface_habitable_m2) ?? 0,
    type_energie_chauffage:
      typeof raw.type_energie_chauffage === 'string' ? raw.type_energie_chauffage : 'gaz',
    type_climatisation:
      typeof raw.type_climatisation === 'string' ? raw.type_climatisation : 'aucune',
    etiquette_dpe,
    etiquette_ges,
    conso_5_usages_par_m2_ep: asNumber(raw.conso_5_usages_par_m2_ep) ?? 0,
    latitude: asNumber(raw.latitude),
    longitude: asNumber(raw.longitude),
  }

  const dossierId = typeof raw.source_dossier_id === 'string' ? raw.source_dossier_id : null

  // ── Calcul du risque ─────────────────────────────────────────────
  const loader = createSupabaseRiskLoader(supabase, orgId)
  const assessment = await calculateAdemeRisk(orgId, userId, input, loader)

  // ── Persistance (toujours le détail complet, audit) ──────────────
  const coherenceWarnings = assessment.warnings.filter((w) => w.axis === 'coherence')
  const rulesFailed = coherenceWarnings.filter(
    (w) => w.severity === 'error' || w.severity === 'blocking',
  ).length
  const rulesWarning = coherenceWarnings.filter((w) => w.severity === 'warning').length
  const rulesChecked = assessment.axis_details.coherence.rules_checked
  const status =
    assessment.verdict === 'red' ? 'failed' : assessment.verdict === 'yellow' ? 'warning' : 'passed'

  let prevalidationId: string | null = null
  const { data: inserted } = await supabase
    .from('ademe_prevalidations')
    .insert({
      organization_id: orgId,
      dossier_id: dossierId,
      user_id: userId,
      status,
      triggered_by: 'manual',
      total_rules_checked: rulesChecked,
      rules_passed: Math.max(0, rulesChecked - coherenceWarnings.length),
      rules_failed: rulesFailed,
      rules_warning: rulesWarning,
      quality_score: Number(((100 - assessment.global_score) / 100).toFixed(3)),
      findings: assessment.warnings as unknown as never,
      snapshot_payload: input as unknown as never,
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle()
  if (inserted) prevalidationId = (inserted as { id: string }).id

  // ── Freemium : filtrer le détail si pas d'accès ──────────────────
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier, plan_code, status')
    .eq('organization_id', orgId)
    .maybeSingle()
  const planCode =
    (sub as { plan_code?: string | null; tier?: string | null } | null)?.plan_code ??
    (sub as { tier?: string | null } | null)?.tier ??
    null
  const hasDetail = await hasPrevalidationDetailAccess(supabase, orgId, planCode)

  const publicWarnings: Array<{
    axis: string
    severity: RiskWarning['severity']
    code: string
    message: string
    suggested_fix?: string
  }> = hasDetail
    ? assessment.warnings.map((w) => ({
        axis: w.axis,
        severity: w.severity,
        code: w.code,
        message: w.message,
        ...(w.suggested_fix ? { suggested_fix: w.suggested_fix } : {}),
      }))
    : []

  return NextResponse.json({
    prevalidationId,
    verdict: assessment.verdict,
    globalScore: assessment.global_score,
    axisScores: assessment.axis_scores,
    warnings: publicWarnings,
    detailLocked: !hasDetail,
    issuesCount: assessment.warnings.length,
  })
}
