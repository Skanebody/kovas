import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { FairUseDisclosure } from '@/components/pricing/FairUseDisclosure'
import { LaunchOfferCountdown } from '@/components/pricing/LaunchOfferCountdown'
import { PricingFaq } from '@/components/pricing/PricingFaq'
import { PricingTiersGrid } from '@/components/pricing/PricingTiersGrid'
import { RoiStandalone } from '@/components/pricing/RoiStandalone'
import { ADDON_MODULES } from '@/lib/pricing-plans'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Tarifs KOVAS 360',
  description:
    'Cinq forfaits à prix fixe mensuel — de 9 à 89 € HT. Missions illimitées sous fair-use. Essai 14 jours sans carte, résiliable en 3 clics.',
}

/**
 * Page tarifs publique — refonte P9 2026-05-28.
 *
 * Modèle "all-you-can-eat" : forfait fixe mensuel + missions ILLIMITÉES sous
 * fair-use cap par tier (visible). Hard caps IA Whisper/Vision silencieux
 * jusqu'au plafonnement.
 *
 * Sections :
 *   1. Header sticky
 *   2. Hero — "Choisissez votre forfait. Pas de surprise sur la facture."
 *   3. Toggle mensuel/annuel + grille 5 tiers
 *   4. ROI calculator standalone (compare vs Liciel stack)
 *   5. FairUseDisclosure — 3 piliers du fair-use
 *   6. Section "Inclus dès le premier euro"
 *   7. Section Add-ons (9 modules optionnels)
 *   8. Bande dark engagement annuel
 *   9. FAQ pricing
 *   10. Final CTA
 *   11. Footer
 */
export default function PricingPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-[#F5F7F4] text-[#0F1419] font-sans">
      <LandingHeader current="pricing" />

      <main className="flex-1">
        <PricingHero />
        <TiersSection />
        <div className="px-5 sm:px-12 max-w-[1240px] mx-auto">
          <RoiStandalone />
        </div>
        <FairUseDisclosure />
        <IncludedSection />
        <AddonsSection />
        <AnnualSection />
        <FaqSection />
        <FinalCta />
      </main>

      <LandingFooter />
    </div>
  )
}

/* ============================================================
   HERO
   ============================================================ */
function PricingHero() {
  return (
    <section className="px-5 sm:px-12 max-w-[1240px] mx-auto text-center pt-16 sm:pt-24 md:pt-32 pb-10 sm:pb-12">
      <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-medium mb-8">
        Tarifs KOVAS 360
      </p>
      <h1 className="font-sans font-semibold text-[48px] sm:text-[72px] md:text-[96px] leading-[0.98] tracking-[-0.035em] mb-7">
        Choisissez votre forfait.
        <span className="block text-[#0F1419]/35">Pas de surprise sur la facture.</span>
      </h1>
      <p className="text-lg sm:text-xl md:text-[24px] text-[#0F1419]/72 max-w-[820px] mx-auto leading-[1.45] mb-10">
        Tous les forfaits incluent <strong className="text-[#0F1419] font-semibold">missions illimitées</strong>,
        14 jours d'essai gratuit sans carte bancaire, et la résiliation à tout moment en trois
        clics. Pas de surplus, pas de seconde saisie de CB en cours de mois, pas de plafond
        silencieux qui vous coupe pendant un diagnostic.
      </p>

      <LaunchOfferCountdown />

      <div className="mt-8 flex gap-6 justify-center flex-wrap text-sm text-[#0F1419]/55">
        <span>Essai 14 jours sans carte</span>
        <span className="hidden sm:inline before:content-['·'] before:text-[#0F1419]/15 before:mr-6" />
        <span>Résiliable en 3 clics (loi Le Maire)</span>
        <span className="hidden sm:inline before:content-['·'] before:text-[#0F1419]/15 before:mr-6" />
        <span>Hébergement EU (Paris) RGPD</span>
      </div>

      <div className="mt-8 flex gap-3 justify-center flex-wrap text-[13px]">
        <Link
          href="/pricing/calculator"
          className="inline-flex items-center gap-1 text-[#0F1419] border-b border-[#0F1419]/35 hover:border-[#0F1419] transition-colors"
        >
          Construire mon offre avec modules →
        </Link>
        <span className="text-[#0F1419]/15 hidden sm:inline">·</span>
        <Link
          href="/pricing/compare"
          className="inline-flex items-center gap-1 text-[#0F1419] border-b border-[#0F1419]/35 hover:border-[#0F1419] transition-colors"
        >
          Tableau comparatif détaillé →
        </Link>
      </div>
    </section>
  )
}

/* ============================================================
   TIERS GRID
   ============================================================ */
