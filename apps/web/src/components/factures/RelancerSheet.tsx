'use client'

/**
 * KOVAS — Sheet de relance facture en retard.
 *
 * V1 stub : prévisualisation email template + bouton "Envoyer". Le sending
 * réel (Brevo) sera branché dans une itération suivante — pour l'instant le
 * bouton affiche un toast de confirmation et ferme le sheet.
 *
 * Pattern V5 : sobre, vouvoiement, sans emoji, navy + chartreuse.
 */

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export interface RelancerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceReference: string
  clientName: string
  clientEmail: string | null
  amountDueEur: number
}

export function RelancerSheet({
  open,
  onOpenChange,
  invoiceReference,
  clientName,
  clientEmail,
  amountDueEur,
}: RelancerSheetProps) {
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const amountFmt = amountDueEur.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const subject = `Rappel paiement — Facture ${invoiceReference}`
  const body = [
    `Bonjour ${clientName},`,
    '',
    `Sauf erreur de notre part, la facture ${invoiceReference} d'un montant de ${amountFmt} reste impayée à ce jour.`,
    '',
    `Nous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais. Si le paiement a déjà été effectué, merci d'ignorer ce message.`,
    '',
    "Pour toute question, n'hésitez pas à nous répondre directement à cet email.",
    '',
    'Cordialement,',
    "L'équipe KOVAS",
  ].join('\n')

  async function handleSend() {
    setSubmitting(true)
    // V1 stub — pas d'appel réseau. Itération suivante : POST /api/invoices/{id}/relance
    await new Promise((resolve) => setTimeout(resolve, 250))
    setSubmitting(false)
    setSent(true)
    setTimeout(() => {
      onOpenChange(false)
      setSent(false)
    }, 1200)
  }

  const canSend = Boolean(clientEmail) && !submitting && !sent

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Relancer ce client"
      description={`Aperçu email — facture ${invoiceReference}`}
    >
      <div className="space-y-4 pb-2">
        {/* Destinataire */}
        <div className="rounded-xl border border-rule/60 bg-paper px-4 py-3 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
            Destinataire
          </p>
          <p className="text-[14px] text-ink">{clientName}</p>
          <p className="font-mono text-[12px] text-ink-mute">
            {clientEmail ?? 'Aucun email renseigné'}
          </p>
        </div>

        {/* Sujet */}
        <div className="rounded-xl border border-rule/60 bg-paper px-4 py-3 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">Objet</p>
          <p className="text-[14px] text-ink font-medium">{subject}</p>
        </div>

        {/* Corps */}
        <div className="rounded-xl border border-rule/60 bg-paper px-4 py-3 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">Message</p>
          <pre className="font-sans text-[13px] text-ink whitespace-pre-wrap leading-relaxed">
            {body}
          </pre>
        </div>

        {/* CTA */}
        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="accent"
            className="flex-1"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Envoyer la relance par email"
          >
            {sent ? 'Envoyée' : submitting ? 'Envoi…' : 'Envoyer la relance'}
          </Button>
        </div>

        {!clientEmail ? (
          <p className="text-[12px] text-danger text-center">
            Ajoutez un email sur la fiche client pour pouvoir relancer.
          </p>
        ) : null}
      </div>
    </BottomSheet>
  )
}
