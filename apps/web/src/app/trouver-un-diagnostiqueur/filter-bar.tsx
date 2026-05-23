'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DIAG_CERTS, type DiagCertCode } from '@/lib/diag-certifications'
import { FR_REGIONS } from '@/lib/fr-departments'
import { ChevronDown, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

interface FilterBarProps {
  /** Code département présent dans l'URL (?dept=75). */
  dept?: string
  /** Liste de certifications actives dans l'URL (?cert=DPE&cert=AM). */
  certs: DiagCertCode[]
  /** Distance max en km si géoloc active (?dist=20). */
  distance?: number
  /** Indique si l'utilisateur a partagé sa position (active le slider). */
  hasGeo: boolean
  /** Autres params à préserver (q, lat, lng, page reset). */
  preservedParams: Record<string, string | string[] | undefined>
}

const DISTANCE_OPTIONS = [5, 10, 20, 50] as const

/**
 * Barre de filtres horizontaux : département · certifications · distance.
 *
 * Chaque interaction = mutation immédiate de l'URL via `router.push`.
 * Le bouton "Effacer filtres" n'apparaît que si au moins un filtre est actif.
 */
export function FilterBar({ dept, certs, distance, hasGeo, preservedParams }: FilterBarProps) {
  const router = useRouter()
  const [deptOpen, setDeptOpen] = useState(false)

  const buildHref = useCallback(
    (overrides: Record<string, string | string[] | undefined>) => {
      const params = new URLSearchParams()
      for (const [key, val] of Object.entries(preservedParams)) {
        if (val === undefined || val === null) continue
        if (Array.isArray(val)) {
          for (const v of val) params.append(key, v)
        } else {
          params.set(key, val)
        }
      }
      for (const [key, val] of Object.entries(overrides)) {
        params.delete(key)
        if (val === undefined || val === '') continue
        if (Array.isArray(val)) {
          for (const v of val) params.append(key, v)
        } else {
          params.set(key, val)
        }
      }
      // Reset to page 1 on any filter change
      params.delete('page')
      const s = params.toString()
      return s ? `/trouver-un-diagnostiqueur?${s}` : '/trouver-un-diagnostiqueur'
    },
    [preservedParams],
  )

  const handleDeptChange = useCallback(
    (newDept: string | undefined) => {
      setDeptOpen(false)
      router.push(buildHref({ dept: newDept }))
    },
    [buildHref, router],
  )

  const handleCertToggle = useCallback(
    (code: DiagCertCode) => {
      const next = certs.includes(code) ? certs.filter((c) => c !== code) : [...certs, code]
      router.push(buildHref({ cert: next.length > 0 ? next : undefined }))
    },
    [buildHref, certs, router],
  )

  const handleDistance = useCallback(
    (km: number | undefined) => {
      router.push(buildHref({ dist: km !== undefined ? String(km) : undefined }))
    },
    [buildHref, router],
  )

  const handleClearAll = useCallback(() => {
    // On garde uniquement q + lat/lng + page si non-filtres
    const keep: Record<string, string | string[] | undefined> = {}
    for (const k of ['q', 'lat', 'lng']) {
      if (preservedParams[k] !== undefined) keep[k] = preservedParams[k]
    }
    const params = new URLSearchParams()
    for (const [key, val] of Object.entries(keep)) {
      if (val === undefined) continue
      if (Array.isArray(val)) val.forEach((v) => params.append(key, v))
      else params.set(key, val)
    }
    const s = params.toString()
    router.push(s ? `/trouver-un-diagnostiqueur?${s}` : '/trouver-un-diagnostiqueur')
  }, [preservedParams, router])

  const hasActiveFilters = useMemo(
    () => !!dept || certs.length > 0 || distance !== undefined,
    [dept, certs, distance],
  )

  const deptLabel = useMemo(() => {
    if (!dept) return 'Tous les départements'
    const region = FR_REGIONS.find((r) => r.departments.some((d) => d.code === dept))
    const found = region?.departments.find((d) => d.code === dept)
    return found ? `${found.code} · ${found.name}` : `Département ${dept}`
  }, [dept])

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Dept select (native button + dropdown panel) */}
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDeptOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={deptOpen}
        >
          <span className="truncate max-w-[180px]">{deptLabel}</span>
          <ChevronDown className="size-3.5" />
        </Button>
        {deptOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-20 cursor-default"
              onClick={() => setDeptOpen(false)}
              aria-label="Fermer la liste des départements"
            />
            <div className="absolute z-30 mt-2 left-0 w-72 max-h-96 overflow-y-auto bg-paper border border-rule rounded-lg shadow-lg p-2">
              <button
                type="button"
                onClick={() => handleDeptChange(undefined)}
                className={`w-full text-left px-3 py-2 text-[12px] rounded-md transition-colors ${
                  !dept
                    ? 'bg-cream-deep text-ink font-semibold'
                    : 'text-ink-mute hover:bg-cream-deep/60'
                }`}
              >
                Tous les départements
              </button>
              {FR_REGIONS.map((region) => (
                <div key={region.name} className="mt-2 first:mt-0">
                  <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide font-display font-semibold text-ink-faint">
                    {region.name}
                  </div>
                  {region.departments.map((d) => (
                    <button
                      key={d.code}
                      type="button"
                      onClick={() => handleDeptChange(d.code)}
                      className={`w-full text-left px-3 py-1.5 text-[12px] rounded-md transition-colors flex items-center gap-2 ${
                        dept === d.code
                          ? 'bg-cream-deep text-ink font-semibold'
                          : 'text-ink-mute hover:bg-cream-deep/60'
                      }`}
                    >
                      <span className="font-mono text-[11px] text-ink-faint shrink-0 w-7">
                        {d.code}
                      </span>
                      <span className="truncate">{d.name}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Cert multi-select chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {DIAG_CERTS.map((c) => {
          const active = certs.includes(c.code)
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => handleCertToggle(c.code)}
              aria-pressed={active}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 rounded-pill"
            >
              <Badge
                variant={active ? 'default' : 'outline'}
                className="cursor-pointer transition-colors"
              >
                {c.short}
              </Badge>
            </button>
          )
        })}
      </div>

      {/* Distance slider visible only with geoloc */}
      {hasGeo && (
        <div className="flex items-center gap-2 ml-1">
          <span className="text-[11px] uppercase tracking-wide font-display font-semibold text-ink-faint">
            Distance
          </span>
          <div className="flex items-center gap-1">
            {DISTANCE_OPTIONS.map((km) => {
              const active = distance === km
              return (
                <button
                  key={km}
                  type="button"
                  onClick={() => handleDistance(active ? undefined : km)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-pill border transition-colors ${
                    active
                      ? 'bg-navy text-paper border-navy'
                      : 'bg-paper/80 text-ink-mute border-rule hover:bg-cream-deep'
                  }`}
                >
                  {km} km
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Clear all */}
      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          className="ml-auto"
        >
          <X className="size-3.5" />
          Effacer les filtres
        </Button>
      )}
    </div>
  )
}
