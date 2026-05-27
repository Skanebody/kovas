'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { type BanFeature, searchBanAddress } from '@/lib/ban'
import { Loader2, LocateFixed, MapPin, Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { FormEvent, KeyboardEvent } from 'react'
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

interface SearchBarProps {
  /** Valeur initiale du champ texte (read from searchParams.q server-side). */
  initialQuery?: string
  /** Conserver les autres searchParams non touchés (dept, cert, page). */
  preservedParams?: Record<string, string | string[] | undefined>
}

/** Délai de debounce du fetch BAN (ms). Plus court = UX plus réactive. */
const BAN_DEBOUNCE_MS = 200
/** Longueur min de saisie pour déclencher une suggestion. */
const MIN_QUERY_LEN = 3

/**
 * Echappe les caractères regex spéciaux d'une string pour usage en RegExp.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Découpe `label` en segments en mettant en évidence les portions correspondant
 * à `query` (case-insensitive, accents indifférents). Le rendu utilise `<mark>`
 * pour la sémantique + une classe de gras sobre.
 */
function highlightMatch(label: string, query: string): Array<{ text: string; match: boolean }> {
  const q = query.trim()
  if (q.length < 1) return [{ text: label, match: false }]
  // Normalise accents pour matcher "ecole" et "école" — Unicode property
  // escape `\p{Mn}` (Mark, Nonspacing = diacritiques combinants) avec flag `u`
  // pour rester valide Biome (pas de char combinant inline dans une class char).
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Mn}/gu, '')
      .toLowerCase()
  const normalizedLabel = normalize(label)
  const normalizedQuery = normalize(q)
  if (!normalizedQuery) return [{ text: label, match: false }]

  // Construit un regex qui matche n'importe quelle occurrence (mot ou substring).
  const pattern = new RegExp(escapeRegex(normalizedQuery), 'gi')
  const segments: Array<{ text: string; match: boolean }> = []
  let cursor = 0

  // Itère sur les matchs en travaillant sur la version normalisée (mêmes index
  // que l'original puisque diacritiques = 0 char added dans NFD->stripped).
  for (let m = pattern.exec(normalizedLabel); m !== null; m = pattern.exec(normalizedLabel)) {
    if (m.index > cursor) {
      segments.push({ text: label.slice(cursor, m.index), match: false })
    }
    segments.push({ text: label.slice(m.index, m.index + m[0].length), match: true })
    cursor = m.index + m[0].length
    if (m.index === pattern.lastIndex) pattern.lastIndex++ // évite boucle infinie
  }
  if (cursor < label.length) {
    segments.push({ text: label.slice(cursor), match: false })
  }
  return segments.length > 0 ? segments : [{ text: label, match: false }]
}

