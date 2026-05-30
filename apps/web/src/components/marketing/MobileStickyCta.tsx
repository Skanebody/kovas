'use client'

/**
 * MobileStickyCta — Barre CTA persistante en bas de viewport (mobile only).
 *
 * Pattern reconnu (CXL, Unbounce, Joanna Wiebe) sur landing B2B long-form :
 *   - +15-20% conversion mobile vs page sans sticky
 *   - Tugan Bara : "always be selling" → CTA toujours à portée de pouce
 *   - Apparaît après scroll > 600 px (hero déjà absorbé)
 *   - lg:hidden — desktop garde l'expérience inline pure (pas intrusif)
 *
 * Repli latéral (au lieu d'une fermeture définitive) :
 *   - Décision Benjamin (2026-05-30) : un visiteur non inscrit ne doit PAS
 *     pouvoir supprimer le CTA. La croix (X) est remplacée par une flèche qui
 *     replie la barre sur le côté droit, ne laissant qu'une petite poignée.
 *   - Un appui sur la poignée fait réapparaître la barre instantanément.
 *   - L'état replié est mémorisé en sessionStorage (reste replié pendant la
 *     navigation, réapparaît à la session suivante OU dès l'appui sur la poignée).
 *
 * Performance :
 *   - Passive scroll listener (rAF throttled)
 *   - Pas de layout shift (monté dès J0, transform transition)
 *   - Respect prefers-reduced-motion (transition courte uniquement)
 *
 * Accessibilité :
 *   - role="region" + aria-label
 *   - Poignée : aria-expanded + aria-label explicite
 *   - Focusable mais ne capture pas le focus initial
 */

import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const COLLAPSE_KEY = 'kovas:home-sticky-cta-collapsed'
const SCROLL_THRESHOLD_PX = 600
// Distance avant le bas du document à laquelle on masque la sticky pour
// laisser respirer le CTA final (sinon redondance + recouvre le footer).
const HIDE_BEFORE_BOTTOM_PX = 800

export function MobileStickyCta(): React.ReactElement {
  const [visible, setVisible] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // SSR-safe : on lit sessionStorage uniquement côté client
    try {
      if (sessionStorage.getItem(COLLAPSE_KEY) === '1') {
        setCollapsed(true)
      }
    } catch {
      // Storage bloqué (Safari private, etc.) — on continue sans persistance
    }

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const scrollY = window.scrollY
        const docHeight = document.documentElement.scrollHeight
        const viewportH = window.innerHeight
        const distanceFromBottom = docHeight - (scrollY + viewportH)
        const pastHero = scrollY > SCROLL_THRESHOLD_PX
        const beforeFinalCta = distanceFromBottom > HIDE_BEFORE_BOTTOM_PX
        setVisible(pastHero && beforeFinalCta)
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const collapse = () => {
    setCollapsed(true)
    try {
      sessionStorage.setItem(COLLAPSE_KEY, '1')
    } catch {
      /* noop */
    }
  }

  const expand = () => {
    setCollapsed(false)
    try {
      sessionStorage.removeItem(COLLAPSE_KEY)
    } catch {
      /* noop */
    }
  }

  // Barre : descend hors écran tant qu'on n'a pas scrollé (translate-y-full),
  // glisse vers la droite quand l'utilisateur la replie (translate-x-full),
  // visible sinon.
  const barTransform = !visible
    ? 'translate-y-full'
    : collapsed
      ? 'translate-x-full'
      : 'translate-y-0'

  return (
    <>
      {/* Poignée latérale (visible uniquement quand la barre est repliée) */}
      <button
        type="button"
        onClick={expand}
        aria-label="Afficher l'offre d'essai 30 jours à 0 €"
        aria-expanded={false}
        className={`lg:hidden fixed right-0 bottom-[max(env(safe-area-inset-bottom),16px)] z-40 inline-flex items-center gap-1.5 rounded-l-pill bg-chartreuse text-ink font-medium text-[12px] pl-2.5 pr-3 py-2 min-h-[44px] shadow-[0_4px_16px_rgba(0,0,0,0.22)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
          visible && collapsed ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <ChevronLeft className="size-4 shrink-0" />
        <span className="whitespace-nowrap">Essai · 0 €</span>
      </button>

      {/* Barre CTA complète */}
      <section
        aria-label="Démarrer un essai gratuit"
        aria-hidden={collapsed}
        className={`lg:hidden fixed bottom-0 inset-x-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 bg-[#0F1419] text-paper border-t border-paper/10 shadow-[0_-8px_24px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-out motion-reduce:transition-none ${barTransform}`}
      >
        <div className="flex items-center gap-3 max-w-[640px] mx-auto">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium leading-tight">Essai 30 jours · 0 €</p>
            <p className="text-[11px] text-paper/60 leading-tight mt-0.5">Aucun débit avant J+30</p>
          </div>
          <Link
            href="/signup/qualify"
            className="inline-flex items-center gap-2 rounded-pill bg-chartreuse text-ink font-medium text-[13px] px-5 py-2.5 min-h-[44px] whitespace-nowrap hover:bg-chartreuse-deep transition-colors"
          >
            Démarrer
            <ArrowRight className="size-4" />
          </Link>
          <button
            type="button"
            onClick={collapse}
            aria-label="Réduire l'offre sur le côté"
            aria-expanded={true}
            className="size-9 rounded-full flex items-center justify-center text-paper/55 hover:text-paper hover:bg-paper/10 transition-colors -mr-1"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </section>
    </>
  )
}
