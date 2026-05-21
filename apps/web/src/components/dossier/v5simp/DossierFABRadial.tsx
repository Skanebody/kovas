'use client'

import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { Camera, Mic, Plus, Ruler, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface DossierFABRadialProps {
  onPhoto: () => void
  onVoice: () => void
  onMeasure: () => void
  onAI: () => void
}

interface FabAction {
  id: 'photo' | 'voice' | 'measure' | 'ai'
  label: string
  Icon: typeof Camera
  onClick: () => void
}

/**
 * FAB radial bottom-right avec 4 actions (Photo / Vocal / Mesure / IA).
 * Tap court : déploie en arc. Long press (~700ms) : toast "mode mains-libres".
 *
 * Strictement 4 actions — pas 6 (cf. spec V5 simp).
 */
export function DossierFABRadial({ onPhoto, onVoice, onMeasure, onAI }: DossierFABRadialProps) {
  const [open, setOpen] = useState(false)
  const longPressTimer = useRef<number | null>(null)
  const longPressTriggered = useRef(false)

  const actions: FabAction[] = [
    { id: 'photo', label: 'Photo', Icon: Camera, onClick: onPhoto },
    { id: 'voice', label: 'Vocal', Icon: Mic, onClick: onVoice },
    { id: 'measure', label: 'Mesure', Icon: Ruler, onClick: onMeasure },
    { id: 'ai', label: 'IA', Icon: Sparkles, onClick: onAI },
  ]

  // Ferme la FAB sur Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function handlePointerDown() {
    longPressTriggered.current = false
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true
      toast.info('Mode mains-libres : dites « ok kovas » pour démarrer.')
    }, 700)
  }

  function handlePointerUp() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handleClick() {
    // Long press affiche le toast et ne toggle pas l'overlay
    if (longPressTriggered.current) {
      longPressTriggered.current = false
      return
    }
    setOpen((v) => !v)
  }

  function handleActionClick(action: FabAction) {
    setOpen(false)
    action.onClick()
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 pointer-events-none">
      {/* Halo actions radial */}
      <div
        className={cn(
          'absolute bottom-16 right-0 flex flex-col-reverse items-end gap-2 pointer-events-auto transition-all duration-base',
          open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none',
        )}
        aria-hidden={!open}
      >
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => handleActionClick(a)}
            className="flex items-center gap-2 rounded-pill bg-paper border border-rule shadow-sm px-3.5 py-2 text-[12px] font-medium text-ink hover:bg-cream-deep transition-colors duration-fast"
            aria-label={a.label}
            tabIndex={open ? 0 : -1}
          >
            <a.Icon className="size-4" />
            <span>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Bouton principal */}
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={open ? 'Fermer les actions' : 'Ouvrir les actions'}
        aria-expanded={open}
        className="pointer-events-auto size-14 rounded-full bg-navy text-paper shadow-accent flex items-center justify-center transition-transform duration-fast active:scale-95"
      >
        {open ? <X className="size-5" /> : <Plus className="size-5" />}
      </button>
    </div>
  )
}
