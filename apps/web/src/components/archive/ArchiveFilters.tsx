'use client'

/**
 * ArchiveFilters — filtres "Mes fichiers" pilotés par les query params URL.
 *
 * Pattern : chaque sélection update l'URL via `router.replace`, ce qui re-render
 * la page server qui re-fetch les fichiers. Pas de state local persistant —
 * single source of truth = URL.
 *
 * Style : pillules sobres, sage / dark / chartreuse (palette v5).
 */

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  ARCHIVE_DIAGNOSTIC_LABELS,
  ARCHIVE_KIND_LABELS,
  type ArchiveDiagnostic,
  type ArchiveFileKind,
  type ArchiveQuery,
} from '@/lib/archive/types'
import { Search } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'

interface ClientOption {
  id: string
  display_name: string
}

interface ArchiveFiltersProps {
  clients: ClientOption[]
}

const KIND_OPTIONS: Array<{ value: ArchiveFileKind | 'all'; label: string }> = [
  { value: 'all', label: 'Tous les fichiers' },
  { value: 'photo', label: ARCHIVE_KIND_LABELS.photo + 's' },
  { value: 'audio', label: 'Audio' },
  { value: 'document', label: 'Documents' },
  { value: 'export', label: 'Exports PDF / ZIP' },
]

const PERIOD_OPTIONS: Array<{ value: ArchiveQuery['period']; label: string }> = [
  { value: 'all', label: 'Toutes périodes' },
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
  { value: '12m', label: '12 derniers mois' },
  { value: '2025', label: 'Année 2025' },
  { value: '2024', label: 'Année 2024' },
  { value: '2023', label: 'Année 2023' },
]

const DIAGNOSTIC_OPTIONS: Array<{ value: ArchiveDiagnostic | 'all'; label: string }> = [
  { value: 'all', label: 'Tous diagnostics' },
  ...(Object.entries(ARCHIVE_DIAGNOSTIC_LABELS) as Array<[ArchiveDiagnostic, string]>).map(
    ([value, label]) => ({ value, label }),
  ),
]

export function ArchiveFilters({ clients }: ArchiveFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [searchValue, setSearchValue] = useState<string>(() => searchParams.get('q') ?? '')

  // Synchronise l'input search avec l'URL (back/forward)
  useEffect(() => {
    setSearchValue(searchParams.get('q') ?? '')
  }, [searchParams])

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams.toString())
      if (value === null || value === '' || value === 'all') {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      next.delete('page') // reset pagination dès qu'un filtre change
      startTransition(() => {
        router.replace(`/dashboard/archive?${next.toString()}`)
      })
    },
    [router, searchParams],
  )

  // Debounce recherche texte (300 ms)
  useEffect(() => {
    const current = searchParams.get('q') ?? ''
    if (current === searchValue) return
    const timeout = setTimeout(() => {
      updateParam('q', searchValue || null)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchValue, searchParams, updateParam])

  const currentKind = searchParams.get('type') ?? 'all'
  const currentPeriod = searchParams.get('period') ?? 'all'
  const currentClient = searchParams.get('client_id') ?? ''
  const currentDiag = searchParams.get('diagnostic') ?? 'all'

  return (
    <div className="rounded-2xl border border-rule/80 glass-opaque p-4 md:p-5 space-y-3 shadow-glass-sm">
      {/* Ligne 1 : recherche */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-mute pointer-events-none"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Rechercher un nom de fichier ou un mot dans la transcription..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-9"
          aria-label="Rechercher dans mes fichiers"
        />
      </div>

      {/* Ligne 2 : selects en grille responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Select
          value={currentKind}
          onChange={(e) => updateParam('type', e.target.value)}
          aria-label="Type de fichier"
        >
          {KIND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          value={currentPeriod}
          onChange={(e) => updateParam('period', e.target.value)}
          aria-label="Période"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          value={currentClient}
          onChange={(e) => updateParam('client_id', e.target.value || null)}
          aria-label="Client"
        >
          <option value="">Tous les clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </Select>

        <Select
          value={currentDiag}
          onChange={(e) => updateParam('diagnostic', e.target.value)}
          aria-label="Diagnostic"
        >
          {DIAGNOSTIC_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}
