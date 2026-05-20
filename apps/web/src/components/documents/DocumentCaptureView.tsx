'use client'

import { Button } from '@/components/ui/button'
import type { CapturedDocument } from '@/lib/documents/types'
import { cn } from '@/lib/utils'
import { Camera, FileText, Loader2, Upload } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

interface DocumentCaptureViewProps {
  /** Callback déclenché quand un fichier est sélectionné (avant upload). */
  onCapture: (doc: CapturedDocument) => void
  /** Mode lecture pour le drag&drop : empêche les nouveaux drops pendant l'upload. */
  busy?: boolean
  /** Erreur affichée sous le composant (max 1 ligne). */
  error?: string | null
  className?: string
}

const ACCEPTED_MIME = 'image/jpeg,image/jpg,image/png,image/webp,image/heic,application/pdf'
const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB

/**
 * 3 options de capture : caméra (input capture=environment), file picker, drag&drop.
 * Drop zone border-dashed chartreuse au hover.
 */
export function DocumentCaptureView({
  onCapture,
  busy = false,
  error,
  className,
}: DocumentCaptureViewProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const filePickerRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleFiles = useCallback(
    (file: File | undefined, source: CapturedDocument['source']) => {
      setLocalError(null)
      if (!file) return
      if (file.size > MAX_SIZE_BYTES) {
        setLocalError(`Fichier trop volumineux (max ${MAX_SIZE_BYTES / 1024 / 1024} Mo).`)
        return
      }
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        setLocalError('Format non supporté. Utilisez JPG, PNG, WEBP, HEIC ou PDF.')
        return
      }
      onCapture({
        file,
        previewUrl: URL.createObjectURL(file),
        source,
        sizeBytes: file.size,
        mimeType: file.type,
      })
    },
    [onCapture],
  )

  function handleCameraChange(e: ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files?.[0], 'camera')
    e.target.value = ''
  }
  function handlePickerChange(e: ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files?.[0], 'file_picker')
    e.target.value = ''
  }
  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (busy) return
    handleFiles(e.dataTransfer.files?.[0], 'drag_drop')
  }
  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (!busy) setDragOver(true)
  }
  function handleDragLeave() {
    setDragOver(false)
  }

  const displayedError = error ?? localError

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="accent"
          size="lg"
          onClick={() => cameraInputRef.current?.click()}
          disabled={busy}
          className="h-auto py-4"
        >
          <Camera className="size-5" />
          <span className="flex flex-col items-start">
            <span className="font-semibold">Prendre une photo</span>
            <span className="text-[11px] font-normal opacity-80">Caméra arrière</span>
          </span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => filePickerRef.current?.click()}
          disabled={busy}
          className="h-auto py-4"
        >
          <Upload className="size-5" />
          <span className="flex flex-col items-start">
            <span className="font-semibold">Choisir un fichier</span>
            <span className="text-[11px] font-normal opacity-70">JPG · PNG · PDF</span>
          </span>
        </Button>
      </div>

      <div
        role="presentation"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragOver
            ? 'border-chartreuse bg-chartreuse/10'
            : 'border-rule/80 bg-sage-alt/40 hover:bg-sage-alt/70',
          busy && 'opacity-50',
        )}
      >
        {busy ? (
          <Loader2 className="size-6 animate-spin text-navy" aria-hidden />
        ) : (
          <FileText className="size-6 text-ink-mute" aria-hidden />
        )}
        <p className="text-sm text-ink">
          {busy ? 'Préparation du fichier…' : 'Glissez un fichier ici'}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          JPG · PNG · WEBP · HEIC · PDF · 25 Mo max
        </p>
      </div>

      {displayedError ? (
        <p className="text-sm text-accent-red" role="alert">
          {displayedError}
        </p>
      ) : null}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraChange}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
      <input
        ref={filePickerRef}
        type="file"
        accept={ACCEPTED_MIME}
        onChange={handlePickerChange}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
    </div>
  )
}
