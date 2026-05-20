'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type {
  CapturedDocument,
  ClassificationResult,
  Document,
  ExtractionResult,
  RegulatoryValidation,
} from '@/lib/documents/types'
import { cn } from '@/lib/utils'
import { AlertTriangle, Check, FileText, Loader2, Upload, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

interface DocumentImporterProps {
  dossierId?: string
  /** Callback déclenché après chaque document traité. */
  onDocumentProcessed?: (document: Document) => void
  className?: string
}

type ItemStatus = 'queued' | 'uploading' | 'classifying' | 'extracting' | 'done' | 'failed'

interface ImportItem {
  id: string
  file: File
  previewUrl: string
  status: ItemStatus
  error?: string
  documentId?: string
}

const ACCEPTED = 'image/jpeg,image/jpg,image/png,image/webp,image/heic,application/pdf'

interface UploadResponse {
  document: Document
  classification: ClassificationResult
}

interface ExtractResponse {
  extraction: ExtractionResult
  validation: RegulatoryValidation | null
}

/**
 * Drag&drop multi-fichiers — accepte JPG/PNG/PDF.
 * Chaque fichier passe par le flow upload → classify → extract séquentiellement.
 *
 * Pour un seul fichier interactif (avec confirmation type), utiliser
 * `DocumentScanButton` qui ouvre `DocumentCapturePanel`.
 */
export function DocumentImporter({
  dossierId,
  onDocumentProcessed,
  className,
}: DocumentImporterProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<ImportItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [processing, setProcessing] = useState(false)

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || f.type === 'application/pdf',
    )
    if (incoming.length === 0) return
    const newItems: ImportItem[] = incoming.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'queued',
    }))
    setItems((prev) => [...prev, ...newItems])
  }, [])

  function handleSelect(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ''
  }
  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
  }
  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(true)
  }
  function handleDragLeave() {
    setDragOver(false)
  }

  const updateItem = useCallback((id: string, patch: Partial<ImportItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }, [])

  const processOne = useCallback(
    async (item: ImportItem) => {
      const captured: CapturedDocument = {
        file: item.file,
        previewUrl: item.previewUrl,
        source: 'drag_drop',
        sizeBytes: item.file.size,
        mimeType: item.file.type,
      }
      // 1. Upload
      updateItem(item.id, { status: 'uploading' })
      const formData = new FormData()
      formData.append('file', captured.file)
      formData.append('source', captured.source)
      if (dossierId) formData.append('dossierId', dossierId)

      let document: Document
      try {
        const res = await fetch('/api/documents/upload', { method: 'POST', body: formData })
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(errBody.error ?? 'Échec téléversement')
        }
        const json = (await res.json()) as UploadResponse
        document = json.document
        updateItem(item.id, { status: 'classifying', documentId: document.id })
      } catch (e) {
        updateItem(item.id, {
          status: 'failed',
          error: e instanceof Error ? e.message : 'Erreur réseau',
        })
        return
      }

      // 2. Extraction (auto-accepte le type détecté en mode batch)
      updateItem(item.id, { status: 'extracting' })
      try {
        const res = await fetch('/api/documents/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: document.id }),
        })
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(errBody.error ?? 'Échec extraction')
        }
        ;(await res.json()) as ExtractResponse
      } catch (e) {
        updateItem(item.id, {
          status: 'failed',
          error: e instanceof Error ? e.message : 'Erreur réseau',
        })
        return
      }

      updateItem(item.id, { status: 'done' })
      onDocumentProcessed?.(document)
    },
    [dossierId, onDocumentProcessed, updateItem],
  )

  const startProcessing = useCallback(async () => {
    const queued = items.filter((i) => i.status === 'queued')
    if (queued.length === 0) return
    setProcessing(true)
    for (const item of queued) {
      await processOne(item)
    }
    setProcessing(false)
  }, [items, processOne])

  function removeItem(id: string) {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((it) => it.id !== id)
    })
  }

  function clearDone() {
    setItems((prev) => {
      for (const it of prev) {
        if (it.status === 'done') URL.revokeObjectURL(it.previewUrl)
      }
      return prev.filter((it) => it.status !== 'done')
    })
  }

  const queuedCount = items.filter((i) => i.status === 'queued').length
  const doneCount = items.filter((i) => i.status === 'done').length

  return (
    <Card variant="opaque" padding="default" className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
            Import documents
          </p>
          <h3 className="mt-1 font-serif italic font-normal text-xl text-ink">
            Glissez plusieurs fichiers
          </h3>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={processing}
        >
          <Upload className="size-4" />
          Ajouter
        </Button>
      </div>

      <div
        role="presentation"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragOver
            ? 'border-chartreuse bg-chartreuse/10'
            : 'border-rule/80 bg-sage-alt/40 hover:bg-sage-alt/70',
        )}
      >
        <FileText className="size-6 text-ink-mute" aria-hidden />
        <p className="text-sm text-ink">Déposez des documents (JPG, PNG, PDF)</p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
          Jusqu'à 25 Mo par fichier
        </p>
      </div>

      {items.length > 0 ? (
        <ul className="divide-y divide-rule/60">
          {items.map((item) => (
            <ImportRow key={item.id} item={item} onRemove={removeItem} />
          ))}
        </ul>
      ) : null}

      {items.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <p className="text-xs text-ink-mute">
            {items.length} fichier{items.length > 1 ? 's' : ''} ·{' '}
            {queuedCount > 0 ? `${queuedCount} en attente · ` : ''}
            {doneCount > 0 ? `${doneCount} traité${doneCount > 1 ? 's' : ''}` : ''}
          </p>
          <div className="flex items-center gap-2">
            {doneCount > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={clearDone}>
                Nettoyer
              </Button>
            )}
            <Button
              type="button"
              variant="accent"
              size="default"
              onClick={() => void startProcessing()}
              disabled={processing || queuedCount === 0}
            >
              {processing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Lancer le traitement
            </Button>
          </div>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        onChange={handleSelect}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
    </Card>
  )
}

// ============================================
// Row
// ============================================

function ImportRow({ item, onRemove }: { item: ImportItem; onRemove: (id: string) => void }) {
  const isBusy =
    item.status === 'uploading' || item.status === 'classifying' || item.status === 'extracting'

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="size-12 shrink-0 overflow-hidden rounded-md border border-rule bg-sage-alt/40">
        {item.file.type.startsWith('image/') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-mute">
            <FileText className="size-5" aria-hidden />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{item.file.name}</p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
          {formatBytes(item.file.size)} · {statusLabel(item.status)}
          {item.error ? ` — ${item.error}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {item.status === 'done' && <Check className="size-4 text-success" aria-hidden />}
        {item.status === 'failed' && (
          <AlertTriangle className="size-4 text-accent-red" aria-hidden />
        )}
        {isBusy && <Loader2 className="size-4 animate-spin text-ink-mute" aria-hidden />}
        {!isBusy && (
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="rounded-md p-1.5 text-ink-mute hover:bg-sage-alt/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
            aria-label="Retirer ce fichier"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </li>
  )
}

function statusLabel(status: ItemStatus): string {
  switch (status) {
    case 'queued':
      return 'En attente'
    case 'uploading':
      return 'Téléversement…'
    case 'classifying':
      return 'Identification…'
    case 'extracting':
      return 'Extraction…'
    case 'done':
      return 'Traité'
    case 'failed':
      return 'Échec'
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`
}
