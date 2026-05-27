'use client'

/**
 * VideoCallRequest — modal pour proposer une visio rapide au client par SMS.
 *
 * Le diagnostiqueur saisit son lien Meet/Whereby/Jitsi pré-généré + une
 * raison brève. L'Edge Function `request-client-video` envoie un SMS avec
 * le lien et notifie le diagnostiqueur quand le client clique.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { Check, Loader2, X } from 'lucide-react'
import { useState } from 'react'

interface VideoCallRequestProps {
  missionId: string
  organizationId: string
  clientPhone: string
  clientName: string
  onClose: () => void
}

type RequestStatus = 'idle' | 'sending' | 'sent' | 'error'

export function VideoCallRequest({
  missionId,
  organizationId,
  clientPhone,
  clientName,
  onClose,
}: VideoCallRequestProps) {
  const [meetingUrl, setMeetingUrl] = useState('')
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState<RequestStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isValidUrl = /^https?:\/\/.+\..+/.test(meetingUrl.trim())
  const canSend = isValidUrl && reason.trim().length >= 10 && status !== 'sending'

  const handleSubmit = async (): Promise<void> => {
    if (!canSend) return
    setStatus('sending')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/recovery/request-client-video', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          missionId,
          organizationId,
          clientPhone,
          meetingUrl: meetingUrl.trim(),
          reason: reason.trim(),
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({ error: 'unknown' }))) as { error?: string }
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setStatus('sent')
      toast.success('SMS envoyé', { description: `Visio proposée à ${clientName}.` })
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
    >
      <div className="bg-paper rounded-xl border border-rule shadow-md max-w-lg w-full p-5 animate-slide-up">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="label-mono text-ink-mute mb-1">Récupération à distance</p>
            <h2 className="text-[18px] font-semibold text-ink">
              Proposer une visio à {clientName}
            </h2>
            <p className="text-[13px] text-ink-soft mt-1">
              SMS envoyé au {clientPhone} avec le lien et le motif.
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

        {status === 'sent' ? (
          <div className="bg-success/10 border border-success/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-full bg-success/15 flex items-center justify-center shrink-0">
                <Check className="size-4 text-success" aria-hidden />
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-ink leading-snug">SMS envoyé</p>
                <p className="text-[13px] text-ink-soft mt-1 leading-snug">
                  {clientName} a reçu le lien et le motif de la visio.
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
            <label htmlFor="meeting-url" className="block text-[13px] font-medium text-ink mb-2">
              Lien visio (Meet, Whereby, Jitsi…)
            </label>
            <Input
              id="meeting-url"
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/abc-defg-hij"
              className="mb-4"
              disabled={status === 'sending'}
            />

            <label htmlFor="reason" className="block text-[13px] font-medium text-ink mb-2">
              Motif de l\'appel
            </label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex. Vérifier la marque/modèle de la chaudière, 5 minutes maximum"
              rows={3}
              maxLength={300}
              className="mb-4"
              disabled={status === 'sending'}
            />

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
