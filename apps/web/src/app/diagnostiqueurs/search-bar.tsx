'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { searchBanAddress, type BanFeature } from '@/lib/ban'
import { Search, Loader2, MapPin, LocateFixed, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { FormEvent, KeyboardEvent } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

interface SearchBarProps {
  /** Valeur initiale du champ texte (read from searchParams.q server-side). */
  initialQuery?: string
  /** Conserver les autres searchParams non touchés (dept, cert, page). */
  preservedParams?: Record<string, string | string[] | undefined>
}

/**
 * Barre de recherche principale de l'annuaire :
 * - Input texte avec auto-suggest BAN (debounce 300ms, déclenche dès 3 caractères)
 * - Bouton "Près de chez moi" (Geolocation API avec consentement explicite)
 * - Submit → router.push avec searchParams encodés
 *
 * Les paramètres `dept`, `cert`, etc. sont préservés via `preservedParams`.
 */
export function SearchBar({ initialQuery = '', preservedParams = {} }: SearchBarProps) {
  const router = useRouter()
  const inputId = useId()
  const [value, setValue] = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<BanFeature[]>([])
  const [loadingSuggest, setLoadingSuggest] = useState(false)
  const [showSuggest, setShowSuggest] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Build searchParams string preserving filters
  const buildHref = useCallback(
    (overrides: Record<string, string | undefined>) => {
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
        if (val === undefined || val === '') params.delete(key)
        else params.set(key, val)
      }
      // Reset to page 1 on any search change
      params.delete('page')
      const s = params.toString()
      return s ? `/diagnostiqueurs?${s}` : '/diagnostiqueurs'
    },
    [preservedParams],
  )

  // Debounced BAN auto-suggest
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = value.trim()
    if (q.length < 3) {
      setSuggestions([])
      setLoadingSuggest(false)
      return
    }
    setLoadingSuggest(true)
    debounceRef.current = setTimeout(async () => {
      const feats = await searchBanAddress(q, 6)
      setSuggestions(feats)
      setLoadingSuggest(false)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value])

  // Click outside closes suggest panel
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setShowSuggest(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      router.push(buildHref({ q: value.trim() || undefined }))
      setShowSuggest(false)
    },
    [buildHref, router, value],
  )

  const handlePickSuggestion = useCallback(
    (feature: BanFeature) => {
      const label = feature.properties.label
      setValue(label)
      setShowSuggest(false)
      const postcode = feature.properties.postcode
      // Si on a un code postal, on extrait le dept (2 premiers chars, sauf DROM 97x)
      const dept = postcode
        ? postcode.startsWith('97') || postcode.startsWith('98')
          ? postcode.slice(0, 3)
          : postcode.slice(0, 2)
        : undefined
      router.push(buildHref({ q: label, dept }))
    },
    [buildHref, router],
  )

  const handleGeolocate = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocError('Géolocalisation indisponible sur ce navigateur.')
      return
    }
    setLocError(null)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const { latitude, longitude } = pos.coords
        router.push(
          buildHref({
            lat: latitude.toFixed(5),
            lng: longitude.toFixed(5),
          }),
        )
      },
      (err) => {
        setLocating(false)
        if (err.code === err.PERMISSION_DENIED) {
          setLocError('Vous avez refusé la géolocalisation.')
        } else {
          setLocError('Position introuvable. Réessayez plus tard.')
        }
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 5 * 60 * 1000 },
    )
  }, [buildHref, router])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggest || suggestions.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, -1))
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault()
        handlePickSuggestion(suggestions[activeIndex])
      } else if (e.key === 'Escape') {
        setShowSuggest(false)
        setActiveIndex(-1)
      }
    },
    [activeIndex, handlePickSuggestion, showSuggest, suggestions],
  )

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-ink-faint pointer-events-none"
            aria-hidden
          />
          <Input
            id={inputId}
            type="search"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setShowSuggest(true)
              setActiveIndex(-1)
            }}
            onFocus={() => setShowSuggest(true)}
            onKeyDown={handleKeyDown}
            placeholder="Recherche par ville, code postal ou nom du diagnostiqueur"
            className="pl-10 pr-10 h-12 text-[14px]"
            aria-label="Recherche annuaire diagnostiqueurs"
            aria-autocomplete="list"
            aria-expanded={showSuggest && suggestions.length > 0}
            aria-controls={`${inputId}-listbox`}
            autoComplete="off"
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                setValue('')
                setSuggestions([])
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors"
              aria-label="Effacer la recherche"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="lg" className="shrink-0">
            <Search className="size-4" />
            <span>Rechercher</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleGeolocate}
            disabled={locating}
            className="shrink-0"
          >
            {locating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LocateFixed className="size-4" />
            )}
            <span className="hidden sm:inline">Près de chez moi</span>
            <span className="sm:hidden">Auto</span>
          </Button>
        </div>
      </form>

      {/* Suggestions BAN */}
      {showSuggest && (suggestions.length > 0 || loadingSuggest) && (
        <div
          id={`${inputId}-listbox`}
          role="listbox"
          className="absolute z-30 left-0 right-0 sm:right-[208px] top-[calc(100%+4px)] bg-paper border border-rule rounded-lg shadow-lg overflow-hidden"
        >
          {loadingSuggest ? (
            <div className="px-4 py-3 text-[12px] text-ink-faint flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" />
              Recherche...
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {suggestions.map((feat, idx) => (
                <li key={`${feat.properties.label}-${idx}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePickSuggestion(feat)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full text-left px-4 py-2.5 flex items-start gap-2 text-[13px] transition-colors ${
                      idx === activeIndex ? 'bg-cream-deep text-ink' : 'text-ink-mute hover:bg-cream-deep/60'
                    }`}
                    role="option"
                    aria-selected={idx === activeIndex}
                  >
                    <MapPin className="size-3.5 mt-0.5 shrink-0 text-ink-faint" aria-hidden />
                    <span className="truncate">{feat.properties.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {locError && (
        <p className="mt-2 text-[12px] text-coral" role="alert">
          {locError}
        </p>
      )}
    </div>
  )
}
