'use client'

/**
 * <AnalyticsSearchBar> — Search-as-you-type pour filtrer les métriques par nom.
 *
 * Client component avec debounce 100ms. Pattern : la valeur debouncée remonte
 * au parent via callback `onChange`. Le parent transmet le terme à chaque
 * <MetricCategorySection searchTerm={...}> qui filtre côté client ses lignes.
 *
 * UX : input sticky en haut, icône loupe Lucide, placeholder sobre.
 */

import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface AnalyticsSearchBarProps {
  /** Callback de la valeur debouncée (filtre client-side). */
  onChange: (value: string) => void
  /** Placeholder personnalisé. */
  placeholder?: string
}

export function AnalyticsSearchBar({
  onChange,
  placeholder = 'Rechercher une métrique…',
}: AnalyticsSearchBarProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      onChange(value)
    }, 100)
    return () => clearTimeout(t)
  }, [value, onChange])

  return (
    <div className="sticky top-0 z-10 -mx-2 sm:mx-0">
      <div className="relative mx-2 sm:mx-0">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-ink-mute pointer-events-none"
          aria-hidden
        />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-11 pr-10 py-2.5 rounded-full bg-paper border border-rule/60 shadow-sm text-[13px] text-ink placeholder:text-ink-ghost focus:outline-none focus:ring-2 focus:ring-chartreuse/40 focus:border-chartreuse-deep transition-all"
          aria-label="Rechercher une métrique"
        />
        {value ? (
          <button
            type="button"
            onClick={() => setValue('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 size-7 inline-flex items-center justify-center rounded-full text-ink-mute hover:text-ink hover:bg-ink/5 transition-colors"
            aria-label="Effacer la recherche"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
