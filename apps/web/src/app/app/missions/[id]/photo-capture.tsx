'use client'

import { Camera, Loader2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { getCurrentPosition } from '@/lib/geolocation'
import { compressImage } from '@/lib/image-compress'
import { createClient } from '@/lib/supabase/client'
import { createPhotoAction } from './actions'

interface PhotoCaptureProps {
  missionId: string
  orgId: string
  rooms: { id: string; name: string }[]
  defaultRoomId?: string
  onUploaded?: () => void
}

export function PhotoCapture({ missionId, orgId, rooms, defaultRoomId, onUploaded }: PhotoCaptureProps) {
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<string>(defaultRoomId ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(filesList: FileList | null) {
    if (!filesList || filesList.length === 0) return
    setBusy(true)
    setError(null)
    const files = Array.from(filesList)
    setProgress({ current: 0, total: files.length })

    const supabase = createClient()
    const gps = await getCurrentPosition() // best-effort, non bloquant

    try {
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length })
        const file = files[i]!
        const compressed = await compressImage(file)

        // Path : <org>/<mission>/<timestamp>-<rand>.webp
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`
        const storagePath = `${orgId}/${missionId}/${filename}`

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
          missionId,
          roomId: selectedRoom || '',
          storagePath,
          width: compressed.width,
          height: compressed.height,
          sizeBytes: compressed.compressedSizeBytes,
          mimeType: 'image/webp',
          caption: '',
          longitude: gps?.longitude,
          latitude: gps?.latitude,
          takenAt: gps?.capturedAt ?? new Date().toISOString(),
        })
      }
      onUploaded?.()
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

      {error && (
        <p className="text-sm text-accent-red" role="alert">
          {error}
        </p>
      )}

      <p className="text-xs text-subtle-foreground">
        WebP qualité 0.75 · max 1920×1080 · géolocalisation auto si autorisée
      </p>
    </div>
  )
}
