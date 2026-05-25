'use client'

/**
 * EmailComposeSheet — bottom sheet "Envoyer un email" (compose + envoi Brevo).
 *
 * Spec V5 sobre :
 *   - À (email destinataire, pré-rempli)
 *   - Sujet (input)
 *   - Message (textarea 8 rows)
 *   - Bouton primary navy + ghost annuler
 *   - Toast sonner success / error
 *
 * Le serveur ajoute automatiquement signature "L'équipe KOVAS" + footer
 * mentions légales NEXUS 1993 (source unique vérité : COMPANY_IDENTITY).
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import {
  BottomSheet,
  BottomSheetActions,
  BottomSheetBody,
  BottomSheetTitle,
} from '@/components/ui/bottom-sheet'

interface EmailComposeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Email pré-rempli. */
  defaultTo: string | null
  /** Optionnel : clientId pour ownership check + log. */
  clientId?: string
}

const MIN_SUBJECT = 3
const MIN_BODY = 10

interface ApiResponse {
  ok: boolean
  error?: string
  messageId?: string
}

export function EmailComposeSheet({
  open,
  onOpenChange,
  defaultTo,
  clientId,
}: EmailComposeSheetProps) {
  const [to, setTo] = useState<string>(defaultTo ?? '')
  const [subject, setSubject] = useState<string>('')
  const [body, setBody] = useState<string>('')
  const [submitting, setSubmitting] = useState<boolean>(false)

  useEffect(() => {
    if (open) {
      setTo(defaultTo ?? '')
      setSubject('')
      setBody('')
    }
  }, [open, defaultTo])

  const trimmedSubject = subject.trim()
  const trimmedBody = body.trim()
  const canSubmit =
    !submitting &&
    to.includes('@') &&
    trimmedSubject.length >= MIN_SUBJECT &&
    trimmedBody.length >= MIN_BODY

  async function handleSend(): Promise<void> {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          to: to.trim(),
          subject: trimmedSubject,
          body: trimmedBody,
          clientId: clientId ?? null,
        }),
      })
      const data = (await response.json().catch(() => ({}))) as ApiResponse

      if (!response.ok || !data.ok) {
        toast.error(data.error ?? "L'envoi de l'email a échoué.")
        return
      }
      toast.success('Email envoyé.')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur réseau.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} maxHeight="90vh">
      <BottomSheetTitle>Envoyer un email</BottomSheetTitle>
      <BottomSheetBody>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="email-to"
              className="block font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute"
            >
              À
            </label>
            <input
              id="email-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              autoComplete="email"
              placeholder="client@exemple.fr"
              disabled={submitting}
              className="w-full h-11 rounded-md border border-rule bg-paper px-3 text-[14px] text-ink placeholder:text-ink-ghost focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="email-subject"
              className="block font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute"
            >
              Sujet
            </label>
            <input
              id="email-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              placeholder="Confirmation de votre rendez-vous"
              disabled={submitting}
              className="w-full h-11 rounded-md border border-rule bg-paper px-3 text-[14px] text-ink placeholder:text-ink-ghost focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="email-body"
              className="block font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute"
            >
              Message
            </label>
            <textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              rows={8}
              placeholder={
                'Bonjour,\n\nJe vous confirme notre rendez-vous demain à 10h pour le diagnostic du bien situé…'
              }
              disabled={submitting}
              className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-[14px] text-ink placeholder:text-ink-ghost focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30 disabled:opacity-60 resize-none"
            />
          </div>

          <p className="text-[12px] text-ink-mute">
            Signature « L&apos;équipe KOVAS » et mentions légales NEXUS 1993 sont ajoutées
            automatiquement.
          </p>
        </div>
      </BottomSheetBody>

      <BottomSheetActions
        primary={submitting ? 'Envoi…' : 'Envoyer'}
        onPrimary={handleSend}
        primaryDisabled={!canSubmit}
        secondary="Annuler"
        onSecondary={() => onOpenChange(false)}
      />
    </BottomSheet>
  )
}
