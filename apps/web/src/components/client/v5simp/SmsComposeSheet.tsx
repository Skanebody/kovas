'use client'

/**
 * SmsComposeSheet — bottom sheet "Envoyer un SMS" (compose + envoi Brevo).
 *
 * Spec V5 sobre :
 *   - Champ téléphone (pré-rempli E.164 ou national, modifiable)
 *   - Textarea message, max 160 chars (1 SMS), compteur mono
 *   - Bouton primary navy + ghost annuler (BottomSheetActions)
 *   - Toast sonner success / error
 *
 * Le serveur (POST /api/sms/send) valide à nouveau et envoie via Brevo.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import {
  BottomSheet,
  BottomSheetActions,
  BottomSheetBody,
  BottomSheetTitle,
} from '@/components/ui/bottom-sheet'

interface SmsComposeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Téléphone pré-rempli (E.164 idéalement). */
  defaultPhone: string | null
  /** Optionnel : clientId pour ownership check + log. */
  clientId?: string
}

const MAX_LEN = 160
const MIN_LEN = 3

interface ApiResponse {
  ok: boolean
  error?: string
  messageId?: string
}

export function SmsComposeSheet({
  open,
  onOpenChange,
  defaultPhone,
  clientId,
}: SmsComposeSheetProps) {
  const [phone, setPhone] = useState<string>(defaultPhone ?? '')
  const [message, setMessage] = useState<string>('')
  const [submitting, setSubmitting] = useState<boolean>(false)

  // Reset du formulaire à chaque réouverture
  useEffect(() => {
    if (open) {
      setPhone(defaultPhone ?? '')
      setMessage('')
    }
  }, [open, defaultPhone])

  const trimmedMessage = message.trim()
  const canSubmit =
    !submitting &&
    phone.trim().length >= 6 &&
    trimmedMessage.length >= MIN_LEN &&
    trimmedMessage.length <= MAX_LEN

  async function handleSend(): Promise<void> {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          message: trimmedMessage,
          clientId: clientId ?? null,
        }),
      })
      const data = (await response.json().catch(() => ({}))) as ApiResponse

      if (!response.ok || !data.ok) {
        toast.error(data.error ?? "L'envoi du SMS a échoué.")
        return
      }
      toast.success('SMS envoyé.')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur réseau.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetTitle>Envoyer un SMS</BottomSheetTitle>
      <BottomSheetBody>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="sms-phone" className="block font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
              Destinataire
            </label>
            <input
              id="sms-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="+33612345678"
              disabled={submitting}
              className="w-full h-11 rounded-md border border-rule bg-paper px-3 font-mono text-[14px] text-ink placeholder:text-ink-ghost focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="sms-message" className="block font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
              Message
            </label>
            <textarea
              id="sms-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MAX_LEN + 20}
              rows={4}
              disabled={submitting}
              placeholder="Bonjour, je vous confirme notre rendez-vous demain à 10h."
              className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-[14px] text-ink placeholder:text-ink-ghost focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 disabled:opacity-60 resize-none"
            />
            <div className="flex justify-end">
              <span
                className={
                  trimmedMessage.length > MAX_LEN
                    ? 'font-mono text-[11px] text-red-600'
                    : 'font-mono text-[11px] text-ink-mute'
                }
              >
                {trimmedMessage.length} / {MAX_LEN}
              </span>
            </div>
          </div>

          <p className="text-[12px] text-ink-mute">
            Un SMS est facturé environ 0,07 € HT à votre organisation.
          </p>
        </div>
      </BottomSheetBody>

      <BottomSheetActions
        primary={submitting ? 'Envoi…' : 'Envoyer le SMS'}
        onPrimary={handleSend}
        primaryDisabled={!canSubmit}
        secondary="Annuler"
        onSecondary={() => onOpenChange(false)}
      />
    </BottomSheet>
  )
}
