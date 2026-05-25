/**
 * /admin/renewals — Cockpit renouvellements certifications (Algo A1.3.10).
 *
 * Vue priorisée des diagnostiqueurs dont la COFRAC ou la RC Pro expire dans
 * les 90 jours, ordonnés par urgence (expired → critical → urgent → attention).
 *
 * Aide Benjamin à anticiper les contacts proactifs (séquence J-60/J-30/J-7).
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §A1.3.10 + verification_continuous_crons
 * (Edge Function rcpro_expiry_* déjà existante, on consolide en cockpit).
 */

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { predictExpiry } from '@/lib/algos/expiry-predictor'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Renouvellements — Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface VerificationStateRow {
  diagnostician_id: string
  cofrac_status: string | null
  cofrac_valid_until: string | null
  rcpro_status: string | null
  rcpro_valid_until: string | null
}

interface DiagnosticianRow {
  id: string
  full_name: string | null
  city: string | null
  department_code: string | null
  validation_status: string | null
}

interface RenewalRow {
  diagnosticianId: string
  fullName: string
  city: string | null
  departmentCode: string | null
  validationStatus: string | null
  cofracValidUntil: string | null
  cofracDays: number | null
  cofracUrgency: string
  rcproValidUntil: string | null
  rcproDays: number | null
  rcproUrgency: string
  worstUrgency: string
  recommendedAction: string
  humanMessage: string
  worstSortKey: number
}

const URGENCY_SORT: Record<string, number> = {
  expired: 0,
  critical: 1,
  urgent: 2,
  attention: 3,
  safe: 4,
}

const URGENCY_BADGE: Record<string, 'red' | 'orange' | 'yellow' | 'blue' | 'muted'> = {
  expired: 'red',
  critical: 'red',
  urgent: 'orange',
  attention: 'yellow',
  safe: 'muted',
}

const URGENCY_LABEL: Record<string, string> = {
  expired: 'Expiré',
  critical: 'Critique',
  urgent: 'Urgent',
  attention: 'Attention',
  safe: 'À jour',
}

async function loadRenewals(): Promise<RenewalRow[]> {
  const supabase = createAdminClient()

  // 1. Pull verification states ayant au moins une date d'expiration dans 90j ou expirée
  const ninetyDaysFromNow = new Date()
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90)
  const cutoff = ninetyDaysFromNow.toISOString().slice(0, 10)

  // biome-ignore lint/suspicious/noExplicitAny: table pas dans Database.types
  const { data: states, error: statesErr } = await (supabase as any)
    .from('diagnostician_verification_status')
    .select('diagnostician_id, cofrac_status, cofrac_valid_until, rcpro_status, rcpro_valid_until')
    .or(`cofrac_valid_until.lte.${cutoff},rcpro_valid_until.lte.${cutoff}`)
    .limit(500)

  if (statesErr) {
    console.error('loadRenewals states error:', statesErr.message)
    return []
  }

  const stateRows = (states ?? []) as VerificationStateRow[]
  if (stateRows.length === 0) return []

  // 2. Pull diagnostician identité pour les IDs concernés
  const diagIds = stateRows.map((s) => s.diagnostician_id)
  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { data: diags } = await (supabase as any)
    .from('diagnosticians')
    .select('id, full_name, city, department_code, validation_status')
    .in('id', diagIds)

  const diagsById = new Map<string, DiagnosticianRow>(
    ((diags ?? []) as DiagnosticianRow[]).map((d) => [d.id, d]),
  )

  const now = new Date()
  return stateRows
    .map<RenewalRow>((s) => {
      const diag = diagsById.get(s.diagnostician_id)
      const prediction = predictExpiry({
        cofrac_valid_until: s.cofrac_valid_until,
        rcpro_valid_until: s.rcpro_valid_until,
        reference_date: now,
      })
      const worstSortKey = URGENCY_SORT[prediction.worst_urgency] ?? 9
      return {
        diagnosticianId: s.diagnostician_id,
        fullName: diag?.full_name ?? '(sans nom)',
        city: diag?.city ?? null,
        departmentCode: diag?.department_code ?? null,
        validationStatus: diag?.validation_status ?? null,
        cofracValidUntil: prediction.cofrac.expires_on,
        cofracDays: prediction.cofrac.days_until_expiry,
        cofracUrgency: prediction.cofrac.urgency,
        rcproValidUntil: prediction.rcpro.expires_on,
        rcproDays: prediction.rcpro.days_until_expiry,
        rcproUrgency: prediction.rcpro.urgency,
        worstUrgency: prediction.worst_urgency,
        recommendedAction: prediction.recommended_action,
        humanMessage: prediction.human_message,
        worstSortKey,
      }
    })
    .filter((r) => r.worstSortKey < URGENCY_SORT.safe) // n'affiche que les non-safe
    .sort(
      (a, b) => a.worstSortKey - b.worstSortKey || (a.cofracDays ?? 999) - (b.cofracDays ?? 999),
    )
}

