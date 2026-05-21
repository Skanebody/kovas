'use client'

/**
 * <AnalyticsBrowser> — Client wrapper orchestrant la search bar + les sections
 * catégorielles. Reçoit les métriques pré-calculées côté serveur et gère l'état
 * du search côté client.
 *
 * Architecture :
 *   <AnalyticsBrowser categories={...}>
 *     <AnalyticsSearchBar onChange={setQuery} />
 *     {categories.map => <MetricCategorySection searchTerm={query} />}
 *     {emptyState if zero match across all sections}
 */

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { MetricCategorySection } from './metric-category-section'
import { AnalyticsSearchBar } from './search-bar'

/* Helper type — récupère le type des props effectifs de MetricCategorySection. */
type CategoryInput = Omit<Parameters<typeof MetricCategorySection>[0], 'searchTerm'>

interface AnalyticsBrowserProps {
  categories: CategoryInput[]
}

export function AnalyticsBrowser({ categories }: AnalyticsBrowserProps) {
  const [query, setQuery] = useState('')

  // Préfiltre : on calcule combien de catégories matchent pour afficher empty state.
  const hasMatches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return categories.some((c) =>
      c.metrics.some(
        (m) => m.name.toLowerCase().includes(q) || (m.hint?.toLowerCase().includes(q) ?? false),
      ),
    )
  }, [query, categories])

  return (
    <div className="space-y-4">
      <AnalyticsSearchBar onChange={setQuery} />

      {hasMatches ? (
        <div className="space-y-3">
          {categories.map((cat, i) => (
            <MetricCategorySection
              key={cat.id}
              {...cat}
              searchTerm={query}
              defaultOpen={i === 0 && !query}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <Search className="size-8 text-ink-ghost" strokeWidth={1.5} />
          <p className="text-sm text-ink-mute">
            Aucune métrique ne correspond à <span className="font-mono">«{query}»</span>.
          </p>
        </div>
      )}
    </div>
  )
}

export type { CategoryInput }
