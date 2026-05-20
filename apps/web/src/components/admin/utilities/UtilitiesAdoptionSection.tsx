/**
 * Section "Utilities · adoption" — 5 metric cards (1 par outil) + insight box
 * + sous-section cohortes.
 *
 * Server component (data déjà loadée côté page).
 */

import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { Card } from '@/components/ui/card'
import type { UtilitiesAdoption } from '@/lib/admin/utilities-metrics'
import { ClipboardCheck, FileCheck2, Hammer, Lightbulb, Ruler, Wrench } from 'lucide-react'
import { AdoptionCohortChart } from './AdoptionCohortChart'

interface UtilitiesAdoptionSectionProps {
  adoption: UtilitiesAdoption
}

const ICON_BY_NAME = {
  diagnostic_requirements: ClipboardCheck,
  validity_checker: FileCheck2,
  surface_calculator: Ruler,
  client_template_generator: Hammer,
  pre_departure_checklist: Wrench,
} as const

function formatInt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

function formatPct(pct: number): string {
  return `${pct.toFixed(1)}%`
}

export function UtilitiesAdoptionSection({ adoption }: UtilitiesAdoptionSectionProps) {
  const lowAdoption = adoption.tools.filter((t) => t.uniqueUsersPercent < 20)

  return (
    <section className="space-y-5" aria-label="Adoption Utilities terrain">
      <header className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          🧰 Outils terrain · adoption 30 jours
        </p>
        <h2 className="font-serif italic font-normal text-2xl text-ink">
          Cinq outils, cinq adoptions.
        </h2>
        <p className="text-sm text-ink-mute">
          {adoption.activeUsersThisMonth} utilisateur
          {adoption.activeUsersThisMonth > 1 ? 's' : ''} actif
          {adoption.activeUsersThisMonth > 1 ? 's' : ''} ce mois · base de calcul %.
        </p>
      </header>

      {/* Grid 5 metric cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {adoption.tools.map((tool) => {
          const Icon = ICON_BY_NAME[tool.name]
          return (
            <AdminMetricCard
              key={tool.name}
              eyebrow={tool.label}
              value={formatInt(tool.usageCount30d)}
              hint={`${formatInt(tool.uniqueUsers30d)} user${tool.uniqueUsers30d > 1 ? 's' : ''} · ${formatPct(tool.uniqueUsersPercent)} des actifs`}
              comparison={null}
              icon={Icon}
            />
          )
        })}
      </div>

      {/* Insight box */}
      <Card variant="opaque" padding="default" className="border-l-4 border-l-chartreuse">
        <div className="flex items-start gap-3">
          <Lightbulb className="size-5 text-ink shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-1">
            <p className="text-[13px] font-semibold text-ink">
              {lowAdoption.length === 0
                ? 'Tous les outils dépassent 20% d’adoption ce mois.'
                : `${lowAdoption.length} outil${lowAdoption.length > 1 ? 's' : ''} sous 20% d’adoption.`}
            </p>
            <p className="text-[12px] text-ink-mute">
              💡 Si un outil reste sous <span className="font-semibold">20%</span> d’adoption après
              60 jours, envisager de le retirer ou d’améliorer sa visibilité dans le parcours
              terrain.
            </p>
            {lowAdoption.length > 0 ? (
              <ul className="mt-2 space-y-0.5">
                {lowAdoption.map((t) => (
                  <li key={t.name} className="font-mono text-[11px] text-ink-faint">
                    · {t.label} — {formatPct(t.uniqueUsersPercent)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Cohort chart */}
      <AdoptionCohortChart data={adoption.byCohort} />
    </section>
  )
}