function formatDateFr(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function daysLabel(d: number | null): string {
  if (d == null) return '—'
  if (d < 0) return `J+${Math.abs(d)} (expiré)`
  return `J-${d}`
}

export default async function AdminRenewalsPage() {
  const rows = await loadRenewals()

  const counts = {
    expired: rows.filter((r) => r.worstUrgency === 'expired').length,
    critical: rows.filter((r) => r.worstUrgency === 'critical').length,
    urgent: rows.filter((r) => r.worstUrgency === 'urgent').length,
    attention: rows.filter((r) => r.worstUrgency === 'attention').length,
  }

  return (
    <div className="space-y-6 animate-fade-in motion-reduce:animate-none">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          Admin · Renouvellements
        </p>
        <h1 className="font-sans font-light text-3xl tracking-tight text-ink">
          Cockpit <span className="font-serif italic font-normal">renouvellements</span>
          <span className="text-ink-mute">.</span>
        </h1>
        <p className="text-sm text-ink-mute max-w-2xl">
          Vue priorisée des diagnostiqueurs dont une certification COFRAC ou une assurance RC Pro
          expire dans les 90 jours. Anticipez les relances proactives.
        </p>
      </header>

      {/* KPIs urgence */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <UrgencyCard label="Expirés" value={counts.expired} variant="red" />
        <UrgencyCard label="Critiques (≤ 7j)" value={counts.critical} variant="red" />
        <UrgencyCard label="Urgents (≤ 30j)" value={counts.urgent} variant="orange" />
        <UrgencyCard label="Attention (≤ 60j)" value={counts.attention} variant="yellow" />
      </div>

      {/* Liste priorisée */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">
          {rows.length} diagnostiqueur{rows.length > 1 ? 's' : ''} à suivre
        </h2>
        {rows.length === 0 ? (
          <Card variant="opaque" padding="default">
            <p className="text-sm text-ink-mute">
              Aucun renouvellement à anticiper. Tous les diagnostiqueurs vérifiés ont leur COFRAC et
              leur RC Pro à jour dans les 90 prochains jours.
            </p>
          </Card>
        ) : (
          <div className="glass-opaque rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-cream-deep border-b border-rule">
                  <tr>
                    <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                      Urgence
                    </th>
                    <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                      Diagnostiqueur
                    </th>
                    <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                      Ville
                    </th>
                    <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                      COFRAC
                    </th>
                    <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                      RC Pro
                    </th>
                    <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.diagnosticianId}
                      className="border-b border-rule/60 hover:bg-paper transition-colors"
                    >
                      <td className="px-3 py-2">
                        <Badge variant={URGENCY_BADGE[r.worstUrgency] ?? 'muted'}>
                          {URGENCY_LABEL[r.worstUrgency] ?? r.worstUrgency}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-ink truncate max-w-[240px]">{r.fullName}</td>
                      <td className="px-3 py-2 text-ink-mute">
                        {r.city ?? '—'}
                        {r.departmentCode ? (
                          <span className="ml-1 font-mono text-[10px] text-ink-mute">
                            ({r.departmentCode})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-ink-mute font-mono text-[11px]">
                        {formatDateFr(r.cofracValidUntil)} · {daysLabel(r.cofracDays)}
                      </td>
                      <td className="px-3 py-2 text-ink-mute font-mono text-[11px]">
                        {formatDateFr(r.rcproValidUntil)} · {daysLabel(r.rcproDays)}
                      </td>
                      <td className="px-3 py-2 text-ink text-[12px]">
                        <ActionBadge action={r.recommendedAction} />
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

function UrgencyCard({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant: 'red' | 'orange' | 'yellow' | 'muted'
}) {
  const color =
    variant === 'red'
      ? 'text-[#7C1D1D]'
      : variant === 'orange'
        ? 'text-[#7C3F0A]'
        : variant === 'yellow'
          ? 'text-[#7C5A0A]'
          : 'text-ink-mute'
  return (
    <Card variant="opaque" padding="default">
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">{label}</p>
      <p className={`mt-2 font-serif italic font-normal leading-none text-4xl ${color}`}>{value}</p>
    </Card>
  )
}

function ActionBadge({ action }: { action: string }) {
  switch (action) {
    case 'block_expired':
      return <Badge variant="red">Suspendre activité</Badge>
    case 'urgent_remind_7':
      return <Badge variant="red">Relance urgente J-7</Badge>
    case 'remind_30':
      return <Badge variant="orange">Relance J-30</Badge>
    case 'remind_60':
      return <Badge variant="yellow">Préparer J-60</Badge>
    default:
      return <Badge variant="muted">—</Badge>
  }
}
