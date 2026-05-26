/**
 * <BenchmarkComparison> — Table sobre comparaison vs benchmarks régionaux/FR.
 *
 * Affiche une ligne par métrique avec colonnes : Vous / Moyenne région / Moyenne FR / Top 10%.
 * Pour chaque ligne, un indicateur visuel de position relative (dot sur barre horizontale).
 *
 * DS v5 strict : table sobre, accents ink-mute, barres pillules pâles.
 */

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface BenchmarkRow {
  /** Identifiant unique pour la key React. */
  id: string
  /** Nom de la métrique (ex: "Panier moyen mission"). */
  label: string
  /** Suffixe d'unité (ex: " €", " %", ""). */
  unitSuffix?: string
  /** Vos valeurs (null si pas de donnée). */
  yourValue: number | null
  /** Moyenne région (null si pas dispo). */
  regional?: number | null
  /** Moyenne nationale FR. */
  national: number | null
  /** Seuil top 10% (P90 ou P95 selon métrique). */
  top10pct: number | null
}

interface BenchmarkComparisonProps {
  /** Titre table. */
  title?: string
  /** Lignes de benchmark. */
  rows: BenchmarkRow[]
  /** Taille de l'échantillon de référence (pour mention bas de table). */
  sampleSize?: number | null
  /** Hint personnalisé en italique gris en bas. */
  hint?: string
}

function formatValue(v: number | null, suffix = ''): string {
  if (v == null) return '—'
  if (Math.abs(v) >= 10_000) return `${Math.round(v / 1000).toLocaleString('fr-FR')}k${suffix}`
  return `${Math.round(v).toLocaleString('fr-FR')}${suffix}`
}

/** Position relative 0-100 du yourValue dans le range [0, top10pct]. */
function computePosition(row: BenchmarkRow): number | null {
  if (row.yourValue == null) return null
  const top = row.top10pct ?? row.national ?? row.regional
  if (!top || top <= 0) return null
  return Math.max(0, Math.min(100, (row.yourValue / top) * 100))
}

export function BenchmarkComparison({
  title = 'Toi vs marché',
  rows,
  sampleSize,
  hint,
}: BenchmarkComparisonProps) {
  const defaultHint =
    sampleSize != null
      ? `Benchmarks calculés sur ${sampleSize.toLocaleString('fr-FR')} cabinets diagnostic FR — mise à jour mensuelle.`
      : 'Benchmarks anonymisés (k-anonymity ≥ 5 cabinets) — mise à jour mensuelle.'

  return (
    <Card variant="opaque" padding="none" className="rounded-[24px] overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[#0F1419]/[0.08] px-6 py-4">
        <p className="font-sans font-semibold text-[14px] text-[#0F1419]">{title}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#0F1419]/72">
          {rows.length} métrique{rows.length > 1 ? 's' : ''}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-sage-alt/40">
            <tr className="text-left">
              <th
                scope="col"
                className="font-mono text-[10px] uppercase tracking-[0.1em] font-medium text-[#0F1419]/72 px-6 py-2.5"
              >
                Métrique
              </th>
              <th
                scope="col"
                className="font-mono text-[10px] uppercase tracking-[0.1em] font-medium text-[#0F1419]/72 px-3 py-2.5 text-right"
              >
                Toi
              </th>
              <th
                scope="col"
                className="font-mono text-[10px] uppercase tracking-[0.1em] font-medium text-[#0F1419]/72 px-3 py-2.5 text-right hidden sm:table-cell"
              >
                Région
              </th>
              <th
                scope="col"
                className="font-mono text-[10px] uppercase tracking-[0.1em] font-medium text-[#0F1419]/72 px-3 py-2.5 text-right"
              >
                FR
              </th>
              <th
                scope="col"
                className="font-mono text-[10px] uppercase tracking-[0.1em] font-medium text-[#0F1419]/72 px-3 py-2.5 text-right"
              >
                Top 10%
              </th>
              <th
                scope="col"
                className="font-mono text-[10px] uppercase tracking-[0.1em] font-medium text-[#0F1419]/72 px-6 py-2.5 hidden md:table-cell"
              >
                Position
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#0F1419]/[0.08]">
            {rows.map((row) => {
              const pos = computePosition(row)
              const aboveNational =
                row.yourValue != null && row.national != null && row.yourValue >= row.national
              return (
                <tr key={row.id} className="hover:bg-[#0F1419]/[0.02] transition-colors">
                  <td className="px-6 py-3 text-[#0F1419]">{row.label}</td>
                  <td
                    className={cn(
                      'px-3 py-3 text-right font-mono tabular-nums font-semibold',
                      aboveNational ? 'text-success' : 'text-[#0F1419]',
                    )}
                  >
                    {formatValue(row.yourValue, row.unitSuffix)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-[#0F1419]/72 hidden sm:table-cell">
                    {formatValue(row.regional ?? null, row.unitSuffix)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-[#0F1419]/72">
                    {formatValue(row.national, row.unitSuffix)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-[#0F1419]/72">
                    {formatValue(row.top10pct, row.unitSuffix)}
                  </td>
                  <td className="px-6 py-3 hidden md:table-cell">
                    {pos == null ? (
                      <span className="font-mono text-[10px] text-[#0F1419]/40">—</span>
                    ) : (
                      <div
                        className="relative h-1.5 w-full max-w-[120px] rounded-full bg-[#0F1419]/[0.08]"
                        aria-label={`Position ${Math.round(pos)}%`}
                      >
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-2.5 rounded-full bg-[#0F1419]"
                          style={{ left: `${pos}%` }}
                          aria-hidden
                        />
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[#0F1419]/[0.08] px-6 py-3">
        <p className="font-mono text-[10px] text-[#0F1419]/72 italic leading-relaxed">
          {hint ?? defaultHint}
        </p>
      </div>
    </Card>
  )
}
