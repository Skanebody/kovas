'use client'

/**
 * MobileStickyCta — Barre CTA persistante en bas de viewport (mobile only).
 *
 * Pattern reconnu (CXL, Unbounce, Joanna Wiebe) sur landing B2B long-form :
 *   - +15-20% conversion mobile vs page sans sticky
 *   - Tugan Bara : "always be selling" → CTA toujours à portée de pouce
 *   - Apparaît après scroll > 600 px (hero déjà absorbé)
 *   - Dismissible (X) avec persistance sessionStorage (réapparait next session)
 *   - lg:hidden — desktop garde l'expérience inline pure (pas intrusif)
 *
 * Performance :
 *   - Passive scroll listener (rAF throttled)
 *   - Pas de layout shift (mounted dès J0, opacity/translate transition)
 *   - Respect prefers-reduced-motion (transition courte uniquement)
 *
 * Accessibilité :
 *   - role="region" + aria-label
 *   - Dismiss button avec aria-label explicite
 *   - Focusable mais ne capture pas le focus initial
 */

import { ArrowRight, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'kovas:home-sticky-cta-dismissed'
const SCROLL_THRESHOLD_PX = 600
// Distance avant le bas du document à laquelle on masque la sticky pour
// laisser respirer le CTA final (sinon redondance + recouvre le footer).
const HIDE_BEFORE_BOTTOM_PX = 800

export function MobileStickyCta(): React.ReactElement | null {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // SSR-safe : on lit sessionStorage uniquement côté client
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === '1') {
        setDismissed(true)
        return
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

  if (dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* noop */
    }
  }

  return (
    <section
      aria-label="Démarrer un essai gratuit"
      className={`lg:hidden fixed bottom-0 inset-x-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 bg-[#0F1419] text-paper border-t border-paper/10 shadow-[0_-8px_24px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
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
          onClick={handleDismiss}
          aria-label="Masquer la barre CTA"
          className="size-9 rounded-full flex items-center justify-center text-paper/55 hover:text-paper hover:bg-paper/10 transition-colors -mr-1"
        >
          <X className="size-4" />
        </button>
      </div>
    </section>
  )
}
