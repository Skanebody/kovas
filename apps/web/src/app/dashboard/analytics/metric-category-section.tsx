'use client'

/**
 * <MetricCategorySection> — Section catégorielle dépliable style Apple Santé Parcourir.
 *
 * Pattern : header cliquable avec icon catégorie + nom + nombre métriques + chevron.
 * Au dépli, liste de <MetricRow> avec :
 *   - Icon mini + nom métrique
 *   - Valeur actuelle + delta vs période précédente
 *   - Mini sparkline 30j à droite
 *   - Chevron `>` indicatif (page détail V2)
 *
 * Client component minimal (juste le toggle expand/collapse + filtre search).
 */

import { Card } from '@/components/ui/card'
import { type AnalyticsIconName, resolveAnalyticsIcon } from '@/lib/icons/analytics-icon-registry'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

export type MetricDeltaDirection = 'up' | 'down' | 'flat'

export interface MetricRow {
  /** Identifiant unique (utilisé pour search + key React). */
  id: string
  /** Nom de l'icône Lucide (résolu côté client via le registre). */
  icon: AnalyticsIconName
  /** Nom métrique (ex: "Missions terminées"). */
  name: string
  /** Valeur formatée (ex: "127", "8 540 €", "92%"). */
  value: string
  /** Delta formaté (ex: "+12%", "−3", "stable"). */
  delta?: string
  /** Direction du delta pour coloration. */
  deltaDirection?: MetricDeltaDirection
  /** Série de valeurs 30j pour mini sparkline (peut être vide). */
  sparkline?: number[]
  /** Description détaillée 1-line (affichée sous nom). */
  hint?: string
}

/**
 * Variantes d'accent — string union plutôt qu'interpolation Tailwind dynamique
 * (Tailwind ne compile pas `bg-${var}/15`). Chaque variante mappe vers une
 * classe statique connue à la compile.
 */
export type MetricCategoryAccent = 'chartreuse' | 'info' | 'success' | 'warning' | 'danger'

const ACCENT_BG_CLASS: Record<MetricCategoryAccent, string> = {
  chartreuse: 'bg-chartreuse/20',
  info: 'bg-info/15',
  success: 'bg-success/15',
  warning: 'bg-warning/15',
  danger: 'bg-danger/15',
}

interface MetricCategorySectionProps {
  /** Identifiant catégorie pour key + ancrage. */
  id: string
  /** Nom de l'icône Lucide catégorie (résolu côté client). */
  icon: AnalyticsIconName
  /** Nom catégorie (ex: "Activité"). */
  name: string
  /** Variante d'accent (statique pour Tailwind). */
  accentClass?: MetricCategoryAccent
  /** Liste des métriques. */
  metrics: MetricRow[]
  /** Filtre client-side : si fourni, ne montre que les métriques matchant. */
  searchTerm?: string
  /** Open by default ? (V1 : on ouvre la 1re catégorie). */
  defaultOpen?: boolean
}

/**
 * Mini sparkline SVG 60×16 — line stroke 1.5px, fill stroke navy DS v5.
 * Pas de tooltip / pas d'axes, juste un trait indicatif.
 */
function MiniSparkline({ data, color = 'currentColor' }: { data: number[]; color?: string }) {
  if (data.length < 2) {
    return <div className="h-4 w-[60px]" aria-hidden />
  }
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const width = 60
  const height = 16
  const stepX = width / (data.length - 1)
  const points = data
    .map(
      (v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`,
    )
    .join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="presentation">
      <title>Sparkline</title>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function deltaClass(direction: MetricDeltaDirection | undefined): string {
  switch (direction) {
    case 'up':
      return 'text-success'
    case 'down':
      return 'text-danger'
    default:
      return 'text-[#0F1419]/72'
  }
}

export function MetricCategorySection({
  icon: iconName,
  name,
  accentClass = 'chartreuse',
  metrics,
  searchTerm = '',
  defaultOpen = false,
}: MetricCategorySectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const Icon = resolveAnalyticsIcon(iconName)

  // Filtre client-side
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return metrics
    return metrics.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.hint?.toLowerCase().includes(q) ?? false),
    )
  }, [metrics, searchTerm])

  // Forcer ouvert quand l'utilisateur cherche et que la catégorie a des matches
  const isOpen = searchTerm.trim().length > 0 ? filtered.length > 0 : open

  // Si search active et zéro résultat → masquer entièrement la catégorie
  if (searchTerm.trim().length > 0 && filtered.length === 0) {
    return null
  }

  return (
    <Card variant="opaque" padding="none" className="rounded-[24px] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#0F1419]/[0.02] transition-colors"
        aria-expanded={isOpen}
      >
        <span
          aria-hidden
          className={cn(
            'inline-flex items-center justify-center size-7 rounded-md shrink-0',
            ACCENT_BG_CLASS[accentClass],
          )}
        >
          <Icon className="size-4 text-[#0F1419]" strokeWidth={1.75} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="font-sans font-semibold text-[14px] text-[#0F1419] block leading-tight">
            {name}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#0F1419]/72">
            {filtered.length} métrique{filtered.length > 1 ? 's' : ''}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'size-4 text-[#0F1419]/72 transition-transform',
            isOpen ? 'rotate-180' : 'rotate-0',
          )}
          aria-hidden
        />
      </button>

      {isOpen ? (
        <ul className="border-t border-[#0F1419]/[0.08] divide-y divide-[#0F1419]/[0.08]">
          {filtered.map((m) => {
            const MetricIcon = resolveAnalyticsIcon(m.icon)
            return (
              <li key={m.id}>
                <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#0F1419]/[0.02] transition-colors">
                  <MetricIcon className="size-4 text-[#0F1419]/72 shrink-0" strokeWidth={1.75} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#0F1419] truncate">{m.name}</p>
                    {m.hint ? (
                      <p className="text-[11px] text-[#0F1419]/72 truncate">{m.hint}</p>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-[13px] font-semibold text-[#0F1419] tabular-nums">
                      {m.value}
                    </p>
                    {m.delta ? (
                      <p
                        className={cn(
                          'font-mono text-[10px] tabular-nums',
                          deltaClass(m.deltaDirection),
                        )}
                      >
                        {m.delta}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-[#0F1419]/72 shrink-0 hidden sm:block">
                    <MiniSparkline data={m.sparkline ?? []} />
                  </div>
                  <ChevronRight className="size-3.5 text-[#0F1419]/40 shrink-0" aria-hidden />
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </Card>
  )
}
