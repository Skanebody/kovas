'use client'

/**
 * KOVAS — Section "Vous voulez quoi ?" — 2 gros boutons côte à côte qui
 * orientent vers la section Annuaire ou Logiciel via scroll smooth.
 */

import { ArrowRight } from 'lucide-react'

export function QueVoulezVousSection() {
  function scrollTo(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="px-5 sm:px-12 max-w-[1100px] mx-auto pb-16 sm:pb-24">
      <header className="text-center max-w-[640px] mx-auto mb-10">
        <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#0B1D33]/55 font-semibold mb-4">
          Vous voulez quoi ?
        </p>
        <h2 className="font-sans font-semibold text-[28px] sm:text-[36px] md:text-[44px] leading-[1.08] tracking-[-0.025em] text-[#0B1D33]">
          Deux objectifs,{' '}
          <span className="font-serif italic font-normal text-[#0B1D33]/72">deux parcours.</span>
        </h2>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-[860px] mx-auto">
        <button
          type="button"
          onClick={() => scrollTo('section-annuaire')}
          className="group text-left rounded-2xl bg-white border border-[#0B1D33]/[0.08] hover:border-[#0B1D33]/35 px-6 py-7 sm:px-7 sm:py-8 transition-colors"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0B1D33]/55 font-medium mb-3">
            Annuaire
          </p>
          <p className="font-sans font-semibold text-[20px] sm:text-[22px] text-[#0B1D33] leading-[1.2] mb-4">
            Recevoir plus de clients
          </p>
          <p className="text-[13px] text-[#0B1D33]/65 leading-relaxed mb-5">
            Votre fiche dans l&apos;annuaire public KOVAS — leads particuliers qualifiés livrés
            chaque mois.
          </p>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#0B1D33] group-hover:gap-2.5 transition-all">
            Voir les forfaits Annuaire
            <ArrowRight aria-hidden className="size-3.5" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => scrollTo('section-logiciel')}
          className="group text-left rounded-2xl bg-white border border-[#0B1D33]/[0.08] hover:border-[#0B1D33]/35 px-6 py-7 sm:px-7 sm:py-8 transition-colors"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0B1D33]/55 font-medium mb-3">
            Logiciel
          </p>
          <p className="font-sans font-semibold text-[20px] sm:text-[22px] text-[#0B1D33] leading-[1.2] mb-4">
            Gagner du temps administratif
          </p>
          <p className="text-[13px] text-[#0B1D33]/65 leading-relaxed mb-5">
            Le logiciel KOVAS — saisie vocale, exports universels, sync iPad / iPhone / Web.
          </p>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#0B1D33] group-hover:gap-2.5 transition-all">
            Voir les forfaits KOVAS
            <ArrowRight aria-hidden className="size-3.5" />
          </span>
        </button>
      </div>
    </section>
  )
}
