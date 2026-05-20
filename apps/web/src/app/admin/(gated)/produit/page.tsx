/**
 * /admin/produit — Adoption produit (capture-first, voice live, exports, etc.)
 *
 * Itération 7/N : tout server-side (Promise.all sur 7 lectures), zéro polling.
 * Layout protégé par (gated) → verifyAdminAccess + 2FA actif.
 *
 * Note tables manquantes : plusieurs tables capture-first ne sont pas dans le
 * Database type généré, les helpers (lib/admin/product-analytics) gèrent les
 * casts. Lecture seule, aucun INSERT/UPDATE depuis cette page.
 */

import { CaptureVsClassicSplit } from '@/components/admin/product/CaptureVsClassicSplit'
import { ExtractionQualityStats } from '@/components/admin/product/ExtractionQualityStats'
import { FeatureAdoptionChart } from '@/components/admin/product/FeatureAdoptionChart'
import { FeedbackList } from '@/components/admin/product/FeedbackList'
import { MissionDurationDistribution } from '@/components/admin/product/MissionDurationDistribution'
import { MostCorrectedFieldsTable } from '@/components/admin/product/MostCorrectedFieldsTable'
import { UsageHeatmap } from '@/components/admin/product/UsageHeatmap'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import {
  type FeatureAdoptionRow,
  type FeatureKey,
  getCaptureVsClassicSplit,
  getExtractionQualityStats,
  getFeatureAdoption,
  getMissionDurationDistribution,
  getMostCorrectedFields,
  getRecentFeedback,
  getUsageHeatmap,
} from '@/lib/admin/product-analytics'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { CalendarRange, Camera, FileDown, FileUp, MapPin, Mic, Sparkles } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Produit',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

const HEATMAP_DAYS = 30

function pct(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`
}

function adoptionFor(rows: FeatureAdoptionRow[], key: FeatureKey): FeatureAdoptionRow | undefined {
  return rows.find((r) => r.feature === key)
}

function adoptionHint(row: FeatureAdoptionRow | undefined): string {
  if (!row || row.totalOrgs === 0) return 'aucune org active ce mois'
  return `${row.activeOrgs} / ${row.totalOrgs} orgs actives`
}

export default async function ProductPage() {
  const supabase = createAdminClient()

  const [adoption, captureClassic, quality, correctedFields, durations, heatmap, feedback] =
    await Promise.all([
      getFeatureAdoption(supabase),
      getCaptureVsClassicSplit(supabase),
      getExtractionQualityStats(supabase),
      getMostCorrectedFields(supabase, 10),
      getMissionDurationDistribution(supabase),
      getUsageHeatmap(supabase, HEATMAP_DAYS),
      getRecentFeedback(supabase, 10),
    ])

  const capture = adoptionFor(adoption, 'capture_first')
  const importLic = adoptionFor(adoption, 'import_liciel')
  const exportLic = adoptionFor(adoption, 'export_liciel')
  const liveVoice = adoptionFor(adoption, 'live_voice')
  const calendar = adoptionFor(adoption, 'calendar_sync')
  const missionMode = adoptionFor(adoption, 'mission_mode')

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          📊 Produit · Adoption des features
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Produit.
        </h1>
        <p className="text-sm text-ink-mute max-w-xl">
          Mesure de l&apos;adoption de chaque feature V1 sur les orgs actives ce mois (Europe/Paris)
          — pour piloter les optimisations vision / voice / exports.
        </p>
      </div>

      {/* 6 metric cards */}
      <section
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Adoption clé des features"
      >
        <AdminMetricCard
          eyebrow="Capture-First"
          value={pct(capture?.adoptionPct ?? 0, 0)}
          hint={adoptionHint(capture)}
          icon={Camera}
        />
        <AdminMetricCard
          eyebrow="Import Liciel"
          value={pct(importLic?.adoptionPct ?? 0, 0)}
          hint={adoptionHint(importLic)}
          icon={FileUp}
        />
        <AdminMetricCard
          eyebrow="Export Liciel"
          value={pct(exportLic?.adoptionPct ?? 0, 0)}
          hint={adoptionHint(exportLic)}
          icon={FileDown}
        />
        <AdminMetricCard
          eyebrow="Voice notes"
          value={pct(liveVoice?.adoptionPct ?? 0, 0)}
          hint={adoptionHint(liveVoice)}
          icon={Mic}
        />
        <AdminMetricCard
          eyebrow="Live capture"
          value={pct(missionMode?.adoptionPct ?? 0, 0)}
          hint={adoptionHint(missionMode)}
          icon={Sparkles}
        />
        <AdminMetricCard
          eyebrow="Calendar sync"
          value={pct(calendar?.adoptionPct ?? 0, 0)}
          hint="tracker .ics à venir V2"
          icon={CalendarRange}
        />
      </section>

      {/* Adoption barres + Capture vs Classic */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FeatureAdoptionChart rows={adoption} />
        </div>
        <CaptureVsClassicSplit data={captureClassic} />
      </section>

      {/* Qualité extraction */}
      <section>
        <ExtractionQualityStats stats={quality} />
      </section>

      {/* Most corrected + Mission duration */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <MostCorrectedFieldsTable fields={correctedFields} />
        <MissionDurationDistribution buckets={durations} />
      </section>

      {/* Heatmap usage */}
      <section>
        <UsageHeatmap cells={heatmap} days={HEATMAP_DAYS} />
      </section>

      {/* Feedback */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FeedbackList rows={feedback} />
        </div>
        <div className="rounded-lg border border-rule/40 bg-sage/40 p-5">
          <div className="flex items-start gap-2.5 mb-3">
            <MapPin className="size-4 text-ink-mute mt-0.5" aria-hidden />
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
                Notes V1 → V2
              </p>
              <h3 className="text-[14px] font-semibold tracking-tight text-ink mt-1">
                Améliorations à venir
              </h3>
            </div>
          </div>
          <ul className="space-y-2 text-[12px] text-ink-mute leading-relaxed">
            <li>
              <span className="text-ink font-medium">Calendar sync</span> · tracker access logs sur
              <code className="font-mono text-[10px] mx-1">/api/calendar/[orgId]/[token].ics</code>
              pour mesurer adoption réelle.
            </li>
            <li>
              <span className="text-ink font-medium">Feedback rating</span> · ajouter colonne
              <code className="font-mono text-[10px] mx-1">rating</code>
              sur support_tickets ou créer table feedback dédiée.
            </li>
            <li>
              <span className="text-ink font-medium">Heatmap</span> · agrégation SQL (CTE) si le
              volume dépasse 50k dossiers / 30j.
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}
