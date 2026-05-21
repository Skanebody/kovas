'use client'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ImageIcon } from 'lucide-react'
import { useState } from 'react'

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
 *  - Au-delà : bouton "Voir toutes les X photos" → BottomSheet fullscreen viewer (V1 stub simple)
 */
export function PropertyGallerieSection({ photos }: Props) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const visible = photos.slice(0, GRID_MAX)
  const hiddenCount = photos.length - visible.length

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
            {visible.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setViewerOpen(true)}
                aria-label={photo.caption ?? 'Photo'}
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
              onClick={() => setViewerOpen(true)}
              aria-label={`Voir toutes les ${photos.length} photos`}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.1em]">
                Voir toutes les {photos.length} photos
              </span>
            </Button>
          ) : null}
        </>
      )}

      {/* Viewer V1 stub : liste full sans navigation/zoom */}
      <BottomSheet
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        title="Galerie"
        description={`${photos.length} photo${photos.length > 1 ? 's' : ''}`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-2 pb-4">
          {photos.map((photo) => (
            <div
              key={`viewer-${photo.id}`}
              className="aspect-square overflow-hidden rounded-lg border border-rule/40 bg-sage/50"
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
            </div>
          ))}
        </div>
      </BottomSheet>
    </section>
  )
}
