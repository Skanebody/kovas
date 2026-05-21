/**
 * KOVAS — Dashboard Cockpit ADEME (composition de sous-blocs).
 *
 * Server component. Reçoit toutes les données pré-chargées par la page
 * et les distribue aux sous-composants. Aucune logique I/O ici.
 */

import { Button } from '@/components/ui/button'
import type { AdemeAlertRow } from '@/app/api/ademe/alerts/route'
import type { AdemeKpiSnapshotRow } from '@/app/api/ademe/kpi/current/route'
import type { AdemeDpeCacheRow } from '@/app/api/ademe/dpe/historique/route'
import Link from 'next/link'

import { AdemeAlertsList } from './AdemeAlertsList'
import { AdemeEvolutionChart } from './AdemeEvolutionChart'
import { AdemeFranceMap, type AdemeFranceMapPoint } from './AdemeFranceMap'
import { AdemeKpiCard } from './AdemeKpiCard'
import { AdemeProfessionComparison } from './AdemeProfessionComparison'

export interface AdemeCockpitDashboardProps {
  snapshot: AdemeKpiSnapshotRow | null
  history: AdemeKpiSnapshotRow[]
  alerts: AdemeAlertRow[]
  dpeCache: AdemeDpeCacheRow[]
  dpeCount: number
}

const VOLUME_WARNING = 800
const VOLUME_CRITICAL = 950
const VOLUME_MAX_DISPLAY = 1000
const NATIONAL_FG_RATIO = 0.27

export function AdemeCockpitDashboard({
  snapshot,
  history,
  alerts,
  dpeCache,
  dpeCount,
}: AdemeCockpitDashboardProps) {
  const metadata = snapshot?.metadata ?? null
  const dpe12m = metadata?.dpe_count_12m ?? 0
  const ratioFg = metadata?.ratio_fg ?? null
  const avgDistance = metadata?.avg_distance_km ?? null
  const riskScore = metadata?.risk_score_0_100 ?? 0
  const riskLevel = metadata?.risk_level ?? 'green'

  const deltaFgPp = ratioFg !== null ? (ratioFg - NATIONAL_FG_RATIO) * 100 : null

  const mapPoints: AdemeFranceMapPoint[] = dpeCache.map((row) => ({
    id: row.id,
    latitude: row.latitude ?? 0,
    longitude: row.longitude ?? 0,
    etiquette: row.etiquette_dpe,
    commune: row.commune,
    date: row.date_etablissement_dpe,
  }))

  return (
    <div className="space-y-8">
      {/* Hero KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdemeKpiCard
          value={dpe12m}
          label="DPE 12 mois glissants"
          hint={`Seuil de surveillance ${VOLUME_WARNING} · critique ${VOLUME_CRITICAL}`}
          progress={{
            current: dpe12m,
            max: VOLUME_MAX_DISPLAY,
            warning: VOLUME_WARNING,
            critical: VOLUME_CRITICAL,
          }}
        />
        <AdemeKpiCard
          value={ratioFg !== null ? `${(ratioFg * 100).toFixed(1)}%` : '—'}
          label="Ratio F/G du cabinet"
          hint={`Médiane nationale ${(NATIONAL_FG_RATIO * 100).toFixed(1)}%`}
          delta={
            deltaFgPp !== null
              ? { value: Number(deltaFgPp.toFixed(1)), format: 'pp', positive_is_good: false }
              : undefined
          }
        />
        <AdemeKpiCard
          value={avgDistance !== null ? `${avgDistance.toFixed(1)}` : '—'}
          label="Distance moyenne entre DPE"
          hint="km — proxy déplacement quotidien"
        />
        <AdemeKpiCard
          value={`${riskScore}`}
          label="Score de risque global"
          hint="0 sain · 100 critique"
          risk={riskLevel}
        />
      </div>

      {/* CTA principal */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rule bg-paper/60 px-5 py-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-ink">Avant de publier un DPE</p>
          <p className="text-[12px] text-ink-mute max-w-md">
            Pré-validez votre saisie pour éviter une alerte ADEME a posteriori.
          </p>
        </div>
        <Button variant="accent" size="lg" asChild>
          <Link href="/app/cockpit-ademe/prevalidation">Pré-valider un DPE</Link>
        </Button>
      </div>

      {/* Carte + alertes en 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AdemeFranceMap points={mapPoints} />
          <p className="mt-2 text-[11px] text-ink-faint">
            {dpeCount} DPE total en cache local · {mapPoints.length} affichés
          </p>
        </div>
        <div className="space-y-4">
          <h3 className="text-[15px] font-semibold text-ink">Alertes actives</h3>
          <AdemeAlertsList alerts={alerts} />
        </div>
      </div>

      {/* Évolution + benchmark */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AdemeEvolutionChart snapshots={history} />
        </div>
        <AdemeProfessionComparison yourRatio={ratioFg} />
      </div>
    </div>
  )
}
