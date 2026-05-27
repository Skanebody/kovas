'use client'

/**
 * ClientPhotoRequest — modal pour demander une photo au client via SMS.
 *
 * Flux :
 *  1. Diagnostiqueur saisit description précise ("Photo plaque chaudière chaufferie")
 *  2. POST `/api/recovery/request-client-photo` (server-side)
 *  3. Edge Function génère token UUID + insert dans `client_photo_requests`
 *     + envoi SMS Brevo "{Diag} vous demande une photo : {desc}. {url}"
 *  4. Modal affiche succès + token côté UI pour traçage
 */

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { Check, Loader2, X } from 'lucide-react'
import { useState } from 'react'

interface ClientPhotoRequestProps {
  missionId: string
  organizationId: string
  clientPhone: string
  clientName: string
  onClose: () => void
}

type RequestStatus = 'idle' | 'sending' | 'sent' | 'error'

export function ClientPhotoRequest({
  missionId,
  organizationId,
  clientPhone,
  clientName,
  onClose,
}: ClientPhotoRequestProps) {
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<RequestStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [resultToken, setResultToken] = useState<string | null>(null)

  const canSend = description.trim().length >= 10 && status !== 'sending'

  const handleSubmit = async (): Promise<void> => {
    if (!canSend) return
    setStatus('sending')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/recovery/request-client-photo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          missionId,
          organizationId,
          clientPhone,
          photoDescription: description.trim(),
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({ error: 'unknown' }))) as { error?: string }
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { token: string }
      setResultToken(data.token)
      setStatus('sent')
      toast.success('SMS envoyé', { description: `Demande envoyée à ${clientName}.` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      setErrorMsg(msg)
      setStatus('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-navy-deep/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-req-title"
    >
      <div
        className={cn(
          'bg-paper rounded-xl border border-rule shadow-md max-w-lg w-full p-5',
          'animate-slide-up',
        )}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="label-mono text-ink-mute mb-1">Récupération à distance</p>
            <h2 id="photo-req-title" className="text-[18px] font-semibold text-ink">
              Demander une photo à {clientName}
            </h2>
            <p className="text-[13px] text-ink-soft mt-1">
              SMS envoyé au {clientPhone} avec un lien d\'upload sécurisé.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-mute hover:text-ink p-1 rounded-full"
            aria-label="Fermer"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {status === 'sent' && resultToken ? (
          <div className="bg-success/10 border border-success/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-full bg-success/15 flex items-center justify-center shrink-0">
                <Check className="size-4 text-success" aria-hidden />
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-ink leading-snug">SMS envoyé</p>
                <p className="text-[13px] text-ink-soft mt-1 leading-snug">
                  {clientName} a reçu un lien sécurisé valable 48 h. Vous serez notifié quand la
                  photo sera reçue.
                </p>
                <p className="text-[11px] font-mono text-ink-mute mt-2">
                  Référence : {resultToken.slice(0, 8)}…
                </p>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Fermer
              </Button>
            </div>
          </div>
        ) : (
          <>
            <label
              htmlFor="photo-description"
              className="block text-[13px] font-medium text-ink mb-2"
            >
              Description précise de la photo demandée
            </label>
            <Textarea
              id="photo-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex. Plaque signalétique de la chaudière dans la chaufferie (marque, modèle, année lisibles)"
              rows={4}
              maxLength={500}
              className="mb-1"
              disabled={status === 'sending'}
            />
            <p className="text-[11px] text-ink-mute mb-4">
              {description.trim().length}/500 caractères — minimum 10 pour envoyer
            </p>

            {status === 'error' && errorMsg && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 mb-4">
                <p className="text-[12px] text-danger leading-snug">Erreur d\'envoi : {errorMsg}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={status === 'sending'}
              >
                Annuler
              </Button>
              <Button type="button" variant="accent" disabled={!canSend} onClick={handleSubmit}>
                {status === 'sending' ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Envoi…
                  </>
                ) : (
                  'Envoyer le SMS'
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
