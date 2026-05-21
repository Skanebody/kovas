'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/lib/invoices/types'

const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = [
  'virement',
  'card',
  'sepa',
  'cheque',
  'especes',
  'prelevement',
  'autre',
]

export interface InvoicePaymentSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceReference: string
  amountDue: number
  alreadyPaid: number
  /**
   * Action serveur — appelée avec (invoiceId, paidAmount, paymentMethod, paidAt).
   * Doit lever ou retourner une erreur pour signaler l'échec.
   */
  onSubmit: (input: {
    invoiceId: string
    paidAmount: number
    paymentMethod: PaymentMethod
    paidAt: string
  }) => Promise<void | { error?: string }>
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Modal "Marquer comme payée".
 * - Paiement total (montant pré-rempli avec amount_due)
 * - Paiement partiel possible (montant inférieur)
 * - Sélection méthode de paiement + date du règlement
 */
export function InvoicePaymentSheet({
  open,
  onOpenChange,
  invoiceId,
  invoiceReference,
  amountDue,
  alreadyPaid,
  onSubmit,
}: InvoicePaymentSheetProps) {
  const remaining = Math.max(0, amountDue - alreadyPaid)
  const [paidAmount, setPaidAmount] = useState<string>(remaining.toFixed(2))
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('virement')
  const [paidAt, setPaidAt] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const submit = () => {
    setError(null)
    const amount = Number.parseFloat(paidAmount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Le montant doit être supérieur à 0.')
      return
    }
    if (amount > remaining + 0.01) {
      setError(`Le montant ne peut dépasser le restant dû (${formatEur(remaining)}).`)
      return
    }
    startTransition(async () => {
      const result = await onSubmit({
        invoiceId,
        paidAmount: Math.round(amount * 100) / 100,
        paymentMethod,
        paidAt,
      })
      if (result && 'error' in result && result.error) {
        setError(result.error)
        return
      }
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
          <DialogDescription>
            Facture {invoiceReference} — restant dû : {formatEur(remaining)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormField label="Montant reçu (€)" htmlFor="paidAmount" required>
            <Input
              id="paidAmount"
              type="number"
              step="0.01"
              min="0"
              max={remaining + 0.01}
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              autoFocus
            />
          </FormField>

          <FormField label="Mode de paiement" htmlFor="paymentMethod" required>
            <Select
              id="paymentMethod"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHOD_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Date du règlement" htmlFor="paidAt" required>
            <Input
              id="paidAt"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </FormField>

          {error ? <p className="text-[12px] text-danger">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Annuler
          </Button>
          <Button variant="accent" onClick={submit} disabled={isPending}>
            {isPending ? 'Enregistrement…' : 'Enregistrer le paiement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
