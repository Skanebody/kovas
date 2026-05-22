import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { PricingAddonsTable } from '@/components/pricing/v5simp/PricingAddonsTable'
import { PricingBundleRow } from '@/components/pricing/v5simp/PricingBundleRow'
import { PricingFAQ } from '@/components/pricing/v5simp/PricingFAQ'
import { PricingHero } from '@/components/pricing/v5simp/PricingHero'
import { PricingTrackSection } from '@/components/pricing/v5simp/PricingTrackSection'
import { QueVoulezVousSection } from '@/components/pricing/v5simp/QueVoulezVousSection'
import { JsonLd } from '@/components/seo/JsonLd'
import {
  ANNUAIRE_PLANS,
  BUNDLES,
  LOGICIEL_PLANS,
} from '@/lib/pricing-plans'
import { buildPricingItemListSchema } from '@/lib/seo/schema-org'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Tarifs KOVAS — Annuaire diagnostiqueurs + logiciel KOVAS 360',
  description:
    "Le logiciel et l'annuaire pour diagnostiqueurs immobiliers. Annuaire gratuit ou premium, logiciel KOVAS 360 dès 29€/mo, bundles remisés. Essai 14 jours sans carte.",
}

/**
 * Page tarifs publique — refonte V5 simplifiée 2026-05-22.
 *
 * Architecture scroll linéaire éducative (pas de grille comparative dense) :
 *   1. Hero "Le logiciel et l'annuaire" + CTA essai
 *   2. "Vous voulez quoi ?" — 2 boutons orientation Annuaire / Logiciel
 *   3. Section Annuaire — 4 cards verticales empilées full-width
 *   4. Section Logiciel — 5 cards verticales empilées full-width
 *   5. Bundles — 5 lignes simples sans card riche
 *   6. Add-ons — tableau sobre 4 lignes
 *   7. FAQ — 7 questions accordion
 *   8. Final CTA — bouton primary plein largeur
 *
 * Style : navy #0B1D33 + cream + Instrument Serif italic + chartreuse accent.
 * Vouvoiement, pas d'emoji, ton sobre professionnel (avatar cf.
 * docs/avatar-client.md).
 */
export default function PricingPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-[#F8F5EE] text-[#0B1D33] font-sans">
      <JsonLd
        id="pricing-itemlist"
        data={buildPricingItemListSchema({
          annuairePlans: ANNUAIRE_PLANS,
          logicielPlans: LOGICIEL_PLANS,
          bundles: BUNDLES,
        })}
      />
      <LandingHeader current="pricing" />

      <main className="flex-1">
        <PricingHero />
        <QueVoulezVousSection />

        <PricingTrackSection
          id="section-annuaire"
          eyebrow="KOVAS Annuaire"
          title="Faites-vous trouver"
          titleAccent="par les particuliers."
          description="Quatre niveaux d'exposition, du listing gratuit vérifié au slot sponsorisé exclusif par ville."
          featuredTag="Recommandé"
          plans={ANNUAIRE_PLANS}
          signupPrefix="/signup?plan="
        />

        <PricingTrackSection
          id="section-logiciel"
          eyebrow="KOVAS 360"
          title="Gagnez"
          titleAccent="1h30 par mission."
          description="Cinq forfaits du Starter solo à l'Enterprise multi-utilisateurs. 8 diagnostics inclus dès Starter, exports universels, sync iPad / iPhone / Web."
          featuredTag="Recommandé"
          plans={LOGICIEL_PLANS}
          signupPrefix="/signup?plan="
        />

        <BundlesSection />
        <AddonsSection />
        <FaqSection />
        <FinalCta />
      </main>

      <LandingFooter />
    </div>
  )
}

/* ============================================================
   BUNDLES — 5 lignes simples
   ============================================================ */
