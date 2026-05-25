'use client'

/**
 * KOVAS — InfoTooltip (Lot B67).
 *
 * Composant client réutilisable affichant une définition courte au hover
 * (desktop) ou tap (mobile) à côté d'un terme métier.
 *
 * Design (Brand V5 sobre Synthex/Quora) :
 *   - terme rendu en `<span>` underline pointillé navy/15 % + couleur inherit
 *   - icône `Info` Lucide 14px navy/55 % (toujours discrète, jamais accent)
 *   - popover bg #FFFFFF (paper), border #0F1419 12 % opacity, ombre légère,
 *     max-width 320px, padding 12px, font-size 13px (text-[13px])
 *   - JAMAIS de chartreuse, JAMAIS de cercle bleu géant
 *
 * Comportements :
 *   - hover/focus → ouverture (desktop)
 *   - tap → toggle (mobile, et fonctionne sans hover)
 *   - ESC → ferme
 *   - clic en dehors → ferme
 *   - aria-describedby relie le terme au popover
 *
 * Implémentation native (pas de dépendance Radix supplémentaire) pour
 * minimiser le bundle des pages publiques SEO. Si la complexité augmente,
 * migration possible vers `@radix-ui/react-tooltip` plus tard.
 */

import { cn } from '@/lib/utils'
import { Info } from 'lucide-react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'

export interface InfoTooltipSource {
  /** Label court affiché en pied de popover. */
  readonly label: string
  /** URL absolue ouverte dans un nouvel onglet. */
  readonly url: string
}

export interface InfoTooltipProps {
  /** Texte affiché souligné en pointillé. */
  readonly term: string
  /** Définition courte (≤ 30 mots, vouvoiement, sobre). */
  readonly definition: string
  /** Titre header du popover (par défaut : `term`). */
  readonly title?: string
  /** Source officielle (Légifrance, ADEME…) optionnelle. */
  readonly source?: InfoTooltipSource
  /** Classes additionnelles sur le `<span>` racine. */
  readonly className?: string
  /** Enfants alternatifs (sinon `term` est affiché). */
  readonly children?: ReactNode
}

/**
 * Hook utilitaire : ferme le tooltip au clic en dehors.
 */
function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  onOutside: () => void,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return
    function handler(event: MouseEvent | TouchEvent) {
      const node = ref.current
      if (!node) return
      if (event.target instanceof Node && !node.contains(event.target)) {
        onOutside()
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [active, onOutside, ref])
}

export function InfoTooltip({
  term,
  definition,
  title,
  source,
  className,
  children,
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLSpanElement | null>(null)
  const tooltipId = useId()
  const headerTitle = title ?? term

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  useClickOutside(containerRef, close, open)

  // ESC ferme le tooltip
  useEffect(() => {
    if (!open) return
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleButtonKey = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen((v) => !v)
    }
  }, [])

  return (
    <span
      ref={containerRef}
      className={cn('relative inline-flex items-baseline gap-1', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        className="underline decoration-dotted decoration-[#0F1419]/25 underline-offset-[3px]"
        // Le texte du terme reste inline avec le contexte (couleur héritée).
      >
        {children ?? term}
      </span>
      <button
        type="button"
        aria-label={`En savoir plus sur ${term}`}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleButtonKey}
        className={cn(
          'inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center align-middle',
          'rounded-full text-[#0F1419]/55 transition-colors',
          'hover:text-[#0F1419] focus-visible:text-[#0F1419]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F1419]/30 focus-visible:ring-offset-1',
        )}
      >
        <Info className="h-[14px] w-[14px]" aria-hidden="true" />
      </button>

      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            'absolute left-0 top-full z-50 mt-2 w-[min(320px,calc(100vw-2rem))]',
            'rounded-md border border-[#0F1419]/12 bg-white p-3 text-left',
            'shadow-[0_4px_16px_-2px_rgba(15,20,25,0.12),0_2px_4px_-1px_rgba(15,20,25,0.06)]',
            'text-[13px] leading-relaxed text-[#0F1419]',
          )}
          // Empêche la fermeture quand on passe la souris sur le popover.
          onMouseEnter={() => setOpen(true)}
        >
          <span className="block font-semibold text-[#0F1419]">{headerTitle}</span>
          <span className="mt-1 block text-[#0F1419]/75">{definition}</span>
          {source ? (
            <span className="mt-2 block">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/60 underline-offset-2 hover:text-[#0F1419] hover:underline"
              >
                Source · {source.label}
              </a>
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  )
}
