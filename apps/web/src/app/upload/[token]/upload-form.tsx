'use client'

import { CheckCircle2, FileText, Loader2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Select } from '@/components/ui/select'

const DOC_KINDS = [
  { value: 'facture_energie', label: 'Facture énergie (gaz / électricité / fioul)' },
  { value: 'ancien_dpe', label: 'Ancien DPE' },
  { value: 'plan', label: 'Plan / Croquis du bien' },
  { value: 'acte', label: 'Acte de propriété / Bail' },
  { value: 'reglement_copro', label: 'Règlement de copropriété' },
  { value: 'autre', label: 'Autre document' },
]

interface UploadFormProps {
  token: string
  missionId: string
  orgId: string
}

interface UploadedItem {
  name: string
  kind: string
  status: 'pending' | 'success' | 'error'
  error?: string
}

export function UploadForm({ token }: UploadFormProps) {
  const [docKind, setDocKind] = useState('facture_energie')
  const [uploading, setUploading] = useState(false)
  const [uploads, setUploads] = useState<UploadedItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)

    for (const file of Array.from(files)) {
      const item: UploadedItem = { name: file.name, kind: docKind, status: 'pending' }
      setUploads((prev) => [...prev, item])

      try {
        const fd = new FormData()
        fd.append('token', token)
        fd.append('docKind', docKind)
        fd.append('file', file)

        const resp = await fetch('/api/upload-owner-document', {
          method: 'POST',
          body: fd,
        })

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: 'Erreur upload' }))
          throw new Error(err.error ?? 'Erreur upload')
        }

        setUploads((prev) =>
          prev.map((u) => (u.name === file.name ? { ...u, status: 'success' } : u)),
        )
      } catch (err) {
        setUploads((prev) =>
          prev.map((u) =>
            u.name === file.name
              ? { ...u, status: 'error', error: err instanceof Error ? err.message : 'Erreur' }
              : u,
          ),
        )
      }
    }

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-5">
      <FormField label="Type de document" htmlFor="docKind">
        <Select
          id="docKind"
          value={docKind}
          onChange={(e) => setDocKind(e.target.value)}
        >
          {DOC_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="rounded-xl border-2 border-dashed border-border p-8 text-center space-y-3">
        <Upload className="size-8 mx-auto text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-semibold">Glissez vos fichiers ici</p>
          <p className="text-xs text-muted-foreground">
            PDF, images (JPG/PNG), Word, Excel · max 20 Mo par fichier
          </p>
        </div>
        <input
          ref={inputRef}
          id="file-input"
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button asChild disabled={uploading}>
          <label htmlFor="file-input" className="cursor-pointer">
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? 'Envoi…' : 'Choisir des fichiers'}
          </label>
        </Button>
      </div>

      {uploads.length > 0 && (
        <ul className="space-y-2">
          {uploads.map((u, i) => (
            <li
              key={`${u.name}-${i}`}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm bg-card"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <span className="truncate">{u.name}</span>
              </div>
              {u.status === 'pending' && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              {u.status === 'success' && <CheckCircle2 className="size-4 text-accent-green" />}
              {u.status === 'error' && (
                <span className="text-xs text-accent-red">{u.error}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
