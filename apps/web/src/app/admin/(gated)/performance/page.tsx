/**
 * /admin/performance — latence p50/p95/p99 des opérations critiques.
 *
 * Sources :
 *   - ai_usage.latency_ms (existant) → opérations IA (préfixées `ai:`)
 *   - perf_metrics.duration_ms (nouveau, migration 20260524130000) → non-IA
 *
 * Instrumentation côté code : à câbler progressivement dans les routes
 * lourdes (POST /api/dossiers/[id]/export, etc.) via un helper trackPerf().
 */

import { OperationLatencyTable } from '@/components/admin/performance/OperationLatencyTable'
import { PerfDailyChart } from '@/components/admin/performance/PerfDailyChart'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { getPerfSnapshot } from '@/lib/admin/observability'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { Activity, AlertTriangle, Gauge, Timer } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Performance technique',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatMs(ms: number): string {
  if (ms === 0) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`
}

function formatThroughput(rpm: number): string {
  if (rpm >= 1) return `${rpm.toFixed(1)} req/min`
  return `${(rpm * 60).toFixed(1)} req/h`
}

export default async function AdminPerformancePage() {
  const supabase = createAdminClient()
  const snapshot = await getPerfSnapshot(supabase)

  // Latence agrégée toutes opérations (pour les KPIs hero)
  // On reprend la p95 max parmi les top 5 opérations pour un signal pertinent
  const topOps = snapshot.byOperation.slice(0, 5)
  const worstP95 = topOps.reduce((max, o) => Math.max(max, o.p95ms), 0)
  const totalCalls = snapshot.byOperation.reduce((s, o) => s + o.callsCount, 0)

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Performance · Observabilité
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Latence et taux d'erreur.
        </h1>
        <p className="text-sm text-ink-mute max-w-xl">
          Performance des opérations critiques (transcription, classification, extraction, exports
          ZIP Liciel, génération PDF) sur les 7 derniers jours.
        </p>
      </div>

      {/* KPIs hero */}
      <section
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Métriques performance clés"
      >
        <AdminMetricCard
          eyebrow="Pire p95 (top 5)"
          value={formatMs(worstP95)}
          hint={`Sur les 5 opérations les plus appelées · ${snapshot.byOperation.length} ops total`}
          icon={Timer}
        />
        <AdminMetricCard
          eyebrow="Erreurs 24h"
          value={formatPct(snapshot.errors24h.rate)}
          hint={`${snapshot.errors24h.errors} / ${snapshot.errors24h.total} req non-IA`}
          icon={AlertTriangle}
        />
        <AdminMetricCard
          eyebrow="Erreurs 7j"
          value={formatPct(snapshot.errors7d.rate)}
          hint={`${snapshot.errors7d.errors} / ${snapshot.errors7d.total} req non-IA`}
          icon={Gauge}
        />
        <AdminMetricCard
          eyebrow="Throughput 24h"
          value={formatThroughput(snapshot.throughputPerMinute24h)}
          hint={`${totalCalls.toLocaleString('fr-FR')} calls sur 7j`}
          icon={Activity}
        />
      </section>

      {/* Chart 7j */}
      <section aria-label="Évolution 7 jours">
        <PerfDailyChart data={snapshot.daily7d} />
      </section>

      {/* Table par opération */}
      <section aria-label="Latence par opération">
        <OperationLatencyTable rows={snapshot.byOperation} />
      </section>

      {/* Note instrumentation */}
      <section aria-label="Note technique" className="text-xs text-ink-faint">
        <p>
          Les opérations IA sont tracées via <code className="font-mono">ai_usage</code> depuis le
          jour 1. Les opérations non-IA (exports, génération PDF, consolidation) doivent être
          instrumentées via <code className="font-mono">trackPerf()</code> — voir{' '}
          <code className="font-mono">lib/observability/track-perf.ts</code>.
        </p>
      </section>
    </div>
  )
}
