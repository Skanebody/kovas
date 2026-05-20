/**
 * /admin/cout-ia — monitoring détaillé des coûts IA (Anthropic / OpenAI / Deepgram).
 *
 * Itération 5/N : tout server-side. Pas de polling client, juste un revalidate
 * via Next.js (force-dynamic + revalidate=0) au chargement de la page.
 * V2 : refresh push event-driven via /api/admin/ia/anomalies si latence problématique.
 */

import { AnomalyConsumersTable } from '@/components/admin/ia/AnomalyConsumersTable'
import { CacheHitRate } from '@/components/admin/ia/CacheHitRate'
import { CapsManager } from '@/components/admin/ia/CapsManager'
import { ModelBreakdownChart } from '@/components/admin/ia/ModelBreakdownChart'
import { OptimizationsPerformance } from '@/components/admin/ia/OptimizationsPerformance'
import { TopConsumersTable } from '@/components/admin/ia/TopConsumersTable'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import {
  getActiveCaps,
  getAnomalyConsumers,
  getCacheHitRate,
  getIAUsageMonth,
  getIAUsageToday,
  getLatencyPercentiles,
  getModelBreakdown,
  getTopConsumers,
} from '@/lib/admin/ia-analytics'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { AlertTriangle, Bot, Building2, Calendar, Database, Timer, Zap } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Coûts IA',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// Helpers de formatage
// ============================================

function formatEur(amount: number, fractionDigits = 2): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount)
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

function formatMs(ms: number): string {
  if (ms === 0) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

// ============================================
// Page
// ============================================

export default async function AdminIaPage() {
  const supabase = createAdminClient()

  const [today, month, topConsumers, anomalies, breakdown, cacheHit, latency, caps] =
    await Promise.all([
      getIAUsageToday(supabase),
      getIAUsageMonth(supabase),
      getTopConsumers(supabase, 10),
      getAnomalyConsumers(supabase),
      getModelBreakdown(supabase),
      getCacheHitRate(supabase),
      getLatencyPercentiles(supabase),
      getActiveCaps(supabase, 50),
    ])

  const topConsumerLabel = topConsumers[0]
    ? `${topConsumers[0].orgName} · ${formatEur(topConsumers[0].costEur)}`
    : 'Aucune org consommatrice'

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          🤖 Coûts IA · Monitoring
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Pipeline IA en temps réel.
        </h1>
        <p className="text-sm text-ink-mute max-w-xl">
          Coûts Anthropic + OpenAI + Deepgram, anomalies, cache hit rate et levers d'optimisation.
        </p>
      </div>

      {/* Grid 6 metric cards */}
      <section
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Métriques IA clés"
      >
        <AdminMetricCard
          eyebrow="Coût aujourd'hui"
          value={formatEur(today.costEur)}
          hint={`${formatInt(today.callsCount)} appels · latence moy ${formatMs(today.avgLatencyMs)}`}
          icon={Calendar}
        />
        <AdminMetricCard
          eyebrow="Coût ce mois"
          value={formatEur(month.costEur, 0)}
          hint={`${formatInt(month.callsCount)} appels · ${Object.keys(month.byOperation).length} ops`}
          icon={Bot}
        />
        <AdminMetricCard
          eyebrow="Top consumer"
          value={topConsumers[0] ? formatEur(topConsumers[0].costEur, 0) : '—'}
          hint={topConsumerLabel}
          icon={Building2}
        />
        <AdminMetricCard
          eyebrow="Cache hit rate 30j"
          value={`${(cacheHit.rate30d * 100).toFixed(1)}%`}
          hint={`7j : ${(cacheHit.rate7d * 100).toFixed(1)}% · tendance ${cacheHit.trend}`}
          icon={Database}
        />
        <AdminMetricCard
          eyebrow="Latence p95"
          value={formatMs(latency.p95ms)}
          hint={`p50 : ${formatMs(latency.p50ms)}`}
          icon={Timer}
        />
        <AdminMetricCard
          eyebrow="Anomalies 24h"
          value={formatInt(anomalies.length)}
          hint={
            anomalies.length === 0
              ? 'Tout est sous 3× la moyenne 30j'
              : 'Orgs > 3× leur moyenne 30j'
          }
          icon={anomalies.length > 0 ? AlertTriangle : Zap}
        />
      </section>

      {/* Top consumers + Anomalies */}
      <section
        className="grid gap-4 grid-cols-1 lg:grid-cols-2"
        aria-label="Consommation détaillée par organisation"
      >
        <TopConsumersTable consumers={topConsumers} />
        <AnomalyConsumersTable anomalies={anomalies} />
      </section>

      {/* Model breakdown + Cache hit rate */}
      <section
        className="grid gap-4 grid-cols-1 lg:grid-cols-2"
        aria-label="Analyse modèles et cache"
      >
        <ModelBreakdownChart breakdown={breakdown} />
        <CacheHitRate data={cacheHit} />
      </section>

      {/* Caps + Optimisations */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-2" aria-label="Pilotage IA">
        <CapsManager caps={caps} />
        <OptimizationsPerformance />
      </section>
    </div>
  )
}
