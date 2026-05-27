'use client'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, ImageIcon, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

export interface PropertyPhoto {
  id: string
  /** URL signée du thumb (ou storage_path public) */
  thumb_url: string | null
  /** Caption optionnelle */
  caption: string | null
}

interface Props {
  photos: PropertyPhoto[]
}

const GRID_MAX = 12

/**
 * Section 4 — Galerie (page property SIMP-2).
 *
 *  - Grid 2-3 cols, max 12 photos visibles
 *  - Click sur une photo → viewer plein écran Radix Dialog
 *  - Navigation ← / → (clavier + boutons), ESC pour fermer
 *  - Compteur "X / Y" + caption
 */
export function PropertyGallerieSection({ photos }: Props) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const visible = photos.slice(0, GRID_MAX)
  const hiddenCount = photos.length - visible.length

  const open = viewerIndex !== null
  const current = open ? photos[viewerIndex] : null
  const total = photos.length

  const goPrev = useCallback(() => {
    setViewerIndex((idx) => (idx === null ? null : (idx - 1 + total) % total))
  }, [total])

  const goNext = useCallback(() => {
    setViewerIndex((idx) => (idx === null ? null : (idx + 1) % total))
  }, [total])

  // Navigation clavier ← → (ESC géré nativement par Radix Dialog)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, goPrev, goNext])

  return (
    <section aria-labelledby="property-gallery-title" className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h2
          id="property-gallery-title"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute"
        >
          Galerie
        </h2>
        <span className="font-mono text-[11px] text-ink-mute">{photos.length}</span>
      </header>

      {photos.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Aucune photo sur ce bien."
          description="Ajoutez des photos depuis l'application mobile sur le terrain."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {visible.map((photo, idx) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setViewerIndex(idx)}
                aria-label={photo.caption ?? `Photo ${idx + 1}`}
                className="aspect-square overflow-hidden rounded-lg border border-rule/40 bg-sage/50 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
              >
                {photo.thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.thumb_url}
                    alt={photo.caption ?? ''}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-ink-mute">
                    <ImageIcon className="size-6" strokeWidth={1.5} />
                  </div>
                )}
              </button>
            ))}
          </div>

          {hiddenCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setViewerIndex(GRID_MAX)}
              aria-label={`Voir toutes les ${photos.length} photos`}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.1em]">
                Voir toutes les {photos.length} photos
              </span>
            </Button>
          ) : null}
        </>
      )}

      {/* Viewer plein écran Radix Dialog */}
      <Dialog.Root
        open={open}
        onOpenChange={(o) => {
          if (!o) setViewerIndex(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content
            className="fixed inset-0 z-50 flex flex-col outline-none"
            aria-describedby={undefined}
          >
            <Dialog.Title className="sr-only">
              {current?.caption ?? `Photo ${(viewerIndex ?? 0) + 1} sur ${total}`}
            </Dialog.Title>

            {/* Barre haut : compteur + bouton fermer */}
            <div className="flex shrink-0 items-center justify-between px-4 py-3 text-white">
              <span className="font-mono text-[12px] uppercase tracking-[0.1em]">
                {viewerIndex !== null ? `${viewerIndex + 1} / ${total}` : ''}
              </span>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Fermer la galerie"
                  className="inline-flex size-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <X className="size-5" strokeWidth={1.5} />
                </button>
              </Dialog.Close>
            </div>

            {/* Zone image centrale + flèches */}
            <div className="relative flex flex-1 items-center justify-center px-2 sm:px-12">
              {total > 1 ? (
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Photo précédente"
                  className="absolute left-2 sm:left-6 inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <ChevronLeft className="size-6" strokeWidth={1.5} />
                </button>
              ) : null}

              {current?.thumb_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.thumb_url}
                  alt={current.caption ?? ''}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="flex size-32 items-center justify-center text-white/40">
                  <ImageIcon className="size-12" strokeWidth={1.5} />
                </div>
              )}

              {total > 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Photo suivante"
                  className="absolute right-2 sm:right-6 inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <ChevronRight className="size-6" strokeWidth={1.5} />
                </button>
              ) : null}
            </div>

            {/* Caption bas */}
            {current?.caption ? (
              <div className="shrink-0 px-4 py-3 text-center">
                <p className="font-mono text-[12px] text-white/70 line-clamp-2">
                  {current.caption}
                </p>
              </div>
            ) : (
              <div className="shrink-0 py-3" />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  )
}
