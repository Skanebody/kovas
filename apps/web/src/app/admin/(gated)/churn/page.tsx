/**
 * /admin/churn — Cockpit risque de churn (Algo A1.3.11).
 *
 * Vue priorisée des abonnés à fort risque de churn. Combine 7 signaux :
 *   - Statut subscription (Stripe)
 *   - Cancellation initiée
 *   - Login recency
 *   - Activity trend (chute > 30j)
 *   - Cert urgency (A1.3.10)
 *   - Quota usage (sous-utilisation)
 *   - Trial end imminent
 *
 * Liste triée par churn_risk_score DESC, action recommandée explicite
 * (monitor / email_check / personal_call / winback_offer).
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §A1.3.11.
 */

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import {
  type ChurnAction,
  type ChurnBucket,
  type SubscriptionStatus,
  predictChurnRisk,
} from '@/lib/algos/churn-predictor'
import { predictExpiry } from '@/lib/algos/expiry-predictor'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Churn — Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface SubscriptionRow {
  id: string
  user_id: string | null
  organization_id: string | null
  status: string
  tier: string | null
  trial_ends_at: string | null
  cancel_at_period_end: boolean | null
  current_period_end: string | null
}

interface DiagnosticianLite {
  id: string
  full_name: string | null
  city: string | null
  department_code: string | null
  activity_score: number | null
  organization_id: string | null
}

interface VerifStateLite {
  diagnostician_id: string
  cofrac_valid_until: string | null
  rcpro_valid_until: string | null
}

interface CancellationLite {
  organization_id: string | null
  reactivated_at: string | null
}

interface ChurnRow {
  subscriptionId: string
  organizationId: string | null
  fullName: string
  city: string | null
  tier: string
  status: SubscriptionStatus
  trialEndsInDays: number | null
  cancellationInitiated: boolean
  activityScore: number | null
  churnScore: number
  bucket: ChurnBucket
  recommendedAction: ChurnAction
  humanMessage: string
  topSignal: string | null
}

function safeStatus(s: string): SubscriptionStatus {
  switch (s) {
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'paused':
    case 'canceled':
    case 'unpaid':
      return s
    default:
      return 'active' // fallback safe
  }
}

function daysBetween(target: string | null, now: Date): number | null {
  if (!target) return null
  const t = new Date(target)
  if (Number.isNaN(t.getTime())) return null
  const MS = 24 * 60 * 60 * 1000
  return Math.round((t.getTime() - now.getTime()) / MS)
}

