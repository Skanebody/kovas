import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { PlanFeatureMatrix } from '@/components/pricing/PlanFeatureMatrix'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Comparatif des forfaits KOVAS',
  description:
    "Tableau comparatif détaillé KOVAS Annuaire (4 tiers) + KOVAS 360 (5 tiers) + 5 Bundles combinés. Toutes les fonctionnalités comparées ligne par ligne.",
}

/**
 * Page `/pricing/compare` — tableau comparatif features × forfaits.
 *
 * Mirror visuel du design system : sage `#F5F7F4` background + cards blanches
 * + chartreuse pour les ticks ✓. Aucun gradient.
 */
export default function PricingComparePage() {
  return (
    <div className="min-h-dvh flex flex-col bg-[#F5F7F4] text-[#0F1419] font-sans">
      <LandingHeader current="pricing" />

      <main className="flex-1">
        <section className="px-5 sm:px-12 max-w-[1240px] mx-auto text-center pt-16 sm:pt-24 md:pt-28 pb-10 sm:pb-14">
          <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-medium mb-6">
            Comparatif détaillé
          </p>
          <h1 className="font-sans font-semibold text-[40px] sm:text-[64px] md:text-[80px] leading-[1.02] tracking-[-0.035em] mb-6">
            Neuf forfaits.
            <span className="block text-[#0F1419]/35">Une vue d'ensemble.</span>
          </h1>
          <p className="text-[17px] sm:text-[20px] text-[#0F1419]/72 max-w-[760px] mx-auto leading-[1.5]">
            KOVAS Annuaire (4 tiers) et KOVAS 360 (5 tiers) comparés ligne par ligne. Plus les
            5 Bundles combinés. Aucune mention floue : si c'est inclus, c'est coché ; sinon,
            c'est barré.
          </p>
        </section>

        <section className="px-5 sm:px-12 max-w-[1320px] mx-auto pb-20 sm:pb-32">
          <PlanFeatureMatrix />
        </section>

        <section className="px-5 sm:px-12 py-16 sm:py-24 text-center border-t border-[#0F1419]/[0.08]">
          <h2 className="font-sans font-semibold text-[32px] sm:text-[48px] md:text-[60px] leading-[1.05] tracking-[-0.03em] mb-6 max-w-[760px] mx-auto">
            Toujours hésitant ?
            <span className="block text-[#0F1419]/35">Composez votre offre.</span>
          </h2>
          <p className="text-[16px] sm:text-[18px] text-[#0F1419]/72 max-w-[600px] mx-auto leading-relaxed mb-10">
            Choisissez votre forfait, ajoutez les modules dont vous avez vraiment besoin et voyez
            le total HT mensuel se mettre à jour en direct.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/pricing/calculator"
              className="bg-chartreuse text-[#0F1419] px-8 py-4 rounded-full text-base font-semibold hover:bg-chartreuse-deep hover:-translate-y-px transition-all duration-150"
            >
              Construire mon offre
            </Link>
            <Link
              href="/pricing"
              className="text-[#0F1419] px-7 py-4 text-base font-medium border-b border-transparent hover:border-[#0F1419] transition-colors"
            >
              ← Retour aux forfaits
            </Link>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}
