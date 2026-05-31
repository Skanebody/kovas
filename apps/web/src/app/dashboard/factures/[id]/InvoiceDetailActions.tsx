'use client'

import { CreateFollowUpDialog } from '@/components/followup/CreateFollowUpDialog'
import { InvoicePaymentSheet } from '@/components/invoices/InvoicePaymentSheet'
import { Button } from '@/components/ui/button'
import { UpsellModal } from '@/components/upsell/UpsellModal'
import type { InvoiceStatus, PaymentMethod } from '@/lib/invoices/types'
import { Bell, CreditCard, Download, FileText, Mail, RefreshCw, Send, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  cancelInvoiceDraftAction,
  getPdfDownloadUrlAction,
  issueInvoiceAction,
  markInvoicePaidAction,
  sendManualReminderAction,
} from '../actions'

export interface InvoiceDetailActionsProps {
  invoiceId: string
  invoiceReference: string
  status: InvoiceStatus
  amountTtc: number
  paidAmount: number
  isCreditNote: boolean
  clientEmail: string | null
  hasPdf: boolean
  hasXml: boolean
  /** True si une séquence de relance active/paused existe déjà pour cette facture. */
  hasActiveFollowUp: boolean
  /** True si l'addon pennylane_sync est actif pour cette org. */
  hasPennylaneSync?: boolean
}

/**
 * Barre d'actions latérale du détail facture — toutes les server actions
 * sont appelées via useTransition + toast léger côté client.
 */
