'use client'

import { Button } from '@/components/ui/button'
import { searchBanAddress, type BanFeature } from '@/lib/ban'
import { cn } from '@/lib/utils'
import { ArrowRight, MapPin, Search, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'

const DIAG_TYPES: Array<{ id: string; label: string }> = [
  { id: 'dpe', label: 'DPE' },
  { id: 'amiante', label: 'Amiante' },
  { id: 'plomb', label: 'Plomb' },
  { id: 'gaz', label: 'Gaz' },
  { id: 'elec', label: 'Électricité' },
  { id: 'termites', label: 'Termites' },
  { id: 'carrez', label: 'Carrez / Boutin' },
  { id: 'erp', label: 'ERP' },
]

/**
 * Hero B2C — Annuaire particuliers.
 * Search bar centrale avec auto-suggest BAN + sélecteur diagnostics compact.
 */
export function HeroB2C() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<BanFeature[]>([])
  const [selected, setSelected] = useState<BanFeature | null>(null)
  const [showSugg, setShowSugg] = useState(false)
  const [selectedDiag, setSelectedDiag] = useState<Set<string>>(new Set(['dpe']))
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (selected && selected.properties.label === query) return
    if (query.trim().length < 3) {
      setSuggestions([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      const results = await searchBanAddress(query, 6)
      setSuggestions(results)
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, selected])

  function toggleDiag(id: string) {
    setSelectedDiag((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (selected) {
      params.set('q', selected.properties.label)
      if (selected.properties.citycode) params.set('insee', selected.properties.citycode)
      if (selected.properties.postcode) params.set('cp', selected.properties.postcode)
    } else if (query.trim()) {
      params.set('q', query.trim())
    }
    if (selectedDiag.size > 0) params.set('diag', Array.from(selectedDiag).join(','))
    router.push(`/trouver-un-diagnostiqueur?${params.toString()}`)
  }

  return (
    <section className="relative px-6 py-20 md:py-28 overflow-hidden bg-cream">
      {/* Watermark map fallback : très subtil dégradé radial cream */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(22,49,68,0.04), transparent 70%)',
        }}
      />
      <div className="relative mx-auto max-w-4xl text-center space-y-8">
        <h1 className="font-display font-light text-[40px] sm:text-[56px] md:text-[68px] leading-[1.05] tracking-tight text-ink">
          Trouve ton{' '}
          <span className="font-serif italic font-normal">diagnostiqueur immobilier</span>{' '}
          certifié
        </h1>
        <p className="text-base sm:text-lg text-ink-mute max-w-2xl mx-auto leading-relaxed">
          13 000 professionnels certifiés : DPE, Amiante, Plomb, Gaz, Électricité. Demande un
          devis gratuit en 2 minutes.
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-paper border border-rule rounded-xl shadow-md p-4 sm:p-5 space-y-4 text-left max-w-2xl mx-auto"
          aria-label="Rechercher un diagnostiqueur"
        >
          <div className="relative">
            <label htmlFor="ban-input" className="sr-only">
              Adresse ou ville
            </label>
            <div className="flex items-center gap-2 border border-rule rounded-md px-3 py-2.5 bg-paper focus-within:border-navy/50 focus-within:ring-2 focus-within:ring-navy/10 transition-colors duration-200">
              <MapPin className="size-4 text-ink-faint shrink-0" />
              <input
                id="ban-input"
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelected(null)
                  setShowSugg(true)
                }}
                onFocus={() => setShowSugg(true)}
                onBlur={() => setTimeout(() => setShowSugg(false), 200)}
                placeholder="Saisis ton adresse ou ville"
                className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-ink-ghost"
                autoComplete="street-address"
              />
            </div>
            {showSugg && suggestions.length > 0 && (
              <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-paper border border-rule rounded-md shadow-lg max-h-64 overflow-auto">
                {suggestions.map((s, i) => (
                  <li key={`${s.properties.label}-${i}`}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-ink/5 flex items-start gap-2"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setSelected(s)
                        setQuery(s.properties.label)
                        setShowSugg(false)
                      }}
                    >
                      <MapPin className="size-3.5 text-ink-faint mt-0.5 shrink-0" />
                      <span className="truncate">{s.properties.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-mono uppercase tracking-wider text-ink-faint">
              Types de diagnostic
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {DIAG_TYPES.map((d) => {
                const isOn = selectedDiag.has(d.id)
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={isOn}
                    onClick={() => toggleDiag(d.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors duration-200',
                      isOn
                        ? 'bg-navy text-paper border-navy shadow-sm'
                        : 'bg-paper text-ink-mute border-rule hover:border-ink/30',
                    )}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <Button type="submit" size="lg" className="w-full">
            <Search className="size-4" />
            Trouver un diagnostiqueur
            <ArrowRight className="size-4" />
          </Button>
        </form>

        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-ink-mute">
          <li className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-ink-faint" />
            Données officielles Ministère du Logement
          </li>
          <li className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-ink-faint" />
            Tous certifiés COFRAC
          </li>
          <li className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-ink-faint" />
            100% gratuit
          </li>
        </ul>

        <p className="text-xs text-ink-faint pt-2">
          Pas (encore) de diagnostiqueur dans ta ville ?{' '}
          <Link
            href="/trouver-un-diagnostiqueur"
            className="text-ink underline-offset-4 hover:underline"
          >
            Parcourir tout l&apos;annuaire
          </Link>
        </p>
      </div>
    </section>
  )
}