async function loadChurnRows(): Promise<ChurnRow[]> {
  const supabase = createAdminClient()

  // 1. Pull subscriptions actives + en trial + past_due (les "encore récupérables")
  // biome-ignore lint/suspicious/noExplicitAny: subscriptions partiellement dans Database.types
  const { data: subsRaw, error: subsErr } = await (supabase as any)
    .from('subscriptions')
    .select(
      'id, user_id, organization_id, status, tier, trial_ends_at, cancel_at_period_end, current_period_end',
    )
    .in('status', ['trialing', 'active', 'past_due', 'paused', 'unpaid'])
    .limit(500)

  if (subsErr || !subsRaw) {
    console.error('loadChurnRows subs:', subsErr?.message)
    return []
  }

  const subs = subsRaw as SubscriptionRow[]
  if (subs.length === 0) return []

  const orgIds = subs.map((s) => s.organization_id).filter((v): v is string => Boolean(v))

  // 2. Pull diagnosticians (identité + activity_score) pour les orgs concernées
  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { data: diagsRaw } = await (supabase as any)
    .from('diagnosticians')
    .select('id, full_name, city, department_code, activity_score, organization_id')
    .in('organization_id', orgIds)

  const diagsByOrg = new Map<string, DiagnosticianLite>()
  for (const d of (diagsRaw ?? []) as DiagnosticianLite[]) {
    if (d.organization_id && !diagsByOrg.has(d.organization_id)) {
      diagsByOrg.set(d.organization_id, d)
    }
  }

  // 3. Pull verification states pour les diag concernés
  const diagIds = Array.from(diagsByOrg.values()).map((d) => d.id)
  let verifByDiag = new Map<string, VerifStateLite>()
  if (diagIds.length > 0) {
    // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
    const { data: verifsRaw } = await (supabase as any)
      .from('diagnostician_verification_status')
      .select('diagnostician_id, cofrac_valid_until, rcpro_valid_until')
      .in('diagnostician_id', diagIds)
    verifByDiag = new Map(
      ((verifsRaw ?? []) as VerifStateLite[]).map((v) => [v.diagnostician_id, v]),
    )
  }

  // 4. Pull cancellations en cours (no reactivated_at) pour ces orgs
  const cancelByOrg = new Map<string, boolean>()
  if (orgIds.length > 0) {
    // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
    const { data: cancelsRaw } = await (supabase as any)
      .from('cancellations')
      .select('organization_id, reactivated_at')
      .in('organization_id', orgIds)
      .is('reactivated_at', null)
    for (const c of (cancelsRaw ?? []) as CancellationLite[]) {
      if (c.organization_id) cancelByOrg.set(c.organization_id, true)
    }
  }

  const now = new Date()

  const rows: ChurnRow[] = subs.map((s) => {
    const diag = s.organization_id ? diagsByOrg.get(s.organization_id) : undefined
    const verif = diag ? verifByDiag.get(diag.id) : undefined
    const expiryPrediction = predictExpiry({
      cofrac_valid_until: verif?.cofrac_valid_until ?? null,
      rcpro_valid_until: verif?.rcpro_valid_until ?? null,
      reference_date: now,
    })
    const trialDays = daysBetween(s.trial_ends_at, now)
    const cancelInitiated =
      Boolean(s.organization_id && cancelByOrg.get(s.organization_id)) ||
      Boolean(s.cancel_at_period_end)

    const prediction = predictChurnRisk({
      subscription_status: safeStatus(s.status),
      days_since_last_login: null, // V1 : pas de colonne dédiée — best-effort
      activity_score: diag?.activity_score ?? null,
      activity_score_30d_ago: null, // V1 : pas d'historique encore
      worst_cert_urgency: expiryPrediction.worst_urgency,
      quota_usage_pct: null, // V1 : pas joint pour rester < 4 SELECT
      cancellation_initiated: cancelInitiated,
      trial_ends_in_days: s.status === 'trialing' ? trialDays : null,
      support_tickets_open: 0, // V1 : pas joint
    })

    const top =
      [...prediction.signals].sort((a, b) => b.points - a.points).find((sig) => sig.points > 0)
        ?.label ?? null

    return {
      subscriptionId: s.id,
      organizationId: s.organization_id,
      fullName: diag?.full_name ?? '(organisation sans diagnostiqueur lié)',
      city: diag?.city ?? null,
      tier: s.tier ?? '—',
      status: safeStatus(s.status),
      trialEndsInDays: trialDays,
      cancellationInitiated: cancelInitiated,
      activityScore: diag?.activity_score ?? null,
      churnScore: prediction.churn_risk_score,
      bucket: prediction.bucket,
      recommendedAction: prediction.recommended_action,
      humanMessage: prediction.human_message,
      topSignal: top,
    }
  })

  // Filter : ne montrer que mid/high/critical (low = pas d'action utile)
  return rows.filter((r) => r.bucket !== 'low').sort((a, b) => b.churnScore - a.churnScore)
}

const BUCKET_VARIANT: Record<ChurnBucket, 'red' | 'orange' | 'yellow' | 'muted'> = {
  critical: 'red',
  high: 'orange',
  mid: 'yellow',
  low: 'muted',
}

