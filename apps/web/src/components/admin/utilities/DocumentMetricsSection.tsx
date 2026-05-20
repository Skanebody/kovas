/**
 * Section "Document Intelligence · métriques 30j" :
 *   - 4 KPI cards (total scans / success rate / avg confidence / cost+margin)
 *   - Types de documents les plus scannés (BarChart vertical)
 *   - Taux de correction par champ (BarChart horizontal)
 *   - Top users par volume (table)
 *   - Coût IA par user (progress bars)
 *   - Users proches du quota (alerts colorées)
 */

import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import type { DocumentMetrics } from '@/lib/admin/document-metrics'
import { Coins, FileScan, Gauge, Sparkles } from 'lucide-react'
import { AiCostBreakdown } from './AiCostBreakdown'
import { DocumentTypeBreakdownChart } from './DocumentTypeBreakdownChart'
import { ExtractionAccuracyChart } from './ExtractionAccuracyChart'
import { UserDocumentVolumeTable } from './UserDocumentVolumeTable'
import { UsersNearQuotaAlerts } from './UsersNearQuotaAlerts'

interface DocumentMetricsSectionProps {
  metrics: DocumentMetrics
}

function formatEur(amount: number, fractionDigits = 0): string {
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

function formatPct(pct: number, fractionDigits = 1): string {
  return `${pct.toFixed(fractionDigits)}%`
}

export function DocumentMetricsSection({ metrics }: DocumentMetricsSectionProps) {
  const growthLabel =
    metrics.scanGrowthPct === 0
      ? 'stable vs 30j précédents'
      : `${metrics.scanGrowthPct > 0 ? '+' : ''}${formatPct(metrics.scanGrowthPct, 1)} vs 30j précédents`

  return (
    <section className="space-y-5" aria-label="Document Intelligence métriques">
      <header className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          📄 Document Intelligence · 30 jours
        </p>
        <h2 className="font-serif italic font-normal text-2xl text-ink">OCR, extraction, marge.</h2>
        <p className="text-sm text-ink-mute">
          Volume scans, taux de succès extraction et coût IA Document Intelligence.
        </p>
      </header>

      {/* 4 KPI cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <AdminMetricCard
          eyebrow="Scans 30j"
          value={formatInt(metrics.totalScans30d)}
          hint={growthLabel}
          comparison={null}
          icon={FileScan}
        />
        <AdminMetricCard
          eyebrow="Taux succès"
          value={formatPct(metrics.successRate * 100, 1)}
          hint="status extracted + prefilled"
          comparison={null}
          icon={Gauge}
        />
        <AdminMetricCard
          eyebrow="Confiance moy."
          value={formatPct(metrics.avgConfidence * 100, 1)}
          hint="classification_confidence"
          comparison={null}
          icon={Sparkles}
        />
        <AdminMetricCard
          eyebrow="Coût IA 30j"
          value={formatEur(metrics.totalCost30d, 2)}
          hint={`Marge brute Document Intelligence : ${formatPct(metrics.marginPct * 100, 0)}`}
          comparison={null}
          icon={Coins}
        />
      </div>

      {/* Types breakdown */}
      <DocumentTypeBreakdownChart data={metrics.documentTypeBreakdown} />

      {/* Correction rate by field */}
      <ExtractionAccuracyChart data={metrics.correctionRateByField} />

      {/* Top users + cost split */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <UserDocumentVolumeTable users={metrics.topUsers} />
        <AiCostBreakdown costs={metrics.costByUser} />
      </div>

      {/* Users near quota */}
      <UsersNearQuotaAlerts users={metrics.usersNearQuota} />
    </section>
  )
}
