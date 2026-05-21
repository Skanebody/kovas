'use client'

import { PhotoGallery } from '@/app/dashboard/dossiers/[id]/photo-gallery'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { cn } from '@/lib/utils'
import { Camera } from 'lucide-react'

interface PhotosAccordionPhoto {
  id: string
  storage_path: string
  width: number | null
  height: number | null
  size_bytes: number | null
  room_id: string | null
  taken_at: string | null
  view_type: string | null
  location_text: string | null
}

interface PhotosAccordionProps {
  dossierId: string
  photos: PhotosAccordionPhoto[]
  rooms: { id: string; name: string }[]
  defaultExpanded?: boolean
  className?: string
}

/**
 * Wrapper accordion autour de PhotoGallery existante (réutilisation).
 *
 * Le contenu n'est pas dupliqué — on délègue à `<PhotoGallery>` (cf.
 * `apps/web/src/app/app/dossiers/[id]/photo-gallery.tsx`). Le but est
 * d'unifier le pattern accordion sur la page dossier refondue.
 */
export function PhotosAccordion({
  dossierId,
  photos,
  rooms,
  defaultExpanded = false,
  className,
}: PhotosAccordionProps) {
  return (
    <div className={cn(className)}>
      <CollapsibleSection
        storageKey={`kovas_dossier_${dossierId}_photos_accordion`}
        defaultExpanded={defaultExpanded}
        title={
          <span className="flex items-center gap-2">
            <Camera aria-hidden className="size-4 text-ink-mute" />
            <span>Photos</span>
          </span>
        }
        meta={`${photos.length} photo${photos.length > 1 ? 's' : ''}`}
      >
        <PhotoGallery dossierId={dossierId} photos={photos} rooms={rooms} />
      </CollapsibleSection>
    </div>
  )
}
