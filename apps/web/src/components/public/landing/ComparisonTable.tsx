import { cn } from '@/lib/utils'
import { Check, Minus, X } from 'lucide-react'

export type ComparisonCell = 'yes' | 'no' | 'partial' | { text: string }

export interface ComparisonRow {
  feature: string
  competitors: [ComparisonCell, ComparisonCell, ComparisonCell]
  kovas: ComparisonCell
}

interface ComparisonTableProps {
  eyebrow?: string
  title: string
  subtitle?: string
  rows: ComparisonRow[]
  footnote?: string
}

function CellRenderer({ value, highlight = false }: { value: ComparisonCell; highlight?: boolean }) {
  if (value === 'yes') {
    return (
      <Check
        className={cn('size-4 mx-auto', highlight ? 'text-chartreuse-deep' : 'text-success')}
        aria-label="Inclus"
      />
    )
  }
  if (value === 'no') {
    return <X className="size-4 mx-auto text-ink-faint/70" aria-label="Non inclus" />
  }
  if (value === 'partial') {
    return <Minus className="size-4 mx-auto text-ink-mute" aria-label="Partiel" />
  }
  return (
    <span className={cn('text-xs font-mono', highlight ? 'text-chartreuse-deep font-semibold' : 'text-ink-mute')}>
      {value.text}
    </span>
  )
}

/**
 * Tableau comparatif KOVAS vs concurrents anonymisés.
 * Réservé B2B (logique : produit SaaS).
 */
export function ComparisonTable({
  eyebrow,
  title,
  subtitle,
  rows,
  footnote,
}: ComparisonTableProps) {
  return (
    <section className="px-6 py-20 md:py-24 bg-sage">
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          {eyebrow && (
            <p className="text-xs font-mono uppercase tracking-wider text-ink-faint">{eyebrow}</p>
          )}
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="text-ink-mute leading-relaxed">{subtitle}</p>}
        </div>

        <div className="overflow-x-auto rounded-xl border border-ink/10 bg-paper">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-sage-alt border-b border-ink/10">
                <th
                  scope="col"
                  className="text-left text-xs font-mono uppercase tracking-wider text-ink-faint px-5 py-4"
                >
                  Fonctionnalité
                </th>
                <th
                  scope="col"
                  className="text-center text-xs font-mono uppercase tracking-wider text-ink-faint px-3 py-4"
                >
                  Logiciel A
                </th>
                <th
                  scope="col"
                  className="text-center text-xs font-mono uppercase tracking-wider text-ink-faint px-3 py-4"
                >
                  Logiciel B
                </th>
                <th
                  scope="col"
                  className="text-center text-xs font-mono uppercase tracking-wider text-ink-faint px-3 py-4"
                >
                  Logiciel C
                </th>
                <th
                  scope="col"
                  className="text-center text-xs font-mono uppercase tracking-wider text-chartreuse-deep px-3 py-4 bg-chartreuse-soft/40"
                >
                  KOVAS 360
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.feature}
                  className={cn(
                    'border-b border-ink/5 last:border-0',
                    i % 2 === 1 && 'bg-sage/30',
                  )}
                >
                  <th
                    scope="row"
                    className="text-left font-medium text-ink-soft px-5 py-3.5"
                  >
                    {r.feature}
                  </th>
                  <td className="text-center px-3 py-3.5">
                    <CellRenderer value={r.competitors[0]} />
                  </td>
                  <td className="text-center px-3 py-3.5">
                    <CellRenderer value={r.competitors[1]} />
                  </td>
                  <td className="text-center px-3 py-3.5">
                    <CellRenderer value={r.competitors[2]} />
                  </td>
                  <td className="text-center px-3 py-3.5 bg-chartreuse-soft/30">
                    <CellRenderer value={r.kovas} highlight />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {footnote && <p className="text-xs text-ink-faint text-center">{footnote}</p>}
      </div>
    </section>
  )
}
