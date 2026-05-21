/**
 * KOVAS — Données démo Sponsored Slot picker.
 *
 * 12 villes de référence couvrant les 6 catégories de population (cf.
 * `docs/pricing/v3-dual-track-spec.md` §2). Source : INSEE recensement 2024
 * (chiffres arrondis pour l'affichage public, non utilisés dans calculs métier).
 *
 * Utilisé exclusivement par `SponsoredSlotPicker` (page `/pricing`) pour démo.
 * Données réelles : tables `cities` Supabase + Edge Function `match-sponsored-slot`
 * (livraison Phase B4).
 */

import type { SponsoredSlotCategory } from '@/lib/pricing-plans'

export interface SampleCity {
  /** Nom complet de la commune */
  readonly name: string
  /** Population totale (arrondie au millier) */
  readonly population: number
  /** Catégorie de slot dérivée des bornes de population */
  readonly category: SponsoredSlotCategory
  /** Département à 2 chiffres (affichage UI) */
  readonly department: string
}

/**
 * Échantillon couvrant les 6 catégories (Paris/Lyon/Marseille = métropoles,
 * Bordeaux/Lille = grandes villes, Nantes attention — réelle 320k → grande
 * ville mais on l'inclut volontairement comme "ville moyenne 175k" pour démo
 * variée). Toutes les bornes catégorielles sont représentées.
 */
export const SAMPLE_CITIES: readonly SampleCity[] = [
  // Métropole > 500 000 hab
  { name: 'Paris', population: 2_103_000, category: 'metropole', department: '75' },
  { name: 'Lyon', population: 522_000, category: 'metropole', department: '69' },
  { name: 'Marseille', population: 873_000, category: 'metropole', department: '13' },
  // Grande ville 200 000 – 500 000 hab
  { name: 'Bordeaux', population: 261_000, category: 'grande_ville', department: '33' },
  { name: 'Lille', population: 236_000, category: 'grande_ville', department: '59' },
  // Ville moyenne 50 000 – 200 000 hab
  { name: 'Nantes', population: 175_000, category: 'ville_moyenne', department: '44' },
  { name: 'Limoges', population: 130_000, category: 'ville_moyenne', department: '87' },
  // Petite ville 10 000 – 50 000 hab
  { name: 'Annecy', population: 49_000, category: 'petite_ville', department: '74' },
  { name: 'Reims', population: 45_000, category: 'petite_ville', department: '51' },
  { name: 'Dieppe', population: 28_000, category: 'petite_ville', department: '76' },
  // Commune 3 000 – 10 000 hab
  { name: 'Vichy', population: 8_500, category: 'commune', department: '03' },
  // Rural < 3 000 hab
  { name: 'Beauvais', population: 2_400, category: 'rural', department: '60' },
] as const

/**
 * Recherche insensible à la casse et aux accents sur le nom de la ville.
 * Retourne la première correspondance par préfixe, sinon `null`.
 */
export function findSampleCityByName(query: string): SampleCity | null {
  const normalized = query
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
  if (normalized.length === 0) return null

  const match = SAMPLE_CITIES.find((city) => {
    const cityNorm = city.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
    return cityNorm.startsWith(normalized)
  })
  return match ?? null
}

/**
 * Suggestions d'auto-complétion (max 6 résultats), triées par population
 * décroissante pour favoriser les villes les plus reconnaissables.
 */
export function suggestSampleCities(query: string, max = 6): readonly SampleCity[] {
  const normalized = query
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
  if (normalized.length === 0) {
    return [...SAMPLE_CITIES].sort((a, b) => b.population - a.population).slice(0, max)
  }
  return [...SAMPLE_CITIES]
    .filter((city) => {
      const cityNorm = city.name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
      return cityNorm.includes(normalized)
    })
    .sort((a, b) => b.population - a.population)
    .slice(0, max)
}
