'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { FileUp } from 'lucide-react'
import { type ChangeEvent, useRef, useState } from 'react'

/**
 * Étape 3 — KYC pièce d'identité (refonte Doctolib 2026-05-27).
 *
 * Upload CNI recto (obligatoire) + verso (optionnel, recommandé) ou passeport.
 * Bucket privé `claim-identity-documents` (RLS strict).
 * Trigger Edge Function `verify-identity-kyc` (Claude Vision).
 *
 * 5 Mo max par fichier. Formats : JPEG, PNG, WebP, HEIC, PDF.
 */
interface Props {
  diagnosticianId: string
  claimId: string
  diagnosticianFullName: string
  onDone: () => void
}

const MAX_BYTES = 5 * 1024 * 1024 // 5 Mo

export function Step3Identity({ diagnosticianId, claimId, diagnosticianFullName, onDone }: Props) {
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const frontRef = useRef<HTMLInputElement | null>(null)
  const backRef = useRef<HTMLInputElement | null>(null)

  function onFileChange(side: 'front' | 'back', e: ChangeEvent<HTMLInputElement>) {
    setError(null)
    const file = e.target.files?.[0] ?? null
    if (!file) {
      if (side === 'front') setFront(null)
      else setBack(null)
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`Fichier trop volumineux (max 5 Mo) : ${file.name}`)
      e.target.value = ''
      return
    }
    if (side === 'front') setFront(file)
    else setBack(file)
  }

  async function handleSubmit() {
    if (!front) {
      setError("Le recto de la pièce d'identité est obligatoire.")
      return
    }
    setLoading(true)
    setError(null)

    const fd = new FormData()
    fd.append('claimId', claimId)
    fd.append('front', front)
    if (back) fd.append('back', back)

    try {
      const res = await fetch(`/api/diagnosticians/${diagnosticianId}/claim/upload-identity`, {
        method: 'POST',
        body: fd,
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Échec de l'envoi de la pièce d'identité.")
        return
      }
      onDone()
    } catch {
      setError('Erreur réseau. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-ink leading-relaxed">
        Téléverse une photo nette de ta carte nationale d&apos;identité (CNI) ou de ton passeport
        français.
      </p>

      <div className="rounded-md bg-paper border border-rule px-3 py-2 text-[12px] text-ink-mute">
        Nom attendu sur le document&nbsp;:{' '}
        <strong className="text-ink">{diagnosticianFullName}</strong>
      </div>

      <ul className="text-[12px] text-ink-mute leading-relaxed space-y-1 list-disc pl-4">
        <li>Document en cours de validité (date d&apos;expiration ≥ aujourd&apos;hui)</li>
        <li>Photo nette, sans reflet, document entier visible</li>
        <li>Formats acceptés : JPEG, PNG, WebP, HEIC, PDF — 5 Mo max par fichier</li>
        <li>Conservation : 30 jours puis suppression automatique (RGPD)</li>
      </ul>

      {/* Recto */}
      <div>
        <Label htmlFor="front-input">Recto (obligatoire)</Label>
        <div className="mt-2 flex items-center gap-3">
          <input
            ref={frontRef}
            id="front-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            onChange={(e) => onFileChange('front', e)}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => frontRef.current?.click()}
          >
            <FileUp className="size-4" aria-hidden />
            {front ? front.name.slice(0, 28) : 'Choisir le recto'}
          </Button>
          {front && (
            <span className="text-[11px] text-ink-mute">{(front.size / 1024).toFixed(0)} Ko</span>
          )}
        </div>
      </div>

      {/* Verso */}
      <div>
        <Label htmlFor="back-input">Verso (recommandé pour CNI)</Label>
        <div className="mt-2 flex items-center gap-3">
          <input
            ref={backRef}
            id="back-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            onChange={(e) => onFileChange('back', e)}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => backRef.current?.click()}
          >
            <FileUp className="size-4" aria-hidden />
            {back ? back.name.slice(0, 28) : 'Choisir le verso'}
          </Button>
          {back && (
            <span className="text-[11px] text-ink-mute">{(back.size / 1024).toFixed(0)} Ko</span>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-[12px] text-danger">
          {error}
        </div>
      )}

      <Button type="button" onClick={handleSubmit} disabled={!front || loading}>
        {loading ? 'Envoi en cours…' : "Envoyer ma pièce d'identité"}
      </Button>
    </div>
  )
}
