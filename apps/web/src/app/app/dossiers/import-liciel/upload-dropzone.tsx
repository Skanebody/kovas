'use client'

import { Button } from '@/components/ui/button'
import { ACCEPTED_EXTENSIONS, IMPORT_LIMITS, type UploadResponse } from '@/lib/import/types'
import { cn } from '@/lib/utils'
import { FileSpreadsheet, Loader2, Upload, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

interface UploadDropZoneProps {
  /** Callback appelé quand l'API retourne 201 avec le job_id. */
  onJobCreated: (jobId: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

/**
 * Drop-zone d'upload pour l'étape 3 du wizard Import Liciel.
 *
 * Design v5 KOVAS :
 *   idle      → dashed border-rule, hover navy/40 + cream-deep/40
 *   dragover  → border-chartreuse + chartreuse/10
 *   uploading → barre de progression (indeterminate, transitions Tailwind)
 *   error     → border-danger + message
 *
 * Validation taille client-side (100 Mo) avant POST, pour éviter l'envoi
 * réseau d'un fichier qui sera rejeté côté serveur.
 */
export function UploadDropZone({ onJobCreated }: UploadDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // 0-100 (indeterminate post-validation client mais on affiche un fake step
  // pour donner un signal visuel ; le vrai progress vient de la page status)
  const [progress, setProgress] = useState(0)

  const accept = ACCEPTED_EXTENSIONS.join(',')

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      const f = files[0]
      if (!f) return

      // Validation client-side taille
      if (f.size === 0) {
        setStatus('error')
        setErrorMsg('Le fichier est vide.')
        setFile(f)
        return
      }
      if (f.size > IMPORT_LIMITS.MAX_FILE_SIZE_BYTES) {
        setStatus('error')
        setErrorMsg(
          `Fichier trop volumineux (${formatBytes(f.size)}). Maximum : ${IMPORT_LIMITS.MAX_FILE_SIZE_MB} Mo.`,
        )
        setFile(f)
        return
      }

      // Validation extension
      const ext = `.${(f.name.split('.').pop() ?? '').toLowerCase()}`
      if (!ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])) {
        setStatus('error')
        setErrorMsg(`Format non supporté (${ext}). Attendus : ${ACCEPTED_EXTENSIONS.join(', ')}.`)
        setFile(f)
        return
      }

      setFile(f)
      setErrorMsg(null)
      setStatus('uploading')
      setProgress(15)

      try {
        const fd = new FormData()
        fd.append('file', f)

        // Pseudo-progress visuel pendant l'attente serveur (le fetch n'expose
        // pas progressEvent, on simule un step à 60% après 600ms)
        const fakeTimer = setTimeout(() => setProgress(60), 600)

        const res = await fetch('/api/import/liciel/upload', {
          method: 'POST',
          body: fd,
        })
        clearTimeout(fakeTimer)

        if (!res.ok) {
          const errBody = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(errBody?.error ?? `Erreur ${res.status}`)
        }

        const body = (await res.json()) as UploadResponse
        setProgress(100)
        setStatus('success')
        onJobCreated(body.job_id)
      } catch (err) {
        setStatus('error')
        setErrorMsg(err instanceof Error ? err.message : 'Échec de l’upload')
      }
    },
    [onJobCreated],
  )

  function onDragOver(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault()
    if (status === 'uploading') return
    setIsDragOver(true)
  }

  function onDragLeave(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function onDrop(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault()
    setIsDragOver(false)
    if (status === 'uploading') return
    void handleFiles(e.dataTransfer.files)
  }

  function onClick() {
    if (status === 'uploading') return
    inputRef.current?.click()
  }

  function onReset() {
    setStatus('idle')
    setFile(null)
    setErrorMsg(null)
    setProgress(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  const isUploading = status === 'uploading'
  const isError = status === 'error'

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => void handleFiles(e.target.files)}
        disabled={isUploading}
        aria-hidden
        tabIndex={-1}
      />
      <button
        type="button"
        disabled={isUploading}
        onClick={onClick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'relative flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors',
          'cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-navy/20',
          'disabled:cursor-wait',
          !isDragOver &&
            !isError &&
            !isUploading &&
            'border-rule bg-paper/40 hover:border-navy/40 hover:bg-cream-deep/40',
          isDragOver && 'border-chartreuse bg-chartreuse/10',
          isError && 'border-danger/60 bg-danger/5',
          isUploading && 'border-navy/40 bg-cream-deep/40',
        )}
      >
        {isUploading ? (
          <>
            <Loader2 className="size-8 text-navy animate-spin" aria-hidden />
            <p className="text-sm font-medium text-ink">Téléversement en cours…</p>
            {file && (
              <p className="text-xs text-ink-mute">
                {file.name} · {formatBytes(file.size)}
              </p>
            )}
          </>
        ) : (
          <>
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-cream-deep/60 text-ink">
              <Upload className="size-5" aria-hidden />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium text-ink">
                Glissez votre fichier Liciel ici, ou{' '}
                <span className="underline underline-offset-2">cliquez pour le choisir</span>.
              </p>
              <p className="text-xs text-ink-mute">
                Formats acceptés : {ACCEPTED_EXTENSIONS.join(', ')} · max{' '}
                {IMPORT_LIMITS.MAX_FILE_SIZE_MB} Mo
              </p>
            </div>
          </>
        )}
      </button>

      {/* Barre de progression visuelle (uploading) */}
      {isUploading && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-deep">
          <div
            className="h-full bg-navy transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
            aria-hidden
          />
        </div>
      )}

      {/* Preview fichier sélectionné + erreur */}
      {file && !isUploading && (
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm',
            isError
              ? 'border-danger/40 bg-danger/5 text-danger'
              : 'border-rule bg-paper/60 text-ink',
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <FileSpreadsheet className="size-4 shrink-0" aria-hidden />
            <span className="truncate font-medium">{file.name}</span>
            <span className="text-xs text-ink-mute shrink-0">{formatBytes(file.size)}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onReset()
            }}
            aria-label="Retirer le fichier"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {isError && errorMsg && (
        <p className="text-xs text-danger" role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  )
}
