'use client'

import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { Plus, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface FabRadialAction {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
}

interface FabRadialProps {
  /** Icone du bouton principal. Défaut Plus, devient X en mode ouvert. */
  mainIcon?: LucideIcon
  /** 4-6 sous-actions déployées en arc 180°. */
  actions: readonly FabRadialAction[]
  /** Callback long press (mode mains-libres vocal par exemple). */
  onLongPress?: () => void
  /** Position du FAB. Défaut bottom-right. */
  position?: 'bottom-right' | 'bottom-center'
  /** Force la taille du FAB principal — utile pour mode terrain (80px). */
  size?: 'default' | 'large'
  /** Override `aria-label` du bouton principal. */
  ariaLabel?: string
  className?: string
}

const LONG_PRESS_MS = 800

/**
 * FAB radial réutilisable : un bouton principal qui déploie 4-6 sous-boutons en
 * arc 180° (haut, haut-gauche, haut-droite, gauche, droite selon le nombre).
 *
 * Spec V5 :
 * — Bouton principal rond size-16 (64px) bg sidebar-bg, icon Plus → X au open
 * — Sous-boutons rond size-14 (56px) bg paper border navy 1px, label mono uppercase 9px
 * — Animation 200ms (translate + scale + opacity)
 * — Long press 800ms → onLongPress (mode hands-free)
 * — Click outside ou second click principal → close
 * — `position='bottom-center'` : useful sur mobile (centré au-dessus du nav tabs)
 */
export function FabRadial({
  mainIcon: MainIcon = Plus,
  actions,
  onLongPress,
  position = 'bottom-right',
  size = 'default',
  ariaLabel = 'Actions rapides',
  className,
}: FabRadialProps) {
  const [open, setOpen] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggered = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Click outside → close
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent): void {
      if (!containerRef.current) return
      if (containerRef.current.contains(e.target as Node)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handlePointerDown = useCallback(() => {
    longPressTriggered.current = false
    if (!onLongPress) return
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      onLongPress()
    }, LONG_PRESS_MS)
  }, [onLongPress])

  const handlePointerUp = useCallback(() => {
    clearLongPress()
  }, [clearLongPress])

  const handleClick = useCallback(() => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false
      return
    }
    setOpen((prev) => !prev)
  }, [])

  // Position du FAB principal
  const fabPosition =
    position === 'bottom-center'
      ? 'fixed bottom-[80px] left-1/2 -translate-x-1/2'
      : 'fixed bottom-6 right-6'

  // Taille du FAB principal
  const fabSize = size === 'large' ? 'size-20' : 'size-16'
  const subFabSize = size === 'large' ? 'size-16' : 'size-14'

  // Calcul positions sous-boutons en arc 180°
  // Pour N actions : angles répartis entre 180° (gauche) et 360° (droite) en passant par le haut
  // Distance du FAB principal : 84px (size-16 + gap)
  const arcRadius = size === 'large' ? 110 : 90

  return (
    <div ref={containerRef} className={cn('z-40', fabPosition, className)}>
      {/* Sous-boutons en arc */}
      <ul aria-hidden={!open} className="absolute inset-0 pointer-events-none" role="menu">
        {actions.map((action, idx) => {
          // Angle en degrés : 180° (gauche pure) à 360°/0° (droite pure)
          // On veut un arc qui se déploie vers le haut.
          // Pour position bottom-right : arc va vers haut-gauche (180° à 270°)
          // Pour position bottom-center : arc symétrique (180° à 360°)
          const totalAngle = position === 'bottom-center' ? 180 : 90
          const startAngle = position === 'bottom-center' ? 180 : 180
          const step = actions.length > 1 ? totalAngle / (actions.length - 1) : 0
          const angleDeg = startAngle + step * idx
          const angleRad = (angleDeg * Math.PI) / 180
          const dx = Math.cos(angleRad) * arcRadius
          const dy = Math.sin(angleRad) * arcRadius

          const Icon = action.icon
          return (
            <li
              key={action.label}
              className="absolute pointer-events-none"
              style={{
                bottom: 0,
                right: position === 'bottom-right' ? 0 : '50%',
                transform: open
                  ? `translate(${position === 'bottom-right' ? dx : dx + (subFabSize === 'size-16' ? 32 : 28)}px, ${dy}px) scale(1)`
                  : 'translate(0, 0) scale(0.5)',
                opacity: open ? 1 : 0,
                transition: `transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 30}ms, opacity 200ms ease ${idx * 30}ms`,
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  if (action.disabled) return
                  action.onClick()
                  setOpen(false)
                }}
                disabled={action.disabled}
                aria-label={action.label}
                tabIndex={open ? 0 : -1}
                className={cn(
                  'pointer-events-auto flex flex-col items-center justify-center gap-1',
                  'bg-paper border border-sidebar-bg rounded-full',
                  subFabSize,
                  'text-sidebar-bg hover:bg-sage transition-colors',
                  'active:scale-95',
                  action.disabled && 'opacity-50 cursor-not-allowed',
                )}
              >
                <Icon className="size-4" strokeWidth={1.5} />
              </button>
              {/* Label sous le bouton */}
              <span
                className={cn(
                  'absolute top-full left-1/2 -translate-x-1/2 mt-1',
                  'text-[9px] font-mono uppercase tracking-[0.1em] text-sidebar-bg',
                  'whitespace-nowrap pointer-events-none',
                  'bg-paper/90 px-1.5 py-0.5 border border-rule',
                )}
              >
                {action.label}
              </span>
            </li>
          )
        })}
      </ul>

      {/* Bouton principal */}
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label={open ? `Fermer ${ariaLabel.toLowerCase()}` : ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'relative flex items-center justify-center',
          'bg-sidebar-bg border border-sidebar-bg rounded-full text-white',
          fabSize,
          'transition-transform duration-base ease-spring',
          'active:scale-95',
          'hover:shadow-lg',
          open && 'rotate-45',
        )}
      >
        {open ? (
          <X className="size-6 -rotate-45" strokeWidth={2} />
        ) : (
          <MainIcon className="size-6" strokeWidth={2} />
        )}
      </button>
    </div>
  )
}
