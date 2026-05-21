'use client'

import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { AddonsGrid } from '@/components/pricing/AddonsGrid'
import { AnnuaireTrackGrid } from '@/components/pricing/AnnuaireTrackGrid'
import { BundlesGrid } from '@/components/pricing/BundlesGrid'
import { LegacyGrandfatherBanner } from '@/components/pricing/LegacyGrandfatherBanner'
import { LogicielTrackGrid } from '@/components/pricing/LogicielTrackGrid'
import { PricingFaq } from '@/components/pricing/PricingFaq'
import { type BillingCycle, PricingToggle } from '@/components/pricing/PricingToggle'
import { RoiCalculator } from '@/components/pricing/RoiCalculator'
import { SponsoredSlotPicker } from '@/components/pricing/SponsoredSlotPicker'
import Link from 'next/link'
import { useState } from 'react'

/**
 * Page tarifs publique — refonte V3 dual track 2026-05-21.
 *
 * Architecture :
 *   1. Header sticky (KOVAS 360 marketing chrome — sage + chartreuse)
 *   2. Hero — "Deux produits. Un prix juste." + toggle Mensuel / Annuel
 *   3. Section "Deux tracks complémentaires" — 4 cards Annuaire + 5 cards KOVAS 360
 *   4. Section "Bundles" — 5 cards avec savings badge
 *   5. Section "Sponsored Slot Picker" — sélecteur ville → tier matching
 *   6. Section "Add-ons" — 4 cards modules indépendants
 *   7. Section "ROI calculator" — focus track Logiciel
 *   8. Section "Client historique" — bannière grandfather (rendu conditionnel SSR)
 *   9. FAQ étendu (5 dual track + historiques)
 *  10. Final CTA
 *  11. Footer
 *
 * Note : `LegacyGrandfatherBanner` est rendu sans contexte auth ici (visiteurs
 * publics). Le composant retourne `null` quand prop = `null` ; l'intégration
 * auth réelle se fait sur `/app/account/billing` (Phase B4 backend).
 */
export default function PricingPage() {
  const [billing, setBilling] = useState<BillingCycle>('monthly')

  return (
    <div className="min-h-dvh flex flex-col bg-[#F5F7F4] text-[#0F1419] font-sans">
      <LandingHeader current="pricing" />

      <main className="flex-1">
        <PricingHero billing={billing} onBillingChange={setBilling} />
        <TracksSection billing={billing} />
        <BundlesSection billing={billing} />
        <SponsoredSlotSection />
        <AddonsSection />
        <RoiSection />
        <LegacySection />
        <FaqSection />
        <FinalCta />
      </main>

      <LandingFooter />
    </div>
  )
}

/* ============================================================
   HERO + TOGGLE
   ============================================================ */
function PricingHero({
  billing,
  onBillingChange,
}: {
  billing: BillingCycle
  onBillingChange: (b: BillingCycle) => void
}) {
  return (
    <section className="px-5 sm:px-12 max-w-[1240px] mx-auto text-center pt-16 sm:pt-24 md:pt-32 pb-10 sm:pb-12">
      <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-medium mb-8">
        Tarification KOVAS
      </p>
      <h1 className="font-sans font-semibold text-[48px] sm:text-[72px] md:text-[96px] leading-[0.98] tracking-[-0.035em] mb-7">
        Deux produits.
        <span className="block text-[#0F1419]/35">Un prix juste.</span>
      </h1>
      <p className="text-lg sm:text-xl md:text-[24px] text-[#0F1419]/72 max-w-[820px] mx-auto leading-[1.45] mb-10">
        <strong className="text-[#0F1419] font-semibold">KOVAS Annuaire</strong> pour recevoir
        des leads particuliers qualifiés.{' '}
        <strong className="text-[#0F1419] font-semibold">KOVAS 360</strong> pour la productivité
        terrain. Achetables séparément, ou en bundle remisé. Essai 14 jours sans carte sur le
        logiciel, résiliable à tout moment.
      </p>

      <PricingToggle value={billing} onChange={onBillingChange} />

      <div className="mt-8 flex gap-6 justify-center flex-wrap text-sm text-[#0F1419]/55">
        <span>Sans CB sur l'essai</span>
        <span className="hidden sm:inline before:content-['·'] before:text-[#0F1419]/15 before:mr-6" />
        <span>Résiliable en 3 clics (loi Le Maire)</span>
        <span className="hidden sm:inline before:content-['·'] before:text-[#0F1419]/15 before:mr-6" />
        <span>Hébergement EU (Paris) RGPD</span>
      </div>
    </section>
  )
}

/* ============================================================
   TRACKS — Annuaire + Logiciel
   ============================================================ */
