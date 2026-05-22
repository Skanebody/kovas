'use client'

/**
 * UploadPhotoForm — formulaire client de la page publique `/upload-photo/[token]`.
 *
 * - Affiche la description précise de la photo demandée
 * - Capture appareil photo arrière par défaut (`capture="environment"`)
 * - Upload directement via POST `/api/client-photo-upload` (proxie l'Edge
 *   Function `upload-client-photo`)
 * - États : idle → uploading → success / error
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Camera, Check, Loader2, RefreshCcw } from 'lucide-react'
import { useState } from 'react'

interface UploadPhotoFormProps {
  token: string
  photoDescription: string
  expiresAt: string
}

type FormState = 'idle' | 'previewing' | 'uploading' | 'success' | 'error'

export function UploadPhotoForm({
  token,
  photoDescription,
  expiresAt,
}: UploadPhotoFormProps) {
  const [state, setState] = useState<FormState>('idle')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0]
    if (!f) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setState('previewing')
  }

  const handleReset = (): void => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setState('idle')
    setErrorMsg(null)
  }

  const handleUpload = async (): Promise<void> => {
    if (!file) return
    setState('uploading')
    setErrorMsg(null)
    try {
      const formData = new FormData()
      formData.append('token', token)
      formData.append('file', file)
      const res = await fetch('/api/client-photo-upload', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setState('success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown_error'
      setErrorMsg(msg)
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <Card className="p-6 text-center">
        <div className="size-12 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-3">
          <Check className="size-6 text-success" aria-hidden />
        </div>
        <h2 className="text-[18px] font-semibold text-ink mb-2">Photo bien reçue</h2>
        <p className="text-[14px] text-ink-soft leading-snug">
          Votre photo a été transmise au diagnostiqueur. Vous pouvez fermer cette page.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <p className="label-mono text-ink-mute mb-2">Élément demandé</p>
      <p className="text-[15px] text-ink font-medium leading-snug mb-1">{photoDescription}</p>
      <p className="text-[12px] text-ink-mute mb-5">
        Lien valable jusqu&apos;au {new Date(expiresAt).toLocaleString('fr-FR')}
      </p>

      {state === 'idle' && (
        <>
          <label
            htmlFor="photo-input"
            className="block w-full border-2 border-dashed border-rule rounded-lg p-8 text-center cursor-pointer hover:border-chartreuse-deep transition-colors"
          >
            <Camera className="size-8 text-ink-mute mx-auto mb-2" aria-hidden />
            <p className="text-[14px] font-medium text-ink mb-1">Prendre une photo</p>
            <p className="text-[12px] text-ink-mute">ou sélectionner depuis la galerie</p>
            <input
              id="photo-input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>
        </>
      )}

      {(state === 'previewing' || state === 'uploading' || state === 'error') && previewUrl && (
        <>
          <div className="mb-4 rounded-lg overflow-hidden border border-rule">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Aperçu de la photo"
              className="w-full h-auto max-h-[400px] object-contain bg-sage-alt"
            />
          </div>
          {state === 'error' && errorMsg && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 mb-4">
              <p className="text-[12px] text-danger leading-snug">
                Échec de l&apos;envoi : {errorMsg}. Vérifiez votre connexion ou réessayez.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleReset}
              disabled={state === 'uploading'}
            >
              <RefreshCcw className="size-4" aria-hidden />
              Reprendre
            </Button>
            <Button
              type="button"
              variant="accent"
              className="flex-1"
              onClick={handleUpload}
              disabled={state === 'uploading'}
            >
              {state === 'uploading' ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Envoi…
                </>
              ) : (
                'Envoyer la photo'
              )}
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
