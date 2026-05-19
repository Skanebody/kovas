'use client'

import { MapPin, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { getViewType } from '@/lib/photo-view-types'
import { assignPhotoToRoomAction, deletePhotoAction } from './actions'

interface Photo {
  id: string
  storage_path: string
  width: number | null
  height: number | null
  size_bytes: number | null
  room_id: string | null
  taken_at: string | null
  view_type: string | null
  location_text: string | null // "POINT(lng lat)" extracted by parent server query
}

interface PhotoGalleryProps {
  dossierId: string
  photos: Photo[]
  rooms: { id: string; name: string }[]
}

export function PhotoGallery({ dossierId, photos, rooms }: PhotoGalleryProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()

  const photosByRoom = useMemo(() => {
    const byRoom: Record<string, Photo[]> = { _unassigned: [] }
    for (const r of rooms) byRoom[r.id] = []
    for (const p of photos) {
      const key = p.room_id ?? '_unassigned'
      ;(byRoom[key] ?? (byRoom[key] = [])).push(p)
    }
    return byRoom
  }, [photos, rooms])

  // Fetch signed URLs in batch (1h expiry)
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (photos.length === 0) return
      const supabase = createClient()
      const { data } = await supabase.storage
        .from('mission-photos')
        .createSignedUrls(photos.map((p) => p.storage_path), 3600)
      if (!cancelled && data) {
        const map: Record<string, string> = {}
        for (let i = 0; i < photos.length; i++) {
          const url = data[i]?.signedUrl
          if (url) map[photos[i]!.id] = url
        }
        setSignedUrls(map)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [photos])

  function handleDelete(photoId: string, storagePath: string) {
    if (!confirm('Supprimer cette photo ? Action irréversible.')) return
    startTransition(async () => {
      await deletePhotoAction(dossierId, photoId, storagePath)
    })
  }

  function handleAssign(photoId: string, roomId: string) {
    startTransition(async () => {
      await assignPhotoToRoomAction(dossierId, photoId, roomId || null)
    })
  }

  if (photos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune photo. Utilisez le bouton "Prendre photo(s)" ci-dessus.
      </p>
    )
  }

  const sections = [
    { id: '_unassigned', name: 'Sans pièce assignée', photos: photosByRoom._unassigned ?? [] },
    ...rooms.map((r) => ({ id: r.id, name: r.name, photos: photosByRoom[r.id] ?? [] })),
  ].filter((s) => s.photos.length > 0)

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.id} className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            {section.name}
            <Badge variant="muted">{section.photos.length}</Badge>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {section.photos.map((p) => (
              <div
                key={p.id}
                className="group relative rounded-lg overflow-hidden border border-border bg-muted aspect-square"
              >
                {signedUrls[p.id] ? (
                  <Image
                    src={signedUrls[p.id]!}
                    alt={p.taken_at ?? 'Photo terrain'}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 20vw"
                    unoptimized
                  />
                ) : (
                  <div className="size-full bg-muted animate-pulse" />
                )}
                {p.view_type && (
                  <div className="absolute top-1 left-1">
                    <Badge variant="default" className="text-[9px] py-0 px-1.5 bg-foreground/80 backdrop-blur-sm">
                      {getViewType(p.view_type)?.label ?? p.view_type}
                    </Badge>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                  <Select
                    defaultValue={p.room_id ?? ''}
                    onChange={(e) => handleAssign(p.id, e.target.value)}
                    className="h-7 text-xs bg-white/90 text-zinc-900"
                    aria-label="Assigner à une pièce"
                  >
                    <option value="">— Sans pièce —</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </Select>
                  <div className="flex items-center justify-between text-[10px] text-white/90">
                    {p.location_text && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" /> GPS
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 text-white/90 hover:text-white hover:bg-white/10"
                      onClick={() => handleDelete(p.id, p.storage_path)}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