function TracksSection({ billing }: { billing: BillingCycle }) {
  return (
    <section className="px-5 sm:px-12 max-w-[1320px] mx-auto pb-16 sm:pb-24 space-y-16">
      <div>
        <header className="text-center max-w-[820px] mx-auto mb-10">
          <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold mb-3">
            Track Annuaire — B2C lead generation
          </p>
          <h2 className="font-sans font-semibold text-[32px] sm:text-[44px] md:text-[56px] leading-[1.04] tracking-[-0.03em] mb-4">
            KOVAS Annuaire,{' '}
            <span className="font-serif italic font-normal text-[#0F1419]/72">
              recevez des leads particuliers.
            </span>
          </h2>
          <p className="text-[16px] sm:text-[17px] text-[#0F1419]/72 leading-relaxed">
            Quatre niveaux d'exposition, du listing gratuit vérifié au slot sponsorisé exclusif
            par ville.
          </p>
        </header>
        <AnnuaireTrackGrid billing={billing} />
      </div>

      <div>
        <header className="text-center max-w-[820px] mx-auto mb-10">
          <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold mb-3">
            Track Logiciel — productivité métier
          </p>
          <h2 className="font-sans font-semibold text-[32px] sm:text-[44px] md:text-[56px] leading-[1.04] tracking-[-0.03em] mb-4">
            KOVAS 360,{' '}
            <span className="font-serif italic font-normal text-[#0F1419]/72">
              gagnez 1h30 par mission.
            </span>
          </h2>
          <p className="text-[16px] sm:text-[17px] text-[#0F1419]/72 leading-relaxed">
            Cinq forfaits du Starter solo à l'Enterprise multi-utilisateurs, 8 diagnostics
            inclus dès Starter, exports universels et sync iPad / iPhone / Web.
          </p>
        </header>
        <LogicielTrackGrid billing={billing} />
      </div>

      <div className="text-center text-[13px]">
        <Link
          href="/pricing/compare"
          className="inline-flex items-center gap-1 text-[#0F1419] border-b border-[#0F1419]/35 hover:border-[#0F1419] transition-colors"
          aria-label="Voir le tableau comparatif détaillé des 9 forfaits"
        >
          Tableau comparatif détaillé 9 forfaits →
        </Link>
      </div>
    </section>
  )
}

/* ============================================================
   BUNDLES
   ============================================================ */
function BundlesSection({ billing }: { billing: BillingCycle }) {
  return (
    <section className="bg-white border-y border-[#0F1419]/[0.08] px-5 sm:px-12 py-20 sm:py-28">
      <div className="max-w-[1320px] mx-auto">
        <header className="text-center max-w-[820px] mx-auto mb-12">
          <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold mb-3">
            Bundles — Annuaire + KOVAS 360
          </p>
          <h2 className="font-sans font-semibold text-[32px] sm:text-[44px] md:text-[56px] leading-[1.04] tracking-[-0.03em] mb-4">
            Combinez les deux,{' '}
            <span className="font-serif italic font-normal text-[#0F1419]/72">économisez 9 à 19 €.</span>
          </h2>
          <p className="text-[16px] sm:text-[17px] text-[#0F1419]/72 leading-relaxed">
            Souscription jointe Annuaire + Logiciel à prix réduit. Aucune contrainte
            d'engagement, résiliable à tout moment.
          </p>
        </header>
        <BundlesGrid billing={billing} />
      </div>
    </section>
  )
}

/* ============================================================
   SPONSORED SLOT
   ============================================================ */
function SponsoredSlotSection() {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 max-w-[1240px] mx-auto">
      <header className="text-center max-w-[820px] mx-auto mb-10">
        <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold mb-3">
          Sponsored Slot — visibilité ville exclusive
        </p>
        <h2 className="font-sans font-semibold text-[32px] sm:text-[44px] md:text-[56px] leading-[1.04] tracking-[-0.03em] mb-4">
          Sponsoriser une ville,{' '}
          <span className="font-serif italic font-normal text-[#0F1419]/72">à partir de 9 €.</span>
        </h2>
        <p className="text-[16px] sm:text-[17px] text-[#0F1419]/72 leading-relaxed">
          Exclusivité par commune (un slot par ville par diagnostiqueur). Surcoût mensuel
          modulé selon la population. Ajout de votre fiche en tête de département + badge
          "Recommandé".
        </p>
      </header>
      <SponsoredSlotPicker />
    </section>
  )
}

/* ============================================================
   ADDONS
   ============================================================ */
function AddonsSection() {
  return (
    <section className="bg-[#F5F7F4] border-y border-[#0F1419]/[0.08] px-5 sm:px-12 py-20 sm:py-28">
      <div className="max-w-[1240px] mx-auto">
        <header className="text-center max-w-[820px] mx-auto mb-10">
          <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold mb-3">
            Modules optionnels
          </p>
          <h2 className="font-sans font-semibold text-[32px] sm:text-[44px] md:text-[56px] leading-[1.04] tracking-[-0.03em] mb-4">
            Quatre modules à la carte,{' '}
            <span className="font-serif italic font-normal text-[#0F1419]/72">activables à tout moment.</span>
          </h2>
          <p className="text-[16px] sm:text-[17px] text-[#0F1419]/72 leading-relaxed">
            Souscriptibles depuis n'importe quel tier payant Annuaire ou KOVAS 360.
            Désactivables depuis Réglages → Modules.
          </p>
        </header>
        <AddonsGrid />
      </div>
    </section>
  )
}

