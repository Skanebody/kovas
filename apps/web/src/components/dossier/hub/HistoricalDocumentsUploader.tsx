'use client'

import {
  type HistoricalDocUploadState,
  uploadHistoricalDocumentAction,
} from '@/app/dashboard/dossiers/[id]/historical-docs-actions'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Loader2, UploadCloud } from 'lucide-react'
import { useActionState, useRef, useState } from 'react'
import {
  HISTORICAL_DOC_CATEGORIES,
  type HistoricalDocumentCategory,
} from './HistoricalDocumentsSection'

interface HistoricalDocumentsUploaderProps {
  dossierId: string
}

/**
 * Uploader drag-drop multi-fichiers pour documents historiques.
 *
 * Note V1 : pour rester simple, un fichier à la fois (1 form submit = 1 doc).
 * Une boucle d'uploads séquentiels permet de gérer N fichiers déposés.
 */
export function HistoricalDocumentsUploader({ dossierId }: HistoricalDocumentsUploaderProps) {
  const [category, setCategory] = useState<HistoricalDocumentCategory>('previous_dpe')
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, formAction, pending] = useActionState<HistoricalDocUploadState, FormData>(
    uploadHistoricalDocumentAction,
    undefined,
  )

  function triggerInput() {
    inputRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const fd = new FormData()
    fd.set('dossierId', dossierId)
    fd.set('category', category)
    fd.set('file', f)
    formAction(fd)
    // reset l'input pour permettre de re-uploader le même fichier
    e.target.value = ''
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    const fd = new FormData()
    fd.set('dossierId', dossierId)
    fd.set('category', category)
    fd.set('file', f)
    formAction(fd)
  }

  const errorMsg = state && 'error' in state ? state.error : null
  const success = state && 'success' in state ? state.success : false

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor="historical-doc-category"
          className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/72"
        >
          Catégorie
        </label>
        <Select
          id="historical-doc-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as HistoricalDocumentCategory)}
          disabled={pending}
          className="min-w-[220px]"
        >
          {HISTORICAL_DOC_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 transition-colors ${
          isDragging
            ? 'border-foreground/40 bg-foreground/[0.04]'
            : 'border-[#0F1419]/[0.08] bg-cream-deep/30'
        }`}
      >
        <UploadCloud className="size-6 text-[#0F1419]/72" />
        <p className="text-center text-[13px] text-[#0F1419]">
          Glissez un fichier ici ou
          <button
            type="button"
            onClick={triggerInput}
            className="ml-1 underline hover:text-foreground"
            disabled={pending}
          >
            parcourir
          </button>
        </p>
        <p className="font-mono text-[10px] text-[#0F1419]/55">
          PDF · JPG · PNG · WebP · HEIC (50 Mo max)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={onFileChange}
          className="hidden"
          disabled={pending}
        />
        {pending ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-[#0F1419]/72">
            <Loader2 className="size-3 animate-spin" />
            Envoi en cours…
          </p>
        ) : null}
        {errorMsg ? (
          <p className="mt-1 text-[12px] text-accent-red" role="alert">
            {errorMsg}
          </p>
        ) : null}
        {success ? (
          <output className="mt-1 text-[12px] text-accent-green">Document ajouté</output>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={triggerInput} disabled={pending}>
          Choisir un fichier
        </Button>
      </div>
    </div>
  )
}