const ACTION_LABEL: Record<ChurnAction, string> = {
  winback_offer: 'Offre winback',
  personal_call: 'Appel direct',
  email_check: 'Email check-in',
  monitor: 'Surveiller',
  none: '—',
}

const ACTION_VARIANT: Record<ChurnAction, 'red' | 'orange' | 'yellow' | 'muted' | 'blue'> = {
  winback_offer: 'red',
  personal_call: 'orange',
  email_check: 'yellow',
  monitor: 'blue',
  none: 'muted',
}

export default async function AdminChurnPage() {
  const rows = await loadChurnRows()

  const counts = {
    critical: rows.filter((r) => r.bucket === 'critical').length,
    high: rows.filter((r) => r.bucket === 'high').length,
    mid: rows.filter((r) => r.bucket === 'mid').length,
  }

  return (
    <div className="space-y-6 animate-fade-in motion-reduce:animate-none">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          Admin · Rétention
        </p>
        <h1 className="font-sans font-light text-3xl tracking-tight text-ink">
          Cockpit <span className="font-serif italic font-normal">churn</span>
          <span className="text-ink-mute">.</span>
        </h1>
        <p className="text-sm text-ink-mute max-w-2xl">
          Abonnés à risque de churn classés par score A1.3.11. V1 — quota usage, historique
          d&apos;activité 30j et tickets support pas encore joints (best-effort).
        </p>
      </header>

      {/* KPIs urgence */}
      <div className="grid grid-cols-3 gap-3">
        <BucketCard label="Critique (≥ 70)" value={counts.critical} variant="red" />
        <BucketCard label="Élevé (50-69)" value={counts.high} variant="orange" />
        <BucketCard label="Modéré (25-49)" value={counts.mid} variant="yellow" />
      </div>

      {/* Liste */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">
          {rows.length} abonné{rows.length > 1 ? 's' : ''} à suivre
        </h2>
        {rows.length === 0 ? (
          <Card variant="opaque" padding="default">
            <p className="text-sm text-ink-mute">
              Aucun abonné en risque de churn modéré ou plus. La rétention est saine.
            </p>
          </Card>
        ) : (
          <div className="glass-opaque rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-cream-deep border-b border-rule">
                  <tr>
                    <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                      Score
                    </th>
                    <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                      Bucket
                    </th>
                    <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                      Diagnostiqueur
                    </th>
                    <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                      Tier
                    </th>
                    <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                      Statut
                    </th>
                    <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                      Signal top
                    </th>
                    <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.subscriptionId}
                      className="border-b border-rule/60 hover:bg-paper transition-colors"
                    >
                      <td className="px-3 py-2 font-mono text-[13px] text-ink font-semibold">
                        {r.churnScore}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={BUCKET_VARIANT[r.bucket]}>{r.bucket}</Badge>
                      </td>
                      <td className="px-3 py-2 text-ink truncate max-w-[240px]">
                        {r.fullName}
                        {r.city ? (
                          <span className="text-ink-mute ml-1 text-[11px]">— {r.city}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-ink-mute font-mono text-[11px]">{r.tier}</td>
                      <td className="px-3 py-2">
                        <Badge variant="muted">{r.status}</Badge>
                        {r.cancellationInitiated ? (
                          <Badge variant="red" className="ml-1">
                            cancel-flow
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-ink-mute text-[12px] truncate max-w-[200px]">
                        {r.topSignal ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={ACTION_VARIANT[r.recommendedAction]}>
                          {ACTION_LABEL[r.recommendedAction]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function BucketCard({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant: 'red' | 'orange' | 'yellow'
}) {
  const color =
    variant === 'red'
      ? 'text-[#7C1D1D]'
      : variant === 'orange'
        ? 'text-[#7C3F0A]'
        : 'text-[#7C5A0A]'
  return (
    <Card variant="opaque" padding="default">
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">{label}</p>
      <p className={`mt-2 font-serif italic font-normal leading-none text-4xl ${color}`}>{value}</p>
    </Card>
  )
}
