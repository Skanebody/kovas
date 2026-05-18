'use client'

import { Camera, ChevronDown, Loader2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select } from '@/components/ui/select'
import {
  GROUP_LABELS,
  type ViewType,
  getViewType,
  pinnedViewTypes,
  viewTypesByGroup,
} from '@/lib/photo-view-types'
import { buildPhotoFileName } from '@/lib/file-naming'
import { getCurrentPosition } from '@/lib/geolocation'
import { compressImage } from '@/lib/image-compress'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { createPhotoAction } from './actions'

interface PhotoCaptureProps {
  dossierId: string
  dossierReference?: string
  orgId: string
  rooms: { id: string; name: string }[]
  defaultRoomId?: string
  /** Indices courants pour chaque pièce (count des photos déjà uploadées) */
  photoCountsByRoom?: Record<string, number>
  /** Position de chaque pièce dans le dossier (pour PIECE-XX-Nom) */
  roomIndexById?: Record<string, number>
}

export function PhotoCapture({
  dossierId,
  dossierReference,
  orgId,
  rooms,
  defaultRoomId,
  photoCountsByRoom = {},
  roomIndexById = {},
}: PhotoCaptureProps) {
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<string>(defaultRoomId ?? '')
  const [selectedView, setSelectedView] = useState<string>('vue_generale')
  const inputRef = useRef<HTMLInputElement>(null)

  const pinned = pinnedViewTypes()
  const grouped = viewTypesByGroup()

  async function handleFiles(filesList: FileList | null) {
    if (!filesList || filesList.length === 0) return
    setBusy(true)
    setError(null)
    const files = Array.from(filesList)
    setProgress({ current: 0, total: files.length })

    const supabase = createClient()
    const gps = await getCurrentPosition()
    const viewType = getViewType(selectedView)

    // Compteur local (incrémenté par photo dans la même session)
    let nextPhotoIndex = selectedRoom ? (photoCountsByRoom[selectedRoom] ?? 0) + 1 : 1
    const roomData = rooms.find((r) => r.id === selectedRoom)
    const roomIndex = selectedRoom ? roomIndexById[selectedRoom] ?? 1 : 1

    try {
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length })
        const file = files[i]!
        const compressed = await compressImage(file)

        // Convention nommage : 2026-05-18_PIECE-01-Salon_003_RADIATEUR_DOS-2026-XXXX.webp
        // ou _SANS-PIECE_NNN_VUE_REF.webp si pas de room
        const filename = dossierReference
          ? roomData
            ? buildPhotoFileName({
                date: new Date(),
                reference: dossierReference,
                roomIndex,
                roomName: roomData.name,
                photoIndex: nextPhotoIndex,
                viewType: viewType?.filenameTag,
              })
            : buildPhotoFileName({
                date: new Date(),
                reference: dossierReference,
                roomIndex: 0,
                roomName: 'Sans-Piece',
                photoIndex: nextPhotoIndex,
                viewType: viewType?.filenameTag,
              })
          : // Fallback si pas de référence (ne devrait pas arriver, mais safe)
            `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`

        const storagePath = `${orgId}/${dossierId}/${filename}`

        const { error: uploadError } = await supabase.storage
          .from('mission-photos')
          .upload(storagePath, compressed.blob, {
            contentType: 'image/webp',
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          throw new Error(`Upload Storage : ${uploadError.message}`)
        }

        await createPhotoAction({
          dossierId,
          roomId: selectedRoom || '',
          storagePath,
          width: compressed.width,
          height: compressed.height,
          sizeBytes: compressed.compressedSizeBytes,
          mimeType: 'image/webp',
          caption: '',
          viewType: viewType?.id ?? '',
          longitude: gps?.longitude,
          latitude: gps?.latitude,
          takenAt: gps?.capturedAt ?? new Date().toISOString(),
        })

        nextPhotoIndex++
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur upload')
    } finally {
      setBusy(false)
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-40">
          <Select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            aria-label="Pièce destinataire"
          >
            <option value="">— Aucune pièce (à trier plus tard) —</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button type="button" disabled={busy} asChild>
          <label htmlFor={inputId} className="cursor-pointer">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            {busy
              ? progress
                ? `Photo ${progress.current}/${progress.total}`
                : 'Upload…'
              : 'Prendre photo(s)'}
          </label>
        </Button>
      </div>

      {/* Pills : types de vue les plus utilisés */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Type de vue :</div>
        <div className="flex flex-wrap gap-1.5">
          {pinned.map((v) => (
            <ViewPill
              key={v.id}
              view={v}
              active={selectedView === v.id}
              onClick={() => setSelectedView(v.id)}
            />
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                {!pinned.find((v) => v.id === selectedView) &&
                  selectedView !== 'vue_generale' && (
                    <span className="font-medium">{getViewType(selectedView)?.label} · </span>
                  )}
                Plus
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
              {(Object.entries(grouped) as [keyof typeof GROUP_LABELS, ViewType[]][]).map(
                ([group, items]) => (
                  <div key={group}>
                    <DropdownMenuLabel>{GROUP_LABELS[group]}</DropdownMenuLabel>
                    {items.map((v) => (
                      <DropdownMenuItem
                        key={v.id}
                        onClick={() => setSelectedView(v.id)}
                        className={selectedView === v.id ? 'bg-muted' : ''}
                      >
                        {v.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </div>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {error && (
        <p className="text-sm text-accent-red" role="alert">
          {error}
        </p>
      )}

      <p className="text-xs text-subtle-foreground">
        WebP qualité 0.75 · max 1920×1080 · géolocalisation auto si autorisée · fichier nommé
        automatiquement
      </p>
    </div>
  )
}

function ViewPill({
  view,
  active,
  onClick,
}: {
  view: ViewType
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-card text-foreground hover:bg-muted',
      )}
    >
      {view.label}
    </button>
  )
}
