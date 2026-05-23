/**
 * /admin/observatoire/refresh — Régénération manuelle des stats live.
 *
 * Bouton "Régénérer maintenant" qui invoque l'Edge Function
 * `observatoire-stats-refresh` puis appelle le webhook
 * `/api/observatoire/revalidate` pour invalider le cache ISR.
 *
 * Affiche également :
 *   - La dernière exécution (timestamp + statut)
 *   - Le tableau des stats actuelles (1 ligne par period_year/period_month/region)
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import { formatGeneratedDate, formatPeriodLabel } from '@/lib/observatoire/live-stats'
import type { Metadata } from 'next'
import { RefreshAdminBoard } from './RefreshAdminBoard'

export const metadata: Metadata = {
  title: 'Observatoire — Refresh stats',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface LiveStatRowAdmin {
  readonly id: string
  readonly periodLabel: string
  readonly periodYear: number
  readonly periodMonth: number
  readonly regionCode: string | null
  readonly regionLabel: string
  readonly medianPriceEur: number | null
  readonly fgRatePct: number | null
  readonly diagnosticsCount: number
  readonly generatedAt: string
  readonly generatedAtLabel: string
}

interface RawRow {
  id: string
  period_year: number
  period_month: number
  region_code: string | null
  median_price_eur: number | string | null
  fg_rate_pct: number | string | null
  diagnostics_count: number
  generated_at: string
}

const REGION_LABELS: Record<string, string> = {
  '11': 'Île-de-France',
  '93': 'PACA',
  '84': 'Auvergne-Rhône-Alpes',
  '76': 'Occitanie',
  '75': 'Nouvelle-Aquitaine',
  '52': 'Pays de la Loire',
  '32': 'Hauts-de-France',
  '44': 'Grand Est',
  '53': 'Bretagne',
  '28': 'Normandie',
  '27': 'Bourgogne-Franche-Comté',
  '24': 'Centre-Val de Loire',
  '94': 'Corse',
}

function toNum(v: number | string | null): number | null {
  if (v === null) return null
  return typeof v === 'string' ? Number.parseFloat(v) : v
}

async function loadStats(): Promise<LiveStatRowAdmin[]> {
  const supabase = createAdminClient()
  // biome-ignore lint/suspicious/noExplicitAny: table pas dans Database.types
  const { data, error } = await (supabase as any)
    .from('observatoire_live_stats')
    .select(
      'id, period_year, period_month, region_code, median_price_eur, fg_rate_pct, diagnostics_count, generated_at',
    )
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .order('region_code', { ascending: true, nullsFirst: true })
    .limit(200)

  if (error) {
    console.error('[admin/observatoire/refresh] loadStats:', error.message)
    return []
  }

  return ((data ?? []) as RawRow[]).map((r) => ({
    id: r.id,
    periodLabel: formatPeriodLabel(r.period_year, r.period_month),
    periodYear: r.period_year,
    periodMonth: r.period_month,
    regionCode: r.region_code,
    regionLabel:
      r.region_code === null ? 'France (total)' : (REGION_LABELS[r.region_code] ?? r.region_code),
    medianPriceEur: toNum(r.median_price_eur),
    fgRatePct: toNum(r.fg_rate_pct),
    diagnosticsCount: r.diagnostics_count,
    generatedAt: r.generated_at,
    generatedAtLabel: formatGeneratedDate(r.generated_at),
  }))
}

export default async function ObservatoireRefreshPage() {
  const rows = await loadStats()

  // Dernière exécution = max(generated_at)
  const lastGenerated = rows[0]?.generatedAt ?? null
  const lastGeneratedLabel = lastGenerated
    ? new Date(lastGenerated).toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  // lastGenerated stocké pour réutilisation future (rappel ISR, ETag, etc.)
  void lastGenerated

  return <RefreshAdminBoard rows={rows} lastGeneratedLabel={lastGeneratedLabel} />
}
