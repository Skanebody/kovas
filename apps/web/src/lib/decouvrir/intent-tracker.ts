/**
 * KOVAS — Store Zustand de tracking d'intention d'achat
 * pour la page Découvrir.
 *
 * Capture côté client (in-memory uniquement, jamais persisté) :
 *  - sections visitées + temps passé par section (timestamps enter/leave)
 *  - profondeur de scroll dans chaque section
 *  - hover sur cards d'offres (>500ms = signal qualifié)
 *  - clics sur CTA secondaires (signal fort)
 *  - liste des offres comparées (signal de comparaison)
 *
 * Le store expose des actions atomiques utilisables par les composants
 * via hooks (cf. RecommendedOffersSection et trackers IntersectionObserver).
 *
 * Recalcul du score : à chaque mutation, le selector
 * `selectScoredOffers(track)` retourne la liste triée prête à l'affichage.
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import {
  type DecouvrirSection,
  EMPTY_INTENT_SIGNALS,
  type IntentSignals,
  type ScoredOffer,
  type UserTrack,
  getTopRecommendations,
  scoreOffers,
} from './recommendations'

interface IntentTrackerState extends IntentSignals {
  /** Section actuellement visible (sentinel intersection-observer) */
  activeSection: DecouvrirSection | null
  /** Timestamp (ms) d'entrée dans la section active */
  activeSectionEnteredAt: number | null
  /** Code d'offre actuellement survolée */
  hoveredOfferCode: string | null
  /** Timestamp (ms) du début du hover courant */
  hoveredOfferAt: number | null

  /** Compteur monotonic pour forcer rerenders sur recompute périodique */
  ticks: number

  // ----- Actions -----
  setActiveSection(section: DecouvrirSection | null): void
  setSectionScrollDepth(section: DecouvrirSection, depth: number): void
  startHover(code: string): void
  endHover(code: string): void
  recordCtaClick(code: string): void
  recordComparison(code: string): void
  tick(): void
  reset(): void
}

export const useIntentTracker = create<IntentTrackerState>((set, get) => ({
  ...EMPTY_INTENT_SIGNALS,
  sectionTimeMs: {},
  sectionScrollDepth: {},
  offerHoverMs: {},
  offerCtaClicks: {},
  comparedCodes: [],
  activeSection: null,
  activeSectionEnteredAt: null,
  hoveredOfferCode: null,
  hoveredOfferAt: null,
  ticks: 0,

  setActiveSection(section) {
    const now = Date.now()
    const state = get()

    // Si on quitte une section, on commit le temps passé
    if (state.activeSection && state.activeSectionEnteredAt) {
      const delta = now - state.activeSectionEnteredAt
      const prev = state.sectionTimeMs[state.activeSection] ?? 0
      set({
        sectionTimeMs: {
          ...state.sectionTimeMs,
          [state.activeSection]: prev + delta,
        },
      })
    }

    set({
      activeSection: section,
      activeSectionEnteredAt: section ? now : null,
    })
  },

  setSectionScrollDepth(section, depth) {
    const state = get()
    const prev = state.sectionScrollDepth[section] ?? 0
    const next = Math.max(prev, Math.min(1, depth))
    if (next === prev) return
    set({
      sectionScrollDepth: {
        ...state.sectionScrollDepth,
        [section]: next,
      },
    })
  },

  startHover(code) {
    set({ hoveredOfferCode: code, hoveredOfferAt: Date.now() })
  },

  endHover(code) {
    const state = get()
    if (state.hoveredOfferCode !== code || !state.hoveredOfferAt) {
      set({ hoveredOfferCode: null, hoveredOfferAt: null })
      return
    }
    const delta = Date.now() - state.hoveredOfferAt
    // Filtrer les hovers trop courts (anti-bruit)
    if (delta < 250) {
      set({ hoveredOfferCode: null, hoveredOfferAt: null })
      return
    }
    const prev = state.offerHoverMs[code] ?? 0
    set({
      offerHoverMs: { ...state.offerHoverMs, [code]: prev + delta },
      hoveredOfferCode: null,
      hoveredOfferAt: null,
    })
  },

  recordCtaClick(code) {
    const state = get()
    const prev = state.offerCtaClicks[code] ?? 0
    set({ offerCtaClicks: { ...state.offerCtaClicks, [code]: prev + 1 } })
  },

  recordComparison(code) {
    const state = get()
    if (state.comparedCodes.includes(code)) return
    set({ comparedCodes: [...state.comparedCodes, code] })
  },

  tick() {
    // Force un recompute en incrémentant ticks. Permet d'avoir un recalcul
    // périodique sans mutation directe des signaux (ex: après 30s de scroll).
    set((s) => ({ ticks: s.ticks + 1 }))
  },

  reset() {
    set({
      sectionTimeMs: {},
      sectionScrollDepth: {},
      offerHoverMs: {},
      offerCtaClicks: {},
      comparedCodes: [],
      activeSection: null,
      activeSectionEnteredAt: null,
      hoveredOfferCode: null,
      hoveredOfferAt: null,
      ticks: 0,
    })
  },
}))

/**
 * Snapshot pur (sans actions) — utilisable pour le scoring.
 */
export function getCurrentSignals(): IntentSignals {
  const s = useIntentTracker.getState()
  return {
    sectionTimeMs: s.sectionTimeMs,
    sectionScrollDepth: s.sectionScrollDepth,
    offerHoverMs: s.offerHoverMs,
    offerCtaClicks: s.offerCtaClicks,
    comparedCodes: s.comparedCodes,
  }
}

const signalsSelector = (s: IntentTrackerState): IntentSignals & { _ticks: number } => ({
  sectionTimeMs: s.sectionTimeMs,
  sectionScrollDepth: s.sectionScrollDepth,
  offerHoverMs: s.offerHoverMs,
  offerCtaClicks: s.offerCtaClicks,
  comparedCodes: s.comparedCodes,
  _ticks: s.ticks,
})

/**
 * Hook helper : retourne les top N offres recommandées pour le track donné,
 * recalculées à chaque mutation du store.
 */
export function useTopRecommendations(
  track: UserTrack,
  count = 4,
  excludeCodes?: ReadonlySet<string>,
): readonly ScoredOffer[] {
  const signals = useIntentTracker(useShallow(signalsSelector))
  return getTopRecommendations(signals, track, count, excludeCodes)
}

/**
 * Hook helper : retourne le scoring complet (utile pour debug + tests).
 */
export function useScoredOffers(track: UserTrack): readonly ScoredOffer[] {
  const signals = useIntentTracker(useShallow(signalsSelector))
  return scoreOffers(signals, track)
}
