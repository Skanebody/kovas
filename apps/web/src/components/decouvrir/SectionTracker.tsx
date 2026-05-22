'use client'

import { trackSectionViewed } from '@/lib/decouvrir/analytics'
import { useIntentTracker } from '@/lib/decouvrir/intent-tracker'
import type { DecouvrirSection } from '@/lib/decouvrir/recommendations'
import { useEffect, useRef, type ReactNode } from 'react'

interface SectionTrackerProps {
  section: DecouvrirSection
  /** Titre H2 affiché en haut de la section */
  title: string
  /** Mot-clé Instrument Serif italic accolé au titre */
  accent?: string
  /** Description sobre sous le titre */
  description?: string
  /** ID HTML pour ancrage (recommandée + scrollIntoView) */
  anchorId?: string
  children: ReactNode
}

/**
 * SectionTracker — wrap d'une section avec :
 *  - intersection observer pour détecter sa visibilité
 *  - tracking du temps passé (commit dans store + analytics au quit)
 *  - tracking de la profondeur de scroll dans la section
 *
 * Le titre est aligné avec AppPageHeader (sans-serif léger + accent serif italic).
 */
export function SectionTracker({
  section,
  title,
  accent,
  description,
  anchorId,
  children,
}: SectionTrackerProps) {
  const ref = useRef<HTMLElement | null>(null)
  const setActiveSection = useIntentTracker((s) => s.setActiveSection)
  const setSectionScrollDepth = useIntentTracker((s) => s.setSectionScrollDepth)
  const sectionEnteredAtRef = useRef<number | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
            setActiveSection(section)
            sectionEnteredAtRef.current = Date.now()
          } else if (!entry.isIntersecting && sectionEnteredAtRef.current) {
            const duration = Date.now() - sectionEnteredAtRef.current
            trackSectionViewed(section, duration)
            sectionEnteredAtRef.current = null
          }
        }
      },
      {
        threshold: [0.0, 0.3, 0.6, 0.9],
        rootMargin: '-10% 0px -10% 0px',
      },
    )
    observer.observe(node)

    // Scroll depth dans la section
    const handleScroll = () => {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const sectionHeight = rect.height
      if (sectionHeight <= 0) return
      // depth = (haut viewport au-delà du haut section) / hauteur section
      const scrolled = Math.max(0, -rect.top + viewportHeight)
      const depth = Math.min(1, scrolled / sectionHeight)
      setSectionScrollDepth(section, depth)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', handleScroll)
      if (sectionEnteredAtRef.current) {
        const duration = Date.now() - sectionEnteredAtRef.current
        trackSectionViewed(section, duration)
        sectionEnteredAtRef.current = null
      }
    }
  }, [section, setActiveSection, setSectionScrollDepth])

  return (
    <section
      ref={ref}
      id={anchorId ?? `decouvrir-${section}`}
      className="scroll-mt-24"
      aria-labelledby={`heading-${section}`}
    >
      <header className="mb-6 space-y-1">
        <h2
          id={`heading-${section}`}
          className="font-sans font-light text-[28px] md:text-display-s tracking-tight text-ink leading-tight"
        >
          {title}
          {accent ? (
            <>
              {' '}
              <span className="font-serif italic font-normal">{accent}</span>
              <span className="text-ink-mute">.</span>
            </>
          ) : null}
        </h2>
        {description ? (
          <p className="text-sm text-ink-mute max-w-2xl">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  )
}