export function InvoiceDetailActions({
  invoiceId,
  invoiceReference,
  status,
  amountTtc,
  paidAmount,
  isCreditNote,
  clientEmail,
  hasPdf,
  hasXml,
  hasActiveFollowUp,
  hasPennylaneSync = false,
}: InvoiceDetailActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [pennylaneUpsellOpen, setPennylaneUpsellOpen] = useState(false)

  const handlePennylaneClick = () => {
    if (hasPennylaneSync) {
      // Addon actif → synchronisation réelle vers Pennylane (PDP DGFiP).
      startTransition(async () => {
        try {
          const res = await fetch(`/api/invoices/${invoiceId}/sync-pennylane`, {
            method: 'POST',
          })
          const data = (await res.json().catch(() => null)) as {
            ok?: boolean
            already_synced?: boolean
            message?: string
          } | null
          if (!res.ok) {
            showFeedback('error', data?.message ?? 'Synchronisation Pennylane échouée.')
            return
          }
          showFeedback(
            'success',
            data?.already_synced
              ? 'Facture déjà synchronisée vers Pennylane.'
              : 'Facture synchronisée vers Pennylane.',
          )
          router.refresh()
        } catch (err) {
          showFeedback(
            'error',
            err instanceof Error ? err.message : 'Synchronisation Pennylane échouée.',
          )
        }
      })
      return
    }
    // Track attempt + ouvre modal upsell
    void fetch('/api/upsell/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event_type: 'pennylane_attempted' }),
    }).catch(() => undefined)
    setPennylaneUpsellOpen(true)
  }

  const showFeedback = (kind: 'success' | 'error', text: string) => {
    setFeedback({ kind, text })
    setTimeout(() => setFeedback(null), 5000)
  }

  const handleIssue = () => {
    startTransition(async () => {
      const result = await issueInvoiceAction(invoiceId)
      if (result.error) {
        showFeedback('error', result.error)
        return
      }
      showFeedback(
        'success',
        clientEmail
          ? `Facture émise et envoyée à ${clientEmail}.`
          : 'Facture émise. Aucun email client renseigné — envoi manuel requis.',
      )
      router.refresh()
    })
  }

  const handleDownloadPdf = () => {
    startTransition(async () => {
      const result = await getPdfDownloadUrlAction(invoiceId)
      if (result.error || !result.url) {
        showFeedback('error', result.error ?? 'PDF indisponible')
        return
      }
      window.open(result.url, '_blank', 'noopener,noreferrer')
    })
  }

  const handleDownloadXml = () => {
    // Le XML est stocké dans invoices.facturx_xml — on l'expose via une route
    // GET dédiée plus simple à implémenter qu'un proxy ici. V1 : on télécharge
    // via fetch + blob côté client.
    startTransition(async () => {
      try {
        const res = await fetch(`/api/factures/${invoiceId}/xml`, { method: 'GET' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const xml = await res.text()
        const blob = new Blob([xml], { type: 'application/xml' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${invoiceReference}.xml`
        a.click()
        URL.revokeObjectURL(url)
      } catch (err) {
        showFeedback('error', err instanceof Error ? err.message : 'Téléchargement XML échoué')
      }
    })
  }

  const handleManualReminder = () => {
    startTransition(async () => {
      const result = await sendManualReminderAction(invoiceId)
      if (result.error) {
        showFeedback('error', result.error)
        return
      }
      showFeedback(
        'success',
        clientEmail ? `Relance envoyée à ${clientEmail}.` : 'Relance envoyée.',
      )
      router.refresh()
    })
  }

  const handleCancel = () => {
    if (!confirm('Supprimer définitivement ce brouillon ?')) return
    startTransition(async () => {
      const result = await cancelInvoiceDraftAction(invoiceId)
      if (result?.error) {
        showFeedback('error', result.error)
      }
    })
  }

  const submitPayment = async (input: {
    invoiceId: string
    paidAmount: number
    paymentMethod: PaymentMethod
    paidAt: string
  }): Promise<{ error?: string } | undefined> => {
    const result = await markInvoicePaidAction(input)
    if (result.error) {
      return { error: result.error }
    }
    router.refresh()
    showFeedback('success', 'Paiement enregistré.')
    return
  }

  const canIssue = status === 'draft' && !isCreditNote
  const canPay =
    !isCreditNote && (status === 'issued' || status === 'partial' || status === 'overdue')
  const canRemind = canPay && clientEmail
  const canDeleteDraft = status === 'draft'
  // P7 — Création séquence relance auto possible si facture émise (non payée ni annulée) et pas d'avoir
  const canCreateFollowUp =
    !isCreditNote && (status === 'issued' || status === 'partial' || status === 'overdue')

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex flex-wrap gap-2 justify-end">
        {canIssue ? (
          <Button onClick={handleIssue} disabled={isPending} variant="accent">
            <Send className="size-4" />
            Émettre la facture
          </Button>
        ) : null}
        {canPay ? (
          <Button onClick={() => setPaymentOpen(true)} disabled={isPending} variant="accent">
            <CreditCard className="size-4" />
            Marquer payé
          </Button>
        ) : null}
        {canRemind ? (
          <Button onClick={handleManualReminder} disabled={isPending} variant="outline">
            <Mail className="size-4" />
            Relance manuelle
          </Button>
        ) : null}
        {canCreateFollowUp ? (
          hasActiveFollowUp ? (
            <Button asChild variant="ghost">
              <Link href="/dashboard/relances?tab=unpaid_invoice">
                <Bell className="size-4" />
                Séquence active
              </Link>
            </Button>
          ) : (
            <Button onClick={() => setFollowUpOpen(true)} disabled={isPending} variant="outline">
              <Bell className="size-4" />
              Créer séquence relance
            </Button>
          )
        ) : null}
        {hasPdf ? (
          <Button onClick={handleDownloadPdf} disabled={isPending} variant="outline">
            <Download className="size-4" />
            PDF
          </Button>
        ) : null}
        {hasXml ? (
          <Button onClick={handleDownloadXml} disabled={isPending} variant="outline">
            <FileText className="size-4" />
            XML
          </Button>
        ) : null}
        {/* L1 — Bouton Pennylane toujours visible. Si addon inactif → modal upsell au clic */}
        {!isCreditNote &&
        (status === 'issued' ||
          status === 'partial' ||
          status === 'paid' ||
          status === 'overdue') ? (
          <Button onClick={handlePennylaneClick} disabled={isPending} variant="outline">
            <RefreshCw className="size-4" />
            Synchroniser Pennylane
          </Button>
        ) : null}
        {!isCreditNote && status !== 'draft' && status !== 'cancelled' ? (
          <Button asChild variant="ghost">
            <Link href={`/dashboard/factures/${invoiceId}/avoir`}>Créer un avoir</Link>
          </Button>
        ) : null}
        {canDeleteDraft ? (
          <Button onClick={handleCancel} disabled={isPending} variant="ghost">
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>

      {feedback ? (
        <output
          className={`block text-[12px] ${feedback.kind === 'success' ? 'text-success' : 'text-danger'}`}
        >
          {feedback.text}
        </output>
      ) : null}

      <InvoicePaymentSheet
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        invoiceId={invoiceId}
        invoiceReference={invoiceReference}
        amountDue={amountTtc}
        alreadyPaid={paidAmount}
        onSubmit={submitPayment}
      />

      <CreateFollowUpDialog
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        targetType="invoice"
        targetId={invoiceId}
        targetReference={invoiceReference}
      />

      <UpsellModal
        target="pennylane_sync"
        trigger="invoice_pennylane_click"
        open={pennylaneUpsellOpen}
        onOpenChange={setPennylaneUpsellOpen}
      />
    </div>
  )
}