/**
 * Barre de recherche principale de l'annuaire :
 * - Input texte avec auto-suggest BAN (debounce 200ms, déclenche dès 3 caractères)
 * - Bouton "Près de chez moi" (Geolocation API avec consentement explicite)
 * - Submit → router.push avec searchParams encodés
 *
 * Le panel dropdown reste ouvert tant que l'input a le focus + ≥3 chars,
 * affiche état loading / résultats / empty state ("Aucune adresse trouvée").
 * Match utilisateur surligné en gras (case + accents insensibles).
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
  /** True dès qu'une recherche a abouti (success ou empty) pour distinguer
   * "pas encore demandé" vs "résultats vides → afficher empty state". */
  const [hasFetched, setHasFetched] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Identifiant de la dernière requête en vol — protège contre les
   * race conditions (réponse lente d'une frappe antérieure). */
  const lastRequestId = useRef(0)
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
      return s ? `/trouver-un-diagnostiqueur?${s}` : '/trouver-un-diagnostiqueur'
    },
    [preservedParams],
  )

  // Debounced BAN auto-suggest — debounce 200ms + protection race condition.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = value.trim()
    if (q.length < MIN_QUERY_LEN) {
      setSuggestions([])
      setLoadingSuggest(false)
      setHasFetched(false)
      return
    }
    setLoadingSuggest(true)
    const requestId = ++lastRequestId.current
    debounceRef.current = setTimeout(async () => {
      const feats = await searchBanAddress(q, 6)
      // Ignorer si une frappe plus récente est arrivée pendant l'await
      if (requestId !== lastRequestId.current) return
      setSuggestions(feats)
      setLoadingSuggest(false)
      setHasFetched(true)
    }, BAN_DEBOUNCE_MS)
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
      // L'UI conserve le label complet dans l'input pour le retour visuel,
      // mais le `q` envoyé au serveur est nettoyé (cf. ci-dessous).
      setValue(label)
      setShowSuggest(false)
      const postcode = feature.properties.postcode
      // Si on a un code postal, on extrait le dept (2 premiers chars, sauf DROM 97x/98x)
      const dept = postcode
        ? postcode.startsWith('97') || postcode.startsWith('98')
          ? postcode.slice(0, 3)
          : postcode.slice(0, 2)
        : undefined
      // BAN renvoie [lng, lat] (ordre GeoJSON). On les pousse en URL pour que
      // la recherche serveur applique le pipeline d'élargissement progressif
      // (20 km → 50 → 100 → dept → national, garantit toujours ≥1 résultat).
      const [lng, lat] = feature.geometry.coordinates
      // BUG-FIX (recherche par adresse vide) : on NE POUSSE PAS le `label` complet
      // dans `?q=` car la RPC `search_diagnosticians` filtre texte sur
      // full_name/city/address/postcode avec ILIKE. Le label BAN ressemble à
      // "12 Rue de la Paix, 76540 Ouville-La-Rivière" et aucun diag n'a un de
      // ces champs qui contient cette string entière → 0 résultat même au
      // niveau national. Avec lat/lng disponibles, le filtre géo suffit ; on
      // utilise au mieux `feature.properties.city` pour aider à l'affinage.
      const cityForQuery = feature.properties.city ?? undefined
      router.push(
        buildHref({
          // q optionnel : la ville (propre) si dispo, sinon rien — la géoloc
          // pilote la recherche, l'élargissement progressif fait le reste.
          q: cityForQuery,
          dept,
          lat: Number.isFinite(lat) ? lat.toFixed(5) : undefined,
          lng: Number.isFinite(lng) ? lng.toFixed(5) : undefined,
          // Pas de `dist` : laissé au serveur (qui démarre à 20 km).
          dist: undefined,
        }),
      )
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
          setLocError('Tu as refusé la géolocalisation.')
        } else {
          setLocError('Position introuvable. Réessaie plus tard.')
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

  /** Doit-on rendre le panel ? Conditions : focus + ≥3 chars saisis ET
   * (loading OU suggestions non vides OU une requête a été faite = on connaît
   * le résultat même vide → empty state). */
  const trimmedValue = value.trim()
  const hasMinChars = trimmedValue.length >= MIN_QUERY_LEN
  const shouldRenderPanel =
    showSuggest && hasMinChars && (loadingSuggest || suggestions.length > 0 || hasFetched)

  // Memo highlights pour éviter recalcul à chaque hover (activeIndex change)
  const highlightedSuggestions = useMemo(
    () =>
      suggestions.map((feat) => ({
        feat,
        segments: highlightMatch(feat.properties.label, trimmedValue),
      })),
    [suggestions, trimmedValue],
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
            aria-expanded={shouldRenderPanel}
            aria-controls={`${inputId}-listbox`}
            autoComplete="off"
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                setValue('')
                setSuggestions([])
                setHasFetched(false)
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

      {/* Suggestions BAN — slide-down 150ms à l'apparition.
       * Pattern combobox ARIA APG (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) :
       * listbox custom (pas <select> natif) car l'input doit garder le focus
       * pendant la navigation au clavier. tabIndex=-1 = focusable programmatique
       * mais retiré de la tab order — clavier via input + aria-activedescendant. */}
      {shouldRenderPanel && (
        <div
          id={`${inputId}-listbox`}
          // biome-ignore lint/a11y/useSemanticElements: combobox custom (input + listbox), pas un <select> natif
          // biome-ignore lint/a11y/useFocusableInteractive: tabIndex=-1 ci-dessous rend le listbox focusable programmatique
          role="listbox"
          tabIndex={-1}
          className="absolute z-30 left-0 right-0 sm:right-[208px] top-[calc(100%+4px)] origin-top bg-paper border border-rule rounded-lg shadow-lg overflow-hidden motion-safe:animate-slide-down"
        >
          {loadingSuggest ? (
            <div className="px-4 py-3 text-[12px] text-ink-faint flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" />
              Recherche d'adresses…
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-3 text-[12px] text-ink-faint flex items-center gap-2">
              <MapPin className="size-3.5 text-ink-faint" aria-hidden />
              Aucune adresse trouvée. Vérifiez l'orthographe ou tapez un code postal.
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {highlightedSuggestions.map(({ feat, segments }, idx) => {
                const isActive = idx === activeIndex
                return (
                  <li key={`${feat.properties.label}-${idx}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handlePickSuggestion(feat)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`group w-full text-left px-4 py-2.5 flex items-start gap-2 text-[13px] transition-colors ${
                        isActive ? 'bg-cream-deep text-ink' : 'text-ink-mute hover:bg-cream-deep/60'
                      }`}
                      // biome-ignore lint/a11y/useSemanticElements: <button role=option> is the W3C ARIA APG combobox pattern (not <option>)
                      role="option"
                      aria-selected={isActive}
                    >
                      <MapPin
                        className={`size-3.5 mt-0.5 shrink-0 transition-colors ${
                          isActive
                            ? 'text-chartreuse-deep'
                            : 'text-ink-faint group-hover:text-chartreuse-deep'
                        }`}
                        aria-hidden
                      />
                      <span className="truncate">
                        {segments.map((seg, i) =>
                          seg.match ? (
                            // biome-ignore lint/suspicious/noArrayIndexKey: segments stable per render
                            <mark key={i} className="bg-transparent text-ink font-semibold">
                              {seg.text}
                            </mark>
                          ) : (
                            // biome-ignore lint/suspicious/noArrayIndexKey: segments stable per render
                            <Fragment key={i}>{seg.text}</Fragment>
                          ),
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
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
