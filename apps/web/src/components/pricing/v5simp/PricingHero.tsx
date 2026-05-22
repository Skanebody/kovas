'use client'

/**
 * KOVAS — Hero page tarifs publique refondue scroll linéaire (V5 simplifié).
 *
 * Style : navy + cream + Instrument Serif italic + chartreuse accent (page
 * publique marketing, PAS le sage des pages app). Pas d'emoji.
 */

import Link from 'next/link'

export function PricingHero() {
  return (
    <section className="px-5 sm:px-12 max-w-[1100px] mx-auto text-center pt-20 sm:pt-28 md:pt-36 pb-12 sm:pb-16">
      <p className="font-mono text-[12px] sm:text-[13px] uppercase tracking-[0.18em] text-[#0B1D33]/55 font-medium mb-8">
        Tarification KOVAS
      </p>
      <h1 className="font-sans font-semibold text-[44px] sm:text-[64px] md:text-[80px] leading-[1.02] tracking-[-0.035em] text-[#0B1D33] mb-7">
        Le logiciel et{' '}
        <span className="font-serif italic font-normal text-[#0B1D33]/72">
          l&apos;annuaire
        </span>{' '}
        pour diagnostiqueurs immobiliers.
      </h1>
      <p className="text-[17px] sm:text-[19px] md:text-[21px] text-[#0B1D33]/72 max-w-[760px] mx-auto leading-[1.5] mb-10">
        Recevez plus de clients avec l&apos;annuaire public. Gagnez 1h30 par mission avec
        le logiciel KOVAS 360. Achetables séparément ou en bundle remisé.
      </p>

      <Link
        href="/signup?plan=logiciel_starter"
        aria-label="Essayer KOVAS 360 gratuitement 30 jours avec carte bancaire enregistrée et débit automatique à l’issue"
        className="inline-flex items-center justify-center gap-2 bg-[#D4F542] text-[#0B1D33] px-8 py-4 rounded-full text-[15px] font-semibold hover:bg-[#A3C920] hover:-translate-y-px transition-all duration-150 shadow-[0_8px_24px_rgba(212,245,66,0.35)]"
      >
        Essayer gratuitement
      </Link>

      <div className="mt-7 flex gap-5 justify-center flex-wrap text-[13px] text-[#0B1D33]/55">
        <span>30 jours d&apos;essai</span>
        <span className="hidden sm:inline text-[#0B1D33]/20">·</span>
        <span>CB enregistrée, débit auto à J+30</span>
        <span className="hidden sm:inline text-[#0B1D33]/20">·</span>
        <span>Résiliable à tout moment</span>
      </div>
    </section>
  )
}
