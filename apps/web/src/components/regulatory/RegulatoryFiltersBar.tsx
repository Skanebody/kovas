'use client'

/**
 * Barre de filtres pour la veille réglementaire.
 *
 * Pilote les query params via le router Next. Sticky en colonne gauche desktop.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ALL_DOC_TYPES,
  ALL_IMPORTANCES,
  ALL_MODULES,
  DOC_TYPE_LABEL,
  IMPORTANCE_LABEL,
  MODULE_LABEL,
  type RegulatoryDocType,
  type RegulatoryImportance,
  type RegulatoryModule,
} from '@/lib/regulatory/types'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'

interface Filters {
  modules: RegulatoryModule[]
  docTypes: RegulatoryDocType[]
  importance: RegulatoryImportance[]
  dateFrom: string
  dateTo: string
}

interface RegulatoryFiltersBarProps {
  initial: Filters
}

function setParam(
  params: URLSearchParams,
  key: string,
  values: string[] | string | undefined,
): void {
  if (Array.isArray(values)) {
    if (values.length === 0) params.delete(key)
    else params.set(key, values.join(','))
  } else if (typeof values === 'string' && values.length > 0) {
    params.set(key, values)
  } else {
    params.delete(key)
  }
}

export function RegulatoryFiltersBar({ initial }: RegulatoryFiltersBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const apply = useCallback(
    (next: Partial<Filters>) => {
      const params = new URLSearchParams(searchParams.toString())
      const merged: Filters = {
        modules: next.modules ?? initial.modules,
        docTypes: next.docTypes ?? initial.docTypes,
        importance: next.importance ?? initial.importance,
        dateFrom: next.dateFrom ?? initial.dateFrom,
        dateTo: next.dateTo ?? initial.dateTo,
      }
      setParam(params, 'modules', merged.modules)
      setParam(params, 'doc_types', merged.docTypes)
      setParam(params, 'importance', merged.importance)
      setParam(params, 'date_from', merged.dateFrom)
      setParam(params, 'date_to', merged.dateTo)
      startTransition(() => {
        router.push(`/dashboard/veille${params.toString() ? `?${params.toString()}` : ''}`)
      })
    },
    [initial, router, searchParams],
  )

  const toggle = useCallback(
    <T extends string>(list: T[], value: T): T[] =>
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    [],
  )

  return (
    <aside className="space-y-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto pr-1">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint mb-2">
          Modules
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_MODULES.map((m) => {
            const on = initial.modules.includes(m)
            return (
              <button
                key={m}
                type="button"
                onClick={() => apply({ modules: toggle(initial.modules, m) })}
                className={`rounded-pill border px-3 py-1.5 text-[11px] font-medium transition-colors duration-fast ${
                  on
                    ? 'bg-[#0F1419] text-white border-[#0F1419]'
                    : 'bg-paper text-ink border-rule hover:bg-sage-alt'
                }`}
              >
                {MODULE_LABEL[m]}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint mb-2">
          Type de document
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_DOC_TYPES.map((t) => {
            const on = initial.docTypes.includes(t)
            return (
              <button
                key={t}
                type="button"
                onClick={() => apply({ docTypes: toggle(initial.docTypes, t) })}
                className={`rounded-pill border px-3 py-1.5 text-[11px] font-medium transition-colors duration-fast ${
                  on
                    ? 'bg-[#0F1419] text-white border-[#0F1419]'
                    : 'bg-paper text-ink border-rule hover:bg-sage-alt'
                }`}
              >
                {DOC_TYPE_LABEL[t]}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint mb-2">
          Importance
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_IMPORTANCES.map((u) => {
            const on = initial.importance.includes(u)
            return (
              <button
                key={u}
                type="button"
                onClick={() => apply({ importance: toggle(initial.importance, u) })}
                className={`rounded-pill border px-3 py-1.5 text-[11px] font-medium transition-colors duration-fast ${
                  on
                    ? 'bg-[#0F1419] text-white border-[#0F1419]'
                    : 'bg-paper text-ink border-rule hover:bg-sage-alt'
                }`}
              >
                {IMPORTANCE_LABEL[u]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          Période de publication
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-ink-mute" htmlFor="reg-date-from">
              Du
            </label>
            <Input
              id="reg-date-from"
              type="date"
              defaultValue={initial.dateFrom}
              onBlur={(e) => apply({ dateFrom: e.target.value })}
              className="text-[12px] min-h-[40px]"
            />
          </div>
          <div>
            <label className="text-[11px] text-ink-mute" htmlFor="reg-date-to">
              Au
            </label>
            <Input
              id="reg-date-to"
              type="date"
              defaultValue={initial.dateTo}
              onBlur={(e) => apply({ dateTo: e.target.value })}
              className="text-[12px] min-h-[40px]"
            />
          </div>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          apply({
            modules: [],
            docTypes: [],
            importance: [],
            dateFrom: '',
            dateTo: '',
          })
        }
        className="w-full justify-center"
      >
        Réinitialiser les filtres
      </Button>
    </aside>
  )
}