function TiersSection() {
  return (
    <section className="px-5 sm:px-12 max-w-[1320px] mx-auto pb-20 sm:pb-32">
      <PricingTiersGrid />
    </section>
  )
}

/* ============================================================
   INCLUS PARTOUT
   ============================================================ */
const INCLUDED_FEATURES = [
  '8 diagnostics standards (DPE, amiante, plomb, gaz, électricité, termites, Carrez/Boutin, ERP)',
  'Saisie vocale terrain illimitée',
  'Photos géolocalisées illimitées',
  'Exports universels (PDF, Word, CSV, JSON, ZIP Liciel)',
  'Bouton « Partager » 3 modes vers votre logiciel',
  'Sync iPad / iPhone / Web en temps réel',
  "Mode offline complet, jusqu'à 14 jours",
  'Templates T2 / T3 / T4 / T5 maison & appartement',
  'Check-lists de complétude par diagnostic',
  'Validation cohérence avant export',
  'Hébergement EU (Paris) · conformité RGPD',
  'Support email sous 24 h ouvrées',
]

function IncludedSection() {
  return (
    <section className="bg-white border-y border-[#0F1419]/[0.08] px-5 sm:px-12 py-20 sm:py-32 md:py-40">
      <div className="max-w-[1080px] mx-auto">
        <div className="text-center max-w-[820px] mx-auto mb-16">
          <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-medium mb-4">
            Inclus dès le premier euro
          </p>
          <h2 className="font-sans font-semibold text-[40px] sm:text-[56px] md:text-[72px] leading-[1.02] tracking-[-0.03em] mb-6">
            La base est livrée partout.
            <span className="text-[#0F1419]/35"> Même en Essential.</span>
          </h2>
          <p className="text-[17px] sm:text-[20px] text-[#0F1419]/72 leading-relaxed">
            Les 12 fonctionnalités cœur sont identiques quel que soit votre forfait. La
            différence se joue sur la profondeur IA (Haiku vocal, Vision IA, Croquis Apple
            Pencil), le nombre de diagnostics couverts, et les modules avancés (Cockpit ADEME
            Mode 2, Pennylane, Factur-X).
          </p>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-[15px]">
          {INCLUDED_FEATURES.map((feature) => (
            <li key={feature} className="relative pl-8 py-2.5 leading-snug">
              <span
                aria-hidden
                className="absolute left-1 top-[14px] block w-3 h-1.5 border-l-2 border-b-2 border-[#95B11A] -rotate-45"
              />
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-12 text-center">
          <Link
            href="/pricing/compare"
            className="inline-flex items-center gap-2 text-[#0F1419] font-medium border-b border-[#0F1419]/35 hover:border-[#0F1419] transition-colors"
          >
            Voir le comparatif détaillé des 5 forfaits →
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   ADD-ONS
   ============================================================ */
function AddonsSection() {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 max-w-[1080px] mx-auto">
      <div className="text-center max-w-[800px] mx-auto mb-12">
        <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-medium mb-4">
          Modules optionnels
        </p>
        <h2 className="text-[32px] sm:text-[44px] md:text-[56px] font-semibold tracking-[-0.025em] leading-[1.05] mb-5">
          Neuf modules à la carte,{' '}
          <span className="font-serif italic font-normal text-[#0F1419]/55">14 jours d'essai inclus</span>{' '}
          sur chacun.
        </h2>
        <p className="text-base sm:text-[17px] text-[#0F1419]/72 leading-relaxed">
          Vous n'activez que ce que vous voulez vraiment essayer. Tout module activé bénéficie
          d'un essai gratuit 14 jours, désactivable à tout moment depuis Réglages → Modules.
        </p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ADDON_MODULES.map((addon) => (
          <li
            key={addon.code}
            className="rounded-[20px] border border-[#0F1419]/[0.08] bg-white p-5 hover:border-[#0F1419]/35 transition-colors"
          >
            <p className="text-[15px] font-semibold text-[#0F1419] leading-snug mb-2">
              {addon.name}
            </p>
            <p className="text-[13px] text-[#0F1419]/72 leading-relaxed mb-4 min-h-[60px]">
              {addon.description}
            </p>
            <div className="flex items-baseline justify-between gap-3 pt-3 border-t border-[#0F1419]/[0.04]">
              <p className="font-semibold text-[14px] tabular-nums">
                {addon.monthlyPrice.toString().replace('.', ',')} €{' '}
                <span className="font-normal text-[#0F1419]/55">
                  {addon.overageUnit ? `/ mois (+ ${addon.overageUnit} en sus)` : '/ mois'}
                </span>
              </p>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#0F1419]/55 font-semibold">
                Essai 14 j
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-12 text-center">
        <Link
          href="/pricing/calculator"
          className="inline-flex items-center gap-2 bg-[#0F1419] text-white px-7 py-3.5 rounded-full text-[15px] font-semibold hover:bg-[#0F1419]/85 hover:-translate-y-px transition-all duration-150"
        >
          Construire mon offre sur mesure →
        </Link>
      </div>
    </section>
  )
}

/* ============================================================
   BANDE ANNUELLE (dark)
   ============================================================ */
const ANNUAL_COMPARISON = [
  { label: 'Essential', annual: '90 €/an', saved: '−18 € en annuel' },
  { label: 'Découverte', annual: '190 €/an', saved: '−38 € en annuel' },
  { label: 'Pro', annual: '350 €/an', saved: '−70 € en annuel' },
  { label: 'All Inclusive', annual: '490 €/an', saved: '−98 € en annuel' },
  { label: 'Cabinet', annual: '890 €/an', saved: '−178 € en annuel' },
]

function AnnualSection() {
  return (
    <section className="bg-[#0F1419] text-white px-5 sm:px-12 py-20 sm:py-32 md:py-40">
      <div className="max-w-[980px] mx-auto grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-10 md:gap-20 items-center">
        <div>
          <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-white/60 font-medium mb-6">
            Engagement annuel
          </p>
          <h2 className="text-[36px] sm:text-[48px] md:text-[60px] font-semibold leading-[1.04] tracking-[-0.03em] mb-5">
            Payez 10 mois,{' '}
            <span className="font-serif italic font-normal text-chartreuse">
              utilisez-en 12.
            </span>
          </h2>
          <p className="text-[17px] text-white/90 leading-[1.55]">
            Pas de réduction floue en pourcentage. Deux mois entiers offerts, prélèvement unique
            en début d'année, résiliation à échéance. Pour ceux qui savent déjà que KOVAS 360 reste —
            pas pour les indécis.
          </p>
        </div>

        <div className="bg-white/[0.04] border border-white/15 rounded-[24px] p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/60 font-semibold mb-[18px]">
            Comparaison mensuel · annuel
          </p>
          <ul className="space-y-0">
            {ANNUAL_COMPARISON.map((row, idx) => (
              <li
                key={row.label}
                className={`grid grid-cols-[1fr_auto_auto] gap-4 items-baseline text-sm ${
                  idx === 0 ? 'pt-0 border-t-0' : 'pt-3 border-t border-white/15'
                } pb-3`}
              >
                <span className="text-white/90 font-medium">{row.label}</span>
                <span className="text-white/60 tabular-nums text-right min-w-[80px]">
                  {row.annual}
                </span>
                <span className="text-chartreuse font-semibold tabular-nums text-right min-w-[90px]">
                  {row.saved}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-white/60 leading-[1.5]">
            Mensuel : sans engagement, résiliable à tout moment. Annuel : engagement 12 mois,
            prélèvement unique, remboursement au prorata sur les mois non consommés en cas de
            cessation d'activité justifiée.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   FAQ PRICING
   ============================================================ */
function FaqSection() {
  return (
    <section id="faq" className="px-5 sm:px-12 py-20 sm:py-32 md:py-40 max-w-[880px] mx-auto">
      <div className="text-center max-w-[720px] mx-auto">
        <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-medium mb-4">
          Questions tarifaires
        </p>
        <h2 className="font-sans font-semibold text-[40px] sm:text-[56px] md:text-[72px] leading-[1.02] tracking-[-0.03em] mb-6">
          Cinq questions{' '}
          <span className="text-[#0F1419]/35">qu'on vous pose tout le temps.</span>
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
        <span className="block text-[#0F1419]/35">Revenez voir pourquoi.</span>
      </h2>
      <p className="text-[17px] sm:text-[20px] text-[#0F1419]/72 max-w-[680px] mx-auto leading-relaxed mb-10">
        14 jours d'essai sans carte bancaire, accès complet à toutes les fonctionnalités du tier
        Pro pendant la période d'essai. 10 missions minimum suggérées pour valider sur vos vrais
        dossiers.
      </p>
      <div className="flex gap-4 justify-center flex-wrap">
        <Link
          href="/signup"
          className="bg-chartreuse text-[#0F1419] px-8 py-4 rounded-full text-base font-semibold hover:bg-chartreuse-deep hover:-translate-y-px transition-all duration-150"
        >
          Commencer mon essai
        </Link>
        <Link
          href="/"
          className="text-[#0F1419] px-7 py-4 text-base font-medium border-b border-transparent hover:border-[#0F1419] transition-colors"
        >
          ← Revoir comment ça marche
        </Link>
      </div>
    </section>
  )
}
