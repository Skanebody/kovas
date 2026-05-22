'use client'

import { cn } from '@/lib/utils'
import type { GuideSection } from '@/lib/guides/types'
import { ChevronRight, List } from 'lucide-react'
import { useEffect, useState } from 'react'

interface GuideTOCProps {
  readonly sections: ReadonlyArray<GuideSection>
  readonly className?: string
}

/**
 * Table des matières d'un guide.
 *
 * Desktop : sticky sidebar avec liens vers chaque H2 (level 2 uniquement).
 * Active section mise en avant via IntersectionObserver.
 * Mobile : bouton "Sommaire" qui ouvre un drawer (collapse simple via state).
 *
 * 'use client' nécessaire pour l'observer + état UI (drawer mobile,
 * active section). Toujours rendu en HTML SSR pour le SEO.
 */
export function GuideTOC({ sections, className }: GuideTOCProps) {
  const h2Sections = sections.filter((s) => s.level === 2)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return

    // Marge négative en haut pour déclencher l'active quand la section est
    // dans le tiers supérieur de l'écran ; -60% en bas pour anticiper.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          const target = visible[0]
          if (target?.target.id) setActiveId(target.target.id)
        }
      },
      { rootMargin: '-20% 0px -60% 0px' },
    )

    for (const section of h2Sections) {
      const el = document.getElementById(section.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [h2Sections])

  return (
    <>
      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 rounded-pill border border-rule/60 bg-paper px-3 py-2 font-mono text-xs text-ink lg:hidden',
        )}
        aria-expanded={mobileOpen}
        aria-controls="guide-toc"
      >
        <List className="size-4" aria-hidden />
        Sommaire
      </button>

      <nav
        id="guide-toc"
        aria-label="Sommaire du guide"
        className={cn(
          'rounded-lg border border-rule/40 bg-paper p-5',
          // Mobile : drawer collapsé
          mobileOpen ? 'mt-3 block' : 'mt-3 hidden',
          // Desktop : toujours visible, sticky
          'lg:sticky lg:top-24 lg:mt-0 lg:block',
          className,
        )}
      >
        <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-mute">
          Sommaire
        </p>
        <ol className="space-y-1.5">
          {h2Sections.map((section, idx) => {
            const isActive = activeId === section.id
            return (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'group flex items-start gap-2 rounded-md px-2 py-1.5 text-sm leading-snug transition-colors',
                    isActive
                      ? 'bg-ink/5 font-medium text-ink'
                      : 'text-ink-mute hover:bg-ink/[0.03] hover:text-ink',
                  )}
                >
                  <ChevronRight
                    className={cn(
                      'mt-0.5 size-3.5 shrink-0 transition-transform',
                      isActive
                        ? 'translate-x-0.5 text-chartreuse-deep'
                        : 'opacity-50',
                    )}
                    aria-hidden
                  />
                  <span>
                    <span className="font-mono text-[10px] text-ink-faint">
                      {String(idx + 1).padStart(2, '0')}
                    </span>{' '}
                    {section.title}
                  </span>
                </a>
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}
