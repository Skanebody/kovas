'use client'

import { AppPageHeader } from '@/components/app-page-header'
import { AddonsGrid } from '@/components/decouvrir/AddonsGrid'
import { AnnuairePlansGrid } from '@/components/decouvrir/AnnuairePlansGrid'
import { BundlesGrid } from '@/components/decouvrir/BundlesGrid'
import { CurrentSituationCard } from '@/components/decouvrir/CurrentSituationCard'
import { FaqComparatif } from '@/components/decouvrir/FaqComparatif'
import { LogicielPlansGrid } from '@/components/decouvrir/LogicielPlansGrid'
import { RecommendedOffersSection } from '@/components/decouvrir/RecommendedOffersSection'
import { RiskReversalRow } from '@/components/decouvrir/RiskReversalRow'
import { SectionTracker } from '@/components/decouvrir/SectionTracker'
import { SponsorisedTiersGrid } from '@/components/decouvrir/SponsorisedTiersGrid'
import { trackPageViewed } from '@/lib/decouvrir/analytics'
import { useIntentTracker } from '@/lib/decouvrir/intent-tracker'
import { type UserAccess, deriveTrack, summarizeTrack } from '@/lib/decouvrir/recommendations'
import { useEffect, useMemo, useState } from 'react'

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
 *
 * Décision Krug (§11 "Don't Make Me Think") : l'auto-scroll 30s vers la top 1
 * recommandée a été retiré. Il violait le principe d'agency utilisateur — le
 * diagnostiqueur 43 ans (avatar SOBRE PROFESSIONNEL) doit garder le contrôle
 * total de sa lecture. Le badge "Recommandé pour toi" + le rendu prioritaire
 * en section 2 suffisent à attirer l'attention sans saut de scroll surprise.
 *
 * Décision Hormozi/Colucci (§9 + §14) : la RiskReversalRow est rendue avant
 * toute grille de prix pour désamorcer les 4 peurs structurantes (engagement,
 * débit caché, perte de données, complexité de sortie) en moins de 2 secondes
 * de lecture. C'est le pattern "Grand Slam Offer" appliqué à un catalogue.
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

  // Initial : reset le store + tracking page view
  useEffect(() => {
    reset()
    trackPageViewed(track)
  }, [reset, track])

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-12">
      <AppPageHeader
        title="Découvrir"
        accent="KOVAS"
        description="Catalogue logiciel, annuaire et bundles. Les suggestions s'adaptent à ton profil au fil de la navigation."
        eyebrow="Catalogue 2026"
      />

      {/* Section 1 — situation actuelle */}
      <CurrentSituationCard access={access} summary={summary} />

      {/* Section 2 — Garanties / risque-nul (Hormozi + Colucci) */}
      <RiskReversalRow />

      {/* Section 3 — recommandées dynamique */}
      <SectionTracker
        section="recommandations"
        anchorId="decouvrir-recommandations"
        title="Recommandées"
        accent="pour toi"
        description="Sélection dynamique basée sur ton profil et les sections consultées. Mise à jour après quelques secondes de navigation."
      >
        <RecommendedOffersSection track={track} onTopRecommendedChange={setTopRecommendedCode} />
      </SectionTracker>

      {/* Section 4 — toutes offres logiciel */}
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

      {/* Section 5 — toutes offres annuaire */}
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

      {/* Section 6 — bundles */}
      <SectionTracker
        section="bundle"
        anchorId="decouvrir-bundle"
        title="Bundles"
        accent="cross-sell"
        description="Logiciel et annuaire combinés : remise immédiate et profil synchronisé automatiquement."
      >
        <BundlesGrid recommendedCode={topRecommendedCode ?? undefined} />
      </SectionTracker>

      {/* Section 7 — add-ons */}
      <SectionTracker
        section="addons"
        anchorId="decouvrir-addons"
        title="Add-ons"
        accent="à la carte"
        description="Active uniquement ce dont tu as besoin. Activation immédiate, résiliation en 2 clics."
      >
        <AddonsGrid recommendedCode={topRecommendedCode ?? undefined} />
      </SectionTracker>

      {/* Section 8 — sponsorisé */}
      <SectionTracker
        section="sponsorise"
        anchorId="decouvrir-sponsorise"
        title="Sponsorisé"
        accent="par commune"
        description="Mise en avant payante sur une commune précise. 6 tranches selon la taille de la ville."
      >
        <SponsorisedTiersGrid recommendedCode={topRecommendedCode ?? undefined} />
      </SectionTracker>

      {/* Section 9 — FAQ + comparatif */}
      <SectionTracker
        section="faq"
        anchorId="decouvrir-faq"
        title="Tes"
        accent="questions"
        description="Tout ce qu'il faut savoir avant de s'engager."
      >
        <FaqComparatif />
      </SectionTracker>
    </div>
  )
}
