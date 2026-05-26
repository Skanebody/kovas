import { Card } from '@/components/ui/card'
import type { TopCity } from '@/lib/observatoire/stats-aggregator'
import Link from 'next/link'
import { ChartCaption } from './chart-caption'

interface TopCitiesProps {
  cities: readonly TopCity[]
  /** True si les 10 villes sont issues de la DB live, false si fallback */
  isLive: boolean
  /** Période courante affichée par le ChartCaption */
  periodLabel: string
}

/**
 * Section 5 — Top 10 villes en transition énergétique.
 *
 * Score composite 0-100 = ratio rénovations / 1000 hab. × variation YoY F-G ×
 * taux MaPrimeRénov. Chaque ligne renvoie vers `/trouver-un-diagnostiqueur/{dept}/{slug}`
 * pour générer du backlink SEO interne et faciliter le maillage.
 */
export function TopCities({ cities, isLive, periodLabel }: TopCitiesProps) {
  return (
    <div className="space-y-5">
      <Card variant="flat" padding="default" className="flex flex-col">
        <ul className="divide-y divide-rule/40">
          {cities.map((city) => (
            <li key={city.slug}>
              <Link
                href={`/trouver-un-diagnostiqueur/${city.department}/${city.slug}`}
                className="group grid grid-cols-[36px_1fr_auto] sm:grid-cols-[36px_1fr_120px_auto] items-baseline gap-3 sm:gap-5 py-3 hover:bg-sage/40 rounded-md px-2 -mx-2 transition-colors"
              >
                <span
                  className={`font-serif italic text-[26px] leading-none ${
                    city.rank <= 3 ? 'text-ink' : 'text-ink/55'
                  }`}
                >
                  {String(city.rank).padStart(2, '0')}
                </span>
                <div className="flex flex-col">
                  <span className="text-[15px] font-semibold text-ink leading-tight group-hover:underline underline-offset-4">
                    {city.name}
                  </span>
                  <span className="text-[11px] text-ink-mute">
                    {city.renovRatio} rénov./1000 hab. · F-G {city.fgYoy.toFixed(1)} %/an ·
                    MaPrimeRénov {city.primeRenov} %
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <div className="h-1.5 w-24 bg-sage-alt rounded-full overflow-hidden">
                    <div
                      className="h-full bg-navy/80 rounded-full"
                      style={{ width: `${city.score}%` }}
                    />
                  </div>
                </div>
                <span className="font-mono text-[13px] text-ink font-medium tabular-nums">
                  {city.score}/100
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <ChartCaption
        howToRead="Score 0-100 = moyenne pondérée de trois indicateurs : ratio rénovations engagées pour 1000 habitants (poids 50 %), variation annuelle de la part F-G (poids 30 %) et taux de bénéficiaires MaPrimeRénov (poids 20 %). Plus le score est élevé, plus la ville progresse rapidement vers la sortie des passoires énergétiques."
        source="ANAH MaPrimeRénov (bénéficiaires par commune) + INSEE (population) + base ADEME DPE (évolution F-G)"
        dataStatus={isLive ? 'live' : 'fallback'}
        periodLabel={periodLabel}
      />
    </div>
  )
}
