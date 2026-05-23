/**
 * /admin/diagnostiqueurs/audit — Dashboard live du pipeline de vérification
 * quotidienne (verify-diagnosticians-daily).
 *
 * Server Component : pré-fetche les métriques santé + top départements + liste
 * diagnostiqueurs flaggés. Délègue au composant client `VerifyAuditPanel` pour
 * le bouton de déclenchement manuel.
 */

import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { VerifyAuditPanel } from './verify-audit-panel'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Audit annuaire diagnostiqueurs',
}

interface HealthSnapshot {
  totalDiagnosticians: number
  totalVerified: number
  totalPending: number
  totalSuspended: number
  totalCeased: number
  totalFraudFlagged: number
  totalBelowThreshold: number
  totalGmbEnriched: number
  totalSireneActive: number
  avgActivityScore: number | null
  lastCronRunAt: string | null
  lastCronStatus: string | null
  logs24h: number
  fraudFlags24h: number
  ceased24h: number
  overdue30d: number
}

interface TopDept {
  dept_code: string
  total: number
  verified: number
  below_threshold: number
}

interface FlaggedDiag {
  id: string
  full_name: string | null
  city: string | null
  dept_code: string | null
  activity_score: number | null
  validation_status: string | null
  fraud_flags: Array<Record<string, unknown>> | null
  sirene_state: string | null
}

async function fetchHealth(): Promise<HealthSnapshot> {
  try {
    const supabase = await createClient()
    // biome-ignore lint/suspicious/noExplicitAny: vue accessible via service_role, types Database à régénérer
    const client = supabase as any
    const { data } = await client.from('diagnosticians_verify_health').select('*').maybeSingle()
    if (!data) return emptyHealth()
    return {
      totalDiagnosticians: Number(data.total_diagnosticians ?? 0),
      totalVerified: Number(data.total_verified ?? 0),
      totalPending: Number(data.total_pending ?? 0),
      totalSuspended: Number(data.total_suspended ?? 0),
      totalCeased: Number(data.total_ceased ?? 0),
      totalFraudFlagged: Number(data.total_fraud_flagged ?? 0),
      totalBelowThreshold: Number(data.total_below_threshold ?? 0),
      totalGmbEnriched: Number(data.total_gmb_enriched ?? 0),
      totalSireneActive: Number(data.total_sirene_active ?? 0),
      avgActivityScore: data.avg_activity_score !== null ? Number(data.avg_activity_score) : null,
      lastCronRunAt: data.last_cron_run_at ?? null,
      lastCronStatus: data.last_cron_status ?? null,
      logs24h: Number(data.logs_24h ?? 0),
      fraudFlags24h: Number(data.fraud_flags_24h ?? 0),
      ceased24h: Number(data.ceased_24h ?? 0),
      overdue30d: Number(data.overdue_30d ?? 0),
    }
  } catch {
    return emptyHealth()
  }
}

function emptyHealth(): HealthSnapshot {
  return {
    totalDiagnosticians: 0,
    totalVerified: 0,
    totalPending: 0,
    totalSuspended: 0,
    totalCeased: 0,
    totalFraudFlagged: 0,
    totalBelowThreshold: 0,
    totalGmbEnriched: 0,
    totalSireneActive: 0,
    avgActivityScore: null,
    lastCronRunAt: null,
    lastCronStatus: null,
    logs24h: 0,
    fraudFlags24h: 0,
    ceased24h: 0,
    overdue30d: 0,
  }
}

async function fetchTopDepartments(): Promise<TopDept[]> {
  try {
    const supabase = await createClient()
    // biome-ignore lint/suspicious/noExplicitAny: vue admin, types à régénérer
    const client = supabase as any
    const { data } = await client.from('diagnosticians_top_departments').select('*').limit(10)
    return (data ?? []) as TopDept[]
  } catch {
    return []
  }
}

async function fetchFlagged(): Promise<FlaggedDiag[]> {
  try {
    const supabase = await createClient()
    // biome-ignore lint/suspicious/noExplicitAny: lecture admin diagnosticians (RLS contournée via service_role côté server)
    const client = supabase as any
    const { data } = await client
      .from('diagnosticians')
      .select(
        'id, full_name, city, dept_code, activity_score, validation_status, fraud_flags, sirene_state',
      )
      .lt('activity_score', 0.5)
      .order('activity_score', { ascending: true })
      .limit(50)
    return (data ?? []) as FlaggedDiag[]
  } catch {
    return []
  }
}