function BundlesSection() {
  return (
    <section
      id="section-bundles"
      className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0B1D33]/[0.08]"
    >
      <div className="max-w-[860px] mx-auto">
        <header className="text-center mb-10">
          <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#0B1D33]/55 font-semibold mb-4">
            Bundles
          </p>
          <h2 className="font-sans font-semibold text-[32px] sm:text-[44px] md:text-[56px] leading-[1.04] tracking-[-0.03em] text-[#0B1D33] mb-4">
            Combinez les deux,{' '}
            <span className="font-serif italic font-normal text-[#0B1D33]/72">
              économisez chaque mois.
            </span>
          </h2>
          <p className="text-[16px] text-[#0B1D33]/72 leading-relaxed max-w-[600px] mx-auto">
            Souscription jointe Annuaire + Logiciel à prix réduit. Aucun
            engagement, résiliable à tout moment.
          </p>
        </header>

        <div className="rounded-2xl bg-white border border-[#0B1D33]/[0.06]">
          {BUNDLES.map((bundle) => (
            <PricingBundleRow key={bundle.code} bundle={bundle} />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   ADD-ONS — tableau sobre
   ============================================================ */
function AddonsSection() {
  return (
    <section
      id="section-addons"
      className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0B1D33]/[0.08]"
    >
      <header className="text-center max-w-[660px] mx-auto mb-10">
        <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#0B1D33]/55 font-semibold mb-4">
          Modules optionnels
        </p>
        <h2 className="font-sans font-semibold text-[32px] sm:text-[44px] md:text-[56px] leading-[1.04] tracking-[-0.03em] text-[#0B1D33] mb-4">
          Quatre modules à la carte,{' '}
          <span className="font-serif italic font-normal text-[#0B1D33]/72">
            activables à tout moment.
          </span>
        </h2>
        <p className="text-[16px] text-[#0B1D33]/72 leading-relaxed">
          Souscriptibles depuis n&apos;importe quel tier payant. Désactivables
          en un clic.
        </p>
      </header>
      <PricingAddonsTable />
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
      className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0B1D33]/[0.08]"
    >
      <div className="max-w-[760px] mx-auto">
        <header className="text-center mb-10">
          <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#0B1D33]/55 font-semibold mb-4">
            Questions tarifaires
          </p>
          <h2 className="font-sans font-semibold text-[32px] sm:text-[44px] md:text-[56px] leading-[1.04] tracking-[-0.03em] text-[#0B1D33] mb-4">
            Tout ce qui est{' '}
            <span className="font-serif italic font-normal text-[#0B1D33]/72">
              utile à savoir.
            </span>
          </h2>
          <p className="text-[16px] text-[#0B1D33]/72 leading-relaxed">
            Réponses sèches, sans jargon commercial. FAQ complète sur{' '}
            <Link
              href="/faq"
              className="border-b border-current text-[#0B1D33] hover:text-[#0B1D33]/72"
            >
              kovas.fr/faq
            </Link>
            .
          </p>
        </header>

        <PricingFAQ />
      </div>
    </section>
  )
}

/* ============================================================
   FINAL CTA — bouton primary plein largeur
   ============================================================ */
function FinalCta() {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 md:py-36 text-center border-t border-[#0B1D33]/[0.08]">
      <h2 className="font-sans font-semibold text-[36px] sm:text-[48px] md:text-[64px] leading-[1.05] tracking-[-0.03em] text-[#0B1D33] mb-6 max-w-[800px] mx-auto">
        Démarrez{' '}
        <span className="font-serif italic font-normal text-[#0B1D33]/72">
          votre essai gratuit.
        </span>
      </h2>
      <p className="text-[17px] text-[#0B1D33]/72 max-w-[580px] mx-auto leading-relaxed mb-10">
        14 jours d&apos;accès complet à KOVAS 360, sans carte bancaire, sans
        engagement.
      </p>
      <Link
        href="/signup?plan=solo_light"
        aria-label="Démarrer mon essai gratuit KOVAS 360"
        className="inline-flex items-center justify-center gap-2 bg-[#D4F542] text-[#0B1D33] px-10 py-4 rounded-full text-[15px] font-semibold hover:bg-[#A3C920] hover:-translate-y-px transition-all duration-150 shadow-[0_8px_24px_rgba(212,245,66,0.35)]"
      >
        Démarrer mon essai gratuit
      </Link>
    </section>
  )
}