/* ============================================================
   ROI CALCULATOR (dark)
   ============================================================ */
function RoiSection() {
  return (
    <section className="bg-[#0F1419] text-white px-5 sm:px-12 py-20 sm:py-32">
      <div className="max-w-[820px] mx-auto">
        <header className="text-center mb-10">
          <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-chartreuse font-semibold mb-3">
            ROI — votre coût par mission
          </p>
          <h2 className="font-sans font-semibold text-[32px] sm:text-[44px] md:text-[56px] leading-[1.04] tracking-[-0.03em] mb-4">
            À votre volume,{' '}
            <span className="font-serif italic font-normal text-chartreuse">ça coûte combien.</span>
          </h2>
          <p className="text-[16px] sm:text-[17px] text-white/90 leading-relaxed">
            Le calculateur compare KOVAS 360 Active (59 €/mo) à votre volume mensuel typique.
          </p>
        </header>
        <RoiCalculator billing="monthly" />
      </div>
    </section>
  )
}

/* ============================================================
   LEGACY BANNER
   ============================================================ */
function LegacySection() {
  // Note : sur la page publique anonyme, on passe `null` → composant rend rien.
  // Sur `/app/account/billing` (Phase B4), on injectera le code legacy lu depuis
  // la souscription Stripe / `subscriptions.plan_code`.
  return (
    <section className="px-5 sm:px-12 py-12 sm:py-16 max-w-[1080px] mx-auto">
      <LegacyGrandfatherBanner legacyPlanCode={null} />
    </section>
  )
}

/* ============================================================
   FAQ
   ============================================================ */
function FaqSection() {
  return (
    <section
      id="faq"
      className="px-5 sm:px-12 py-20 sm:py-32 md:py-40 max-w-[880px] mx-auto"
    >
      <div className="text-center max-w-[720px] mx-auto">
        <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-medium mb-4">
          Questions tarifaires
        </p>
        <h2 className="font-sans font-semibold text-[40px] sm:text-[56px] md:text-[72px] leading-[1.02] tracking-[-0.03em] mb-6">
          Tout sur la grille V3{' '}
          <span className="text-[#0F1419]/35">et la migration.</span>
        </h2>
        <p className="text-[17px] sm:text-[20px] text-[#0F1419]/72 leading-relaxed">
          Réponses sèches, sans jargon commercial. Pour le reste, la FAQ complète est sur{' '}
          <Link
            href="/faq"
            className="border-b border-current text-[#0F1419] hover:text-[#0F1419]/72"
          >
            kovas.fr/faq
          </Link>
          .
        </p>
      </div>

      <PricingFaq />
    </section>
  )
}

/* ============================================================
   FINAL CTA
   ============================================================ */
function FinalCta() {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-32 md:py-40 text-center border-t border-[#0F1419]/[0.08]">
      <h2 className="font-sans font-semibold text-[40px] sm:text-[56px] md:text-[80px] leading-[1.02] tracking-[-0.03em] mb-7 max-w-[900px] mx-auto">
        Pas encore convaincu ?
        <span className="block text-[#0F1419]/35">Démarrez l'essai sans carte.</span>
      </h2>
      <p className="text-[17px] sm:text-[20px] text-[#0F1419]/72 max-w-[680px] mx-auto leading-relaxed mb-10">
        14 jours d'accès complet à KOVAS 360, sans engagement. 10 missions minimum suggérées
        pour valider sur vos vrais dossiers. Annuaire gratuit accessible immédiatement après
        revendication de fiche.
      </p>
      <div className="flex gap-4 justify-center flex-wrap">
        <Link
          href="/signup?plan=logiciel_starter"
          aria-label="Commencer l'essai 14 jours KOVAS 360"
          className="bg-chartreuse text-[#0F1419] px-8 py-4 rounded-full text-base font-semibold hover:bg-chartreuse-deep hover:-translate-y-px transition-all duration-150"
        >
          Commencer mon essai
        </Link>
        <Link
          href="/reclamer-ma-fiche/find"
          aria-label="Réclamer ma fiche annuaire gratuitement"
          className="bg-white text-[#0F1419] border border-[#0F1419]/35 px-7 py-4 rounded-full text-base font-medium hover:border-[#0F1419] transition-colors"
        >
          Réclamer ma fiche annuaire
        </Link>
      </div>
    </section>
  )
}
