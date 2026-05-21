'use client'

/**
 * KOVAS — Barre d'action post-capture (V1.5 iteration 4).
 *
 * Apparaît 3.5s après la prise de photo et propose à l'utilisateur d'ajouter
 * une annotation vocale ou texte. Sans interaction, la barre se ferme
 * automatiquement et la photo reste seule.
 *
 * Authority : CLAUDE.md §3 feature #1 (saisie vocale terrain) + #2 (photos
 * annotées) + brief iteration 4.
 */

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, Mic, Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface PostPhotoActionBarProps {
  localPhotoId: string
  thumbnailUrl?: string
  onVoiceStart: () => void
  onTextStart: () => void
  /** Appelé sur tap ✓ ou timeout. */
  onDismiss: () => void
  /** Défaut 3500ms — durée avant auto-dismiss. */
  timeoutMs?: number
}

export function PostPhotoActionBar({
  localPhotoId,
  thumbnailUrl,
  onVoiceStart,
  onTextStart,
  onDismiss,
  timeoutMs = 3500,
}: PostPhotoActionBarProps) {
  const [remaining, setRemaining] = useState(timeoutMs)
  const dismissedRef = useRef(false)
  const startRef = useRef(Date.now())

  useEffect(() => {
    // Reset au mount (et si localPhotoId change : nouvelle photo)
    dismissedRef.current = false
    startRef.current = Date.now()
    setRemaining(timeoutMs)

    const tick = () => {
      if (dismissedRef.current) return
      const elapsed = Date.now() - startRef.current
      const left = Math.max(0, timeoutMs - elapsed)
      setRemaining(left)
      if (left <= 0) {
        dismissedRef.current = true
        onDismiss()
        return
      }
      raf = window.requestAnimationFrame(tick)
    }

    let raf = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(raf)
    }
    // Re-run uniquement si le localPhotoId change (nouvelle photo) ou si onDismiss change
  }, [localPhotoId, timeoutMs, onDismiss])

  function handleVoice() {
    if (dismissedRef.current) return
    dismissedRef.current = true
    onVoiceStart()
  }

  function handleText() {
    if (dismissedRef.current) return
    dismissedRef.current = true
    onTextStart()
  }

  function handleOk() {
    if (dismissedRef.current) return
    dismissedRef.current = true
    onDismiss()
  }

  const progressRatio = Math.max(0, Math.min(1, remaining / timeoutMs))

  return (
    // biome-ignore lint/a11y/useSemanticElements: barre flottante non-modale (pas <dialog>)
    <div
      role="dialog"
      aria-label="Ajouter une annotation à la photo"
      className={cn(
        'fixed top-16 right-0 left-0 z-40 px-3',
        'animate-in fade-in slide-in-from-top-2 duration-200',
        // safe area iOS
        'pt-[env(safe-area-inset-top)]',
      )}
    >
      <div
        className={cn(
          'mx-auto flex max-w-md items-center gap-3 overflow-hidden',
          'rounded-2xl border border-rule/80 bg-paper/95 px-3 py-2.5',
          'shadow-lg backdrop-blur',
          'relative',
        )}
      >
        {/* Thumbnail */}
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt="Capture terrain"
            className="size-10 shrink-0 rounded-lg border border-rule object-cover"
          />
        ) : (
          <div className="size-10 shrink-0 rounded-lg border border-rule bg-sage-alt/40" />
        )}

        {/* Boutons */}
        <div className="flex flex-1 items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleVoice}
            className="gap-1.5"
            aria-label="Ajouter une note vocale"
          >
            <Mic className="size-4" aria-hidden />
            <span className="hidden sm:inline">Voix</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleText}
            className="gap-1.5"
            aria-label="Ajouter une note texte"
          >
            <Pencil className="size-4" aria-hidden />
            <span className="hidden sm:inline">Note</span>
          </Button>
          <Button
            type="button"
            variant="accent"
            size="sm"
            onClick={handleOk}
            className="gap-1.5"
            aria-label="Valider sans annotation"
          >
            <Check className="size-4" aria-hidden />
            <span className="hidden sm:inline">OK</span>
          </Button>
        </div>

        {/* Barre de progression — se vide de gauche à droite (largeur → 0) */}
        <span
          aria-hidden
          className="absolute right-0 bottom-0 left-0 h-0.5 origin-left bg-chartreuse"
          style={{
            transform: `scaleX(${progressRatio})`,
            transition: 'transform 0.1s linear',
          }}
        />
      </div>
    </div>
  )
}
