'use client'

/**
 * AppListToolbar — Barre d'outils standard pour toutes les pages liste
 * (clients / properties / dossiers / etc.).
 *
 * Stratégie URL-driven :
 * - Search synchronisée avec `?q=...` (debounce 300ms)
 * - Filtres synchronisés avec `?<filter.key>=...`
 * - Pagination via `?page=N`
 *
 * Conventions :
 * - Touch friendly : min-height 44px sur input, 40px sur boutons pagination
 * - DS V5 : sage / dark / chartreuse, radius 16, pas de shadow décoratif
 * - Mobile-first : stack vertical < sm, horizontal ≥ sm
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { PAGE_PARAM, SEARCH_PARAM } from './app-list-toolbar-utils'

// Re-export pour rétro-compat des imports existants (server components devraient
// désormais importer directement depuis './app-list-toolbar-utils').
export {
  parseListSearchParams,
  type ParsedListParams,
} from './app-list-toolbar-utils'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterDef {
  /** Clé utilisée pour le query param (`?<key>=...`). */
  key: string
  /** Label affiché en première option (placeholder). */
  label: string
  options: FilterOption[]
}

export interface AppListToolbarProps {
  /** Placeholder du champ de recherche. */
  searchPlaceholder?: string
  /** Nombre total de résultats (utilisé pour pagination + compteur). */
  totalCount?: number
  /** Page courante (1-indexed). */
  currentPage?: number
  /** Taille de page (utilisée pour calculer le nombre de pages). */
  pageSize?: number
  /** Filtres optionnels (selects natifs). */
  filters?: FilterDef[]
  /** Slot bouton primaire (ex: "Nouveau client"). */
  primaryAction?: ReactNode
  /** Classe additionnelle sur le container. */
  className?: string
}

const DEBOUNCE_MS = 300

export function AppListToolbar({
  searchPlaceholder = 'Rechercher…',
  totalCount,
  currentPage = 1,
  pageSize = 25,
  filters = [],
  primaryAction,
  className,
}: AppListToolbarProps): ReactNode {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const initialQuery = searchParams.get(SEARCH_PARAM) ?? ''
  const [query, setQuery] = useState<string>(initialQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPushedQueryRef = useRef<string>(initialQuery)

  // Resync local input si l'URL change via navigation (back/forward).
  useEffect(() => {
    const urlQuery = searchParams.get(SEARCH_PARAM) ?? ''
    if (urlQuery !== lastPushedQueryRef.current) {
      setQuery(urlQuery)
      lastPushedQueryRef.current = urlQuery
    }
  }, [searchParams])

  const buildHref = useCallback(
    (overrides: Record<string, string | null>): string => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(overrides)) {
        if (value === null || value === '') {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }
      const qs = params.toString()
      return qs ? `${pathname}?${qs}` : pathname
    },
    [pathname, searchParams],
  )

  const pushQuery = useCallback(
    (next: string) => {
      lastPushedQueryRef.current = next
      // Reset page à 1 dès qu'on change de recherche.
      const href = buildHref({ [SEARCH_PARAM]: next || null, [PAGE_PARAM]: null })
      router.replace(href, { scroll: false })
    },
    [buildHref, router],
  )

  const onSearchChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        pushQuery(value)
      }, DEBOUNCE_MS)
    },
    [pushQuery],
  )

  const onSearchClear = useCallback(() => {
    setQuery('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    pushQuery('')
  }, [pushQuery])

  const onFilterChange = useCallback(
    (filterKey: string, value: string) => {
      // Reset page à 1 dès qu'on change de filtre.
      const href = buildHref({ [filterKey]: value || null, [PAGE_PARAM]: null })
      router.replace(href, { scroll: false })
    },
    [buildHref, router],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const totalPages = useMemo<number>(() => {
    if (totalCount === undefined || totalCount <= 0 || pageSize <= 0) return 1
    return Math.max(1, Math.ceil(totalCount / pageSize))
  }, [totalCount, pageSize])

  const prevHref = useMemo<string>(
    () => buildHref({ [PAGE_PARAM]: currentPage > 2 ? String(currentPage - 1) : null }),
    [buildHref, currentPage],
  )
  const nextHref = useMemo<string>(
    () => buildHref({ [PAGE_PARAM]: String(currentPage + 1) }),
    [buildHref, currentPage],
  )

  const showPagination =
    totalCount !== undefined && totalCount > pageSize && totalPages > 1

  return (
    <div
      className={cn(
        'bg-paper border border-[#0F1419]/[0.08] rounded-[16px] p-4 space-y-3',
        className,
      )}
    >
      {/* Ligne 1 : search + filtres + action */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Search bar */}
        <div className="relative flex-1 min-w-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-faint pointer-events-none"
            aria-hidden="true"
          />
          <Input
            type="search"
            inputMode="search"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-10"
            aria-label={searchPlaceholder}
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={onSearchClear}
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2',
                'flex items-center justify-center size-8 rounded-full',
                'text-ink-faint hover:text-ink hover:bg-ink/5 transition-colors',
              )}
              aria-label="Effacer la recherche"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Filtres + action — scroll horizontal sur mobile */}
        {(filters.length > 0 || primaryAction) && (
          <div
            className={cn(
              'flex items-center gap-2',
              'overflow-x-auto sm:overflow-visible',
              '-mx-1 px-1 sm:m-0 sm:p-0',
              'snap-x snap-mandatory sm:snap-none',
            )}
          >
            {filters.map((filter) => {
              const value = searchParams.get(filter.key) ?? ''
              return (
                <div
                  key={filter.key}
                  className="shrink-0 snap-start min-w-[140px] sm:min-w-[160px]"
                >
                  <Select
                    value={value}
                    onChange={(e) => onFilterChange(filter.key, e.target.value)}
                    aria-label={filter.label}
                  >
                    <option value="">{filter.label}</option>
                    {filter.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>
              )
            })}
            {primaryAction && <div className="shrink-0">{primaryAction}</div>}
          </div>
        )}
      </div>

      {/* Ligne 2 : compteur + pagination */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-mute">
          {totalCount === undefined
            ? ' '
            : totalCount === 0
              ? 'Aucun résultat'
              : `${totalCount} résultat${totalCount > 1 ? 's' : ''}`}
        </p>

        {showPagination && (
          <nav
            className="flex items-center gap-2"
            aria-label="Pagination"
          >
            <Button
              asChild={currentPage > 1}
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              className="min-h-[40px]"
            >
              {currentPage > 1 ? (
                <a href={prevHref} aria-label="Page précédente">
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  Précédent
                </a>
              ) : (
                <span>
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  Précédent
                </span>
              )}
            </Button>

            <span className="font-mono text-[11px] text-ink-mute px-2 whitespace-nowrap">
              Page {currentPage} / {totalPages}
            </span>

            <Button
              asChild={currentPage < totalPages}
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              className="min-h-[40px]"
            >
              {currentPage < totalPages ? (
                <a href={nextHref} aria-label="Page suivante">
                  Suivant
                  <ChevronRight className="size-4" aria-hidden="true" />
                </a>
              ) : (
                <span>
                  Suivant
                  <ChevronRight className="size-4" aria-hidden="true" />
                </span>
              )}
            </Button>
          </nav>
        )}
      </div>
    </div>
  )
}

// parseListSearchParams et ParsedListParams sont re-exportés en tête de
// fichier depuis './app-list-toolbar-utils' (séparation client/server).