export default async function AdminDiagnosticiansAuditPage() {
  const [health, topDepts, flagged] = await Promise.all([
    fetchHealth(),
    fetchTopDepartments(),
    fetchFlagged(),
  ])

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Audit annuaire diagnostiqueurs
        </h1>
        <p className="text-[13px] text-ink-mute">
          Pipeline de vérification quotidienne croisant <strong>DHUP</strong> (certifications
          officielles), <strong>Sirene</strong> (état entreprise) et{' '}
          <strong>Google My Business</strong> (réputation). Calcule un <code>activity_score</code>{' '}
          entre 0 et 1 (seuil de visibilité publique : <code>0.5</code>).
        </p>
        <p className="text-[12px] text-ink-faint">
          Le cron <code>kovas-verify-diagnosticians-daily</code> tourne chaque jour à{' '}
          <strong>03:00 UTC</strong> par batch de 500. Couverture rotation : ~26 jours.
        </p>
      </header>

      {/* Métriques principales */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <MetricCard
          label="Total fiches"
          value={health.totalDiagnosticians.toLocaleString('fr-FR')}
        />
        <MetricCard
          label="Vérifiées"
          value={health.totalVerified.toLocaleString('fr-FR')}
          tone="good"
        />
        <MetricCard
          label="En attente"
          value={health.totalPending.toLocaleString('fr-FR')}
          tone="warn"
        />
        <MetricCard
          label="Suspendues"
          value={health.totalSuspended.toLocaleString('fr-FR')}
          tone="warn"
        />
        <MetricCard label="Radiées" value={health.totalCeased.toLocaleString('fr-FR')} tone="bad" />
        <MetricCard
          label="Flaggées fraude"
          value={health.totalFraudFlagged.toLocaleString('fr-FR')}
          tone="bad"
        />
        <MetricCard
          label="Score < 0.5"
          value={health.totalBelowThreshold.toLocaleString('fr-FR')}
          tone="warn"
        />
        <MetricCard label="GMB enrichies" value={health.totalGmbEnriched.toLocaleString('fr-FR')} />
        <MetricCard
          label="SIRET actif"
          value={health.totalSireneActive.toLocaleString('fr-FR')}
          tone="good"
        />
        <MetricCard
          label="Score moyen"
          value={health.avgActivityScore !== null ? health.avgActivityScore.toFixed(3) : '—'}
        />
      </section>

      {/* État dernière exécution + Bouton manuel */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-rule/60 bg-paper p-5">
          <h2 className="text-base font-semibold text-ink">Dernière exécution cron</h2>
          <dl className="space-y-1 text-[13px] text-ink-mute">
            <Row
              label="Quand"
              value={health.lastCronRunAt ? formatDate(health.lastCronRunAt) : 'Jamais'}
            />
            <Row label="Statut" value={health.lastCronStatus ?? '—'} />
            <Row label="Logs 24h" value={health.logs24h.toLocaleString('fr-FR')} />
            <Row label="Fraud flags 24h" value={health.fraudFlags24h.toLocaleString('fr-FR')} />
            <Row label="Radiations 24h" value={health.ceased24h.toLocaleString('fr-FR')} />
            <Row label="Overdue > 30j" value={health.overdue30d.toLocaleString('fr-FR')} />
          </dl>
        </div>
        <VerifyAuditPanel />
      </section>

      {/* Top départements */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Top 10 départements</h2>
        {topDepts.length === 0 ? (
          <p className="text-[13px] text-ink-faint">
            Aucune donnée — la vue requiert que la migration <code>20260524190000</code> ait été
            appliquée + au moins 1 diagnostiqueur avec <code>dept_code</code>.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-rule/60 bg-paper">
            <table className="w-full text-[13px]">
              <thead className="bg-paper-deep text-[11px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-2 text-left">Département</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Vérifiés</th>
                  <th className="px-4 py-2 text-right">Sous seuil</th>
                </tr>
              </thead>
              <tbody>
                {topDepts.map((d) => (
                  <tr key={d.dept_code} className="border-t border-rule/40">
                    <td className="px-4 py-2 font-mono text-ink">{d.dept_code}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-ink">{d.total}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-green-700">
                      {d.verified}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-amber-700">
                      {d.below_threshold}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Diagnostiqueurs flaggés */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">
          Diagnostiqueurs flaggés ({flagged.length})
        </h2>
        <p className="text-[12px] text-ink-faint">
          Fiches avec <code>activity_score &lt; 0.5</code>. Masquées du public via RLS. Inspection
          manuelle requise pour validation ou suspension définitive.
        </p>
        {flagged.length === 0 ? (
          <p className="rounded-xl border border-rule/60 bg-paper p-4 text-[13px] text-ink-mute">
            Aucun diagnostiqueur flaggé.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-rule/60 bg-paper">
            <table className="w-full text-[13px]">
              <thead className="bg-paper-deep text-[11px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-2 text-left">Nom</th>
                  <th className="px-4 py-2 text-left">Ville</th>
                  <th className="px-4 py-2 text-left">Dept</th>
                  <th className="px-4 py-2 text-right">Score</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Sirene</th>
                  <th className="px-4 py-2 text-left">Signaux</th>
                </tr>
              </thead>
              <tbody>
                {flagged.map((d) => (
                  <tr key={d.id} className="border-t border-rule/40">
                    <td className="px-4 py-2 text-ink">{d.full_name ?? '—'}</td>
                    <td className="px-4 py-2 text-ink-mute">{d.city ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-ink-faint">{d.dept_code ?? '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-amber-700">
                      {d.activity_score !== null ? d.activity_score.toFixed(2) : '—'}
                    </td>
                    <td className="px-4 py-2 text-ink-mute">{d.validation_status ?? '—'}</td>
                    <td className="px-4 py-2 text-ink-faint">{d.sirene_state ?? '—'}</td>
                    <td className="px-4 py-2 text-[11px] text-ink-faint">
                      {Array.isArray(d.fraud_flags) && d.fraud_flags.length > 0
                        ? d.fraud_flags
                            .map((f) => (typeof f.type === 'string' ? f.type : 'unknown'))
                            .join(', ')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'good' | 'warn' | 'bad'
}) {
  const toneClass =
    tone === 'good'
      ? 'text-green-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'bad'
          ? 'text-red-700'
          : 'text-ink'
  return (
    <div className="rounded-xl border border-rule/60 bg-paper p-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="font-mono text-ink">{value}</dd>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
}
