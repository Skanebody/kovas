'use client'

import { AppPageHeader } from '@/components/app-page-header'
import { AddonsGrid } from '@/components/decouvrir/AddonsGrid'
import { AnnuairePlansGrid } from '@/components/decouvrir/AnnuairePlansGrid'
import { BundlesGrid } from '@/components/decouvrir/BundlesGrid'
import { CurrentSituationCard } from '@/components/decouvrir/CurrentSituationCard'
import { FaqComparatif } from '@/components/decouvrir/FaqComparatif'
import { LogicielPlansGrid } from '@/components/decouvrir/LogicielPlansGrid'
import { RecommendedOffersSection } from '@/components/decouvrir/RecommendedOffersSection'
import { SectionTracker } from '@/components/decouvrir/SectionTracker'
import { SponsorisedTiersGrid } from '@/components/decouvrir/SponsorisedTiersGrid'
import { trackPageViewed } from '@/lib/decouvrir/analytics'
import { useIntentTracker } from '@/lib/decouvrir/intent-tracker'
import { type UserAccess, deriveTrack, summarizeTrack } from '@/lib/decouvrir/recommendations'
import { useEffect, useMemo, useRef, useState } from 'react'

interface DecouvrirClientProps {
  access: UserAccess
  /** Code de l'offre logicielle actuelle (pour mapper "Plan actuel") */
  currentLogicielCode?: string
  /** Code de l'offre annuaire actuelle */
  currentAnnuaireCode?: string
}

/**
 * Composant client racine de la page Découvrir.
 *
 * Orchestre :
 *  - le tracking des sections (SectionTracker)
 *  - la section recommandée dynamique
 *  - le scroll automatique vers la top 1 recommandée après 30s
 *    (animation subtile, pas brutal)
 */
export function DecouvrirClient({
  access,
  currentLogicielCode,
  currentAnnuaireCode,
}: DecouvrirClientProps) {
  const summary = useMemo(() => summarizeTrack(access), [access])
  const track = useMemo(() => deriveTrack(access), [access])
  const [topRecommendedCode, setTopRecommendedCode] = useState<string | null>(null)
  const reset = useIntentTracker((s) => s.reset)
  const hasScrolledRef = useRef(false)

  // Initial : reset le store + tracking page view
  useEffect(() => {
    reset()
    trackPageViewed(track)
  }, [reset, track])

  // Scroll into view subtil quand la top 1 change pour la première fois après 30s
  useEffect(() => {
    if (!topRecommendedCode || hasScrolledRef.current) return
    const timer = window.setTimeout(() => {
      if (hasScrolledRef.current) return
      const el = document.querySelector(
        `[data-offer-code="${topRecommendedCode}"][data-recommended-top="1"]`,
      )
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        hasScrolledRef.current = true
      }
    }, 30_000)
    return () => window.clearTimeout(timer)
  }, [topRecommendedCode])

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-12">
      <AppPageHeader
        title="Découvrir"
        accent="KOVAS"
        description="Explore nos offres logiciel, annuaire et bundles. Les suggestions s'adaptent à ton profil et à ta navigation."
        eyebrow="Catalogue 2026"
      />

      {/* Section 1 — situation actuelle */}
      <CurrentSituationCard access={access} summary={summary} />

      {/* Section 2 — recommandées dynamique */}
      <SectionTracker
        section="recommandations"
        anchorId="decouvrir-recommandations"
        title="Recommandées"
        accent="pour vous"
        description="Sélection dynamique basée sur ton profil et les sections consultées. Mise à jour automatique après quelques secondes de navigation."
      >
        <RecommendedOffersSection track={track} onTopRecommendedChange={setTopRecommendedCode} />
      </SectionTracker>

      {/* Section 3 — toutes offres logiciel */}
      <SectionTracker
        section="logiciel"
        anchorId="decouvrir-logiciel"
        title="Toutes les offres"
        accent="logiciel"
        description="KOVAS — ton logiciel terrain et bureau. 5 plans calibrés selon ton volume."
      >
        <LogicielPlansGrid
          currentCode={currentLogicielCode}
          recommendedCode={topRecommendedCode ?? undefined}
        />
      </SectionTracker>

      {/* Section 4 — toutes offres annuaire */}
      <SectionTracker
        section="annuaire"
        anchorId="decouvrir-annuaire"
        title="Toutes les offres"
        accent="annuaire"
        description="KOVAS Annuaire — ta visibilité auprès des particuliers. 4 plans selon ta couverture."
      >
        <AnnuairePlansGrid
          currentCode={currentAnnuaireCode}
          recommendedCode={topRecommendedCode ?? undefined}
        />
      </SectionTracker>

      {/* Section 5 — bundles */}
      <SectionTracker
        section="bundle"
        anchorId="decouvrir-bundle"
        title="Bundles"
        accent="cross-sell"
        description="Combine logiciel et annuaire pour profiter d'une remise et d'une synchronisation automatique de ton profil."
      >
        <BundlesGrid recommendedCode={topRecommendedCode ?? undefined} />
      </SectionTracker>

      {/* Section 6 — add-ons */}
      <SectionTracker
        section="addons"
        anchorId="decouvrir-addons"
        title="Add-ons"
        accent="à la carte"
        description="Active uniquement ce dont tu as besoin. Activation immédiate, résiliation 1 clic."
      >
        <AddonsGrid recommendedCode={topRecommendedCode ?? undefined} />
      </SectionTracker>

      {/* Section 7 — sponsorisé */}
      <SectionTracker
        section="sponsorise"
        anchorId="decouvrir-sponsorise"
        title="Sponsorisé"
        accent="par commune"
        description="Mise en avant payante sur une commune précise. 6 tranches selon la taille de la ville."
      >
        <SponsorisedTiersGrid recommendedCode={topRecommendedCode ?? undefined} />
      </SectionTracker>

      {/* Section 8 — FAQ + comparatif */}
      <SectionTracker
        section="faq"
        anchorId="decouvrir-faq"
        title="Vos"
        accent="questions"
        description="Tout ce qu'il faut savoir avant de s'engager. Aucune question stupide."
      >
        <FaqComparatif />
      </SectionTracker>
    </div>
  )
}
