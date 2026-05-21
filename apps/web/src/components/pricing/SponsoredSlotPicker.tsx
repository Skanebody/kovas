'use client'

import {
  type SampleCity,
  findSampleCityByName,
  suggestSampleCities,
} from '@/lib/pricing/sample-cities'
// Type B2 dependency — pricing-plans.ts refonte by parallel agent
import {
  SPONSORED_SLOT_TIERS,
  type SponsoredSlotTier,
  getSponsoredSlotTier,
} from '@/lib/pricing-plans'
import { MapPin, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

/**
 * Sélecteur Sponsored Slot — démo publique sur `/pricing`.
 *
 * L'utilisateur saisit une ville (autocomplete sur 12 villes hardcodées dans
 * `sample-cities.ts`). Une fois résolue → catégorie déduite → tier matching
 * affiché avec le surcoût mensuel.
 *
 * Pour la version production (toute la France) : Edge Function
 * `match-sponsored-slot` qui lit la table `cities` Supabase remplie depuis
 * l'INSEE recensement (Phase B4 backend).
 */
export function SponsoredSlotPicker() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<SampleCity | null>(null)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const suggestions = useMemo(() => suggestSampleCities(query), [query])
  const matchingTier: SponsoredSlotTier | null = useMemo(() => {
    if (!selected) return null
    return getSponsoredSlotTier(selected.category) ?? null
  }, [selected])

  function handleSelectCity(city: SampleCity) {
    setSelected(city)
    setQuery(city.name)
    setOpen(false)
    inputRef.current?.blur()
  }

  function handleSubmitText() {
    const exact = findSampleCityByName(query)
    if (exact) {
      handleSelectCity(exact)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-6 md:gap-8 items-stretch">
      <div className="bg-white rounded-[24px] border border-[#0F1419]/[0.08] p-6 sm:p-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-semibold mb-3">
          Sélecteur de ville
        </p>
        <h3 className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.02em] leading-tight mb-2">
          Quelle ville voulez-vous sponsoriser ?
        </h3>
        <p className="text-[14px] text-[#0F1419]/72 leading-relaxed mb-5">
          Le surcoût mensuel dépend de la population. Plus la ville est peuplée, plus la
          visibilité est rare donc valorisée. Réservation par ordre d'arrivée et score
          d'activité.
        </p>

        <div className="relative">
          <label htmlFor="slot-city-query" className="sr-only">
            Nom de la ville
          </label>
          <div className="relative">
            <Search
              aria-hidden
              className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#0F1419]/55"
            />
            <input
              ref={inputRef}
              id="slot-city-query"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
                if (selected && e.target.value !== selected.name) setSelected(null)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                // Délai pour permettre clic suggestion avant fermeture
                window.setTimeout(() => setOpen(false), 150)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmitText()
                }
              }}
              placeholder="Paris, Lyon, Limoges, Dieppe…"
              aria-label="Saisir le nom de la ville à sponsoriser"
              aria-expanded={open}
              aria-controls="slot-city-suggestions"
              className="w-full bg-[#F5F7F4] border border-[#0F1419]/[0.08] rounded-[14px] pl-10 pr-4 py-3.5 text-[15px] text-[#0F1419] placeholder:text-[#0F1419]/55 focus:outline-none focus:ring-2 focus:ring-chartreuse focus:border-transparent"
            />
          </div>

          {open && suggestions.length > 0 && (
            <ul
              id="slot-city-suggestions"
              role="listbox"
              className="absolute z-20 left-0 right-0 mt-2 bg-white border border-[#0F1419]/[0.08] rounded-[14px] shadow-lg overflow-hidden max-h-72 overflow-y-auto"
            >
              {suggestions.map((city) => (
                <li key={city.name} role="option" aria-selected={selected?.name === city.name}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectCity(city)}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#F5F7F4] transition-colors flex items-center gap-3"
                  >
                    <MapPin
                      aria-hidden
                      className="size-3.5 text-[#0F1419]/55 shrink-0"
                    />
                    <span className="flex-1 text-[14px] text-[#0F1419]">
                      {city.name}{' '}
                      <span className="text-[#0F1419]/55 text-[12px]">({city.department})</span>
                    </span>
                    <span className="font-mono text-[11px] text-[#0F1419]/55 tabular-nums">
                      {formatPopulation(city.population)} hab
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-4 text-[12px] text-[#0F1419]/55 leading-snug">
          Données indicatives sur 12 villes (Paris, Lyon, Marseille, Bordeaux, Lille, Nantes,
          Limoges, Annecy, Reims, Dieppe, Vichy, Beauvais). La grille complète France entière
          est disponible une fois connecté.
        </p>
      </div>

      <SponsoredResultPanel city={selected} tier={matchingTier} />
    </div>
  )
}

function SponsoredResultPanel({
  city,
  tier,
}: {
  city: SampleCity | null
  tier: SponsoredSlotTier | null
}) {
  if (!city || !tier) {
    return (
      <div className="bg-[#0F1419] text-white rounded-[24px] p-6 sm:p-7 flex flex-col justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/72 font-semibold mb-3">
            Aperçu surcoût
          </p>
          <h3 className="text-[22px] font-semibold tracking-[-0.02em] leading-tight mb-3">
            Sélectionnez une ville pour voir le surcoût mensuel.
          </h3>
          <p className="text-[14px] text-white/90 leading-relaxed">
            6 catégories, de 9 € (rural) à 199 € (métropole). Un slot exclusif par ville et par
            diagnostiqueur. Pas de surenchère cachée — ordre d'arrivée + score activité ≥ 70.
          </p>
        </div>

        <ul className="mt-6 space-y-2 text-[12px]">
          {SPONSORED_SLOT_TIERS.map((t) => (
            <li
              key={t.category}
              className="flex items-center justify-between gap-3 border-t border-white/15 pt-2"
            >
              <span className="text-white/72">{t.label}</span>
              <span className="font-mono text-white tabular-nums">
                + {Math.round(t.monthlyPrice / 100)} €
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const surchargeEuros = Math.round(tier.monthlyPrice / 100)

  return (
    <div className="bg-[#0F1419] text-white rounded-[24px] p-6 sm:p-7 flex flex-col">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-chartreuse font-bold mb-3">
        Slot disponible
      </p>
      <h3 className="text-[22px] font-semibold tracking-[-0.02em] leading-tight mb-1">
        {city.name}{' '}
        <span className="text-white/72 text-[15px] font-normal">({city.department})</span>
      </h3>
      <p className="text-[13px] text-white/72 mb-5">
        {formatPopulation(city.population)} habitants · catégorie {tier.label}
      </p>

      <div className="bg-white/[0.06] rounded-[16px] p-5 mb-5">
        <p className="text-[12px] text-white/72 font-mono uppercase tracking-[0.14em] mb-2">
          Surcoût mensuel
        </p>
        <p className="font-serif italic font-normal text-[64px] leading-none tracking-[-0.02em] text-chartreuse">
          + {surchargeEuros}{' '}
          <span className="font-sans not-italic text-[18px] text-white/72">€ HT / mois</span>
        </p>
        <p className="text-[13px] text-white/90 leading-relaxed mt-3">
          Ajouté à votre forfait Annuaire Sponsorisé (79 €/mo). Total :{' '}
          <strong className="text-white">{79 + surchargeEuros} € HT / mois</strong>.
        </p>
      </div>

      <ul className="text-[13px] space-y-1.5 text-white/90">
        <li className="pl-[22px] relative">
          <span
            aria-hidden
            className="absolute left-1 top-[8px] block w-2 h-1 border-l-2 border-b-2 -rotate-45 border-chartreuse"
          />
          Position top sur les recherches département
        </li>
        <li className="pl-[22px] relative">
          <span
            aria-hidden
            className="absolute left-1 top-[8px] block w-2 h-1 border-l-2 border-b-2 -rotate-45 border-chartreuse"
          />
          Badge "Recommandé" visible sur fiche
        </li>
        <li className="pl-[22px] relative">
          <span
            aria-hidden
            className="absolute left-1 top-[8px] block w-2 h-1 border-l-2 border-b-2 -rotate-45 border-chartreuse"
          />
          30 leads premium / mois inclus dans Annuaire Sponsorisé
        </li>
      </ul>
    </div>
  )
}

function formatPopulation(p: number): string {
  if (p >= 1_000_000) return `${(p / 1_000_000).toFixed(1).replace('.', ',')} M`
  if (p >= 1_000) return `${Math.round(p / 1_000)} k`
  return p.toString()
}
