'use client'

import { InvoiceLivePreview } from '@/components/invoices/InvoiceLivePreview'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  type InvoiceClientSnapshot,
  type InvoiceIssuerSnapshot,
  type InvoiceLineItem,
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
  computeInvoiceTotals,
} from '@/lib/invoices/types'
import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { type InvoiceFormState, createInvoiceDraftAction } from '../actions'

export interface InvoiceWizardFormProps {
  clients: { id: string; display_name: string; email: string | null }[]
}

const DEFAULT_LINE: InvoiceLineItem = {
  label: '',
  quantity: 1,
  unit_price_ht: 0,
  tva_rate: 20,
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'virement',
  'card',
  'sepa',
  'cheque',
  'especes',
  'prelevement',
  'autre',
]

export function InvoiceWizardForm({ clients }: InvoiceWizardFormProps) {
  const [clientId, setClientId] = useState<string>(clients[0]?.id ?? '')
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([{ ...DEFAULT_LINE }])
  const [tvaRate, setTvaRate] = useState<number>(20)
  const [paymentTermsDays, setPaymentTermsDays] = useState<number>(30)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('virement')
  const [notes, setNotes] = useState<string>('')
  const [formState, setFormState] = useState<InvoiceFormState>(undefined)
  const [isPending, startTransition] = useTransition()

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId],
  )

  const totals = useMemo(() => computeInvoiceTotals(lineItems), [lineItems])

  // Snapshot fake pour aperçu (Org sera chargée à l'émission côté serveur)
  const previewIssuer: InvoiceIssuerSnapshot = {
    name: 'Votre cabinet',
    siret: null,
    vat_number: null,
    address: null,
    city: null,
    postal_code: null,
    country: 'FR',
    iban: null,
    bic: null,
    bank_name: null,
    logo_url: null,
    brand_color_hex: null,
  }

  const previewClient: InvoiceClientSnapshot = {
    display_name: selectedClient?.display_name ?? 'Client à sélectionner',
    email: selectedClient?.email ?? null,
    phone: null,
    address: null,
    city: null,
    postal_code: null,
    country: 'FR',
    siret: null,
    type: 'particulier',
  }

  const issuedAtIso = new Date().toISOString().slice(0, 10)
  const dueDateIso = (() => {
    const d = new Date()
    d.setDate(d.getDate() + paymentTermsDays)
    return d.toISOString().slice(0, 10)
  })()

  const updateLine = (idx: number, patch: Partial<InvoiceLineItem>) => {
    setLineItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)))
  }

  const addLine = () => setLineItems((prev) => [...prev, { ...DEFAULT_LINE, tva_rate: tvaRate }])
  const removeLine = (idx: number) =>
    setLineItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData()
    fd.append('client_id', clientId)
    fd.append('line_items', JSON.stringify(lineItems))
    fd.append('tva_rate', String(tvaRate))
    fd.append('payment_terms_days', String(paymentTermsDays))
    fd.append('payment_method', paymentMethod)
    if (notes) fd.append('notes', notes)
    startTransition(async () => {
      const result = await createInvoiceDraftAction(undefined, fd)
      if (result?.error) {
        setFormState(result)
      }
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_minmax(340px,420px)]">
      {/* Colonne gauche : formulaire */}
      <div className="space-y-4">
        {/* Bloc client */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-serif italic text-[20px] text-ink">Client</h2>
            <FormField
              label="Client destinataire"
              htmlFor="client_id"
              required
              error={formState?.fieldErrors?.client_id}
            >
              <Select
                id="client_id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={clients.length === 0}
              >
                {clients.length === 0 ? (
                  <option value="">Aucun client — créez-en un d'abord</option>
                ) : null}
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                    {c.email ? ` — ${c.email}` : ''}
                  </option>
                ))}
              </Select>
            </FormField>
          </CardContent>
        </Card>

        {/* Bloc prestations */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif italic text-[20px] text-ink">Prestations</h2>
              <Button type="button" variant="ghost" size="sm" onClick={addLine}>
                <Plus className="size-3.5" />
                Ajouter une ligne
              </Button>
            </div>
            <div className="space-y-3">
              {lineItems.map((item, idx) => (
                <div
                  key={idx}
                  className="grid gap-2 md:grid-cols-[1fr_70px_100px_80px_36px] items-end"
                >
                  <FormField label={idx === 0 ? 'Désignation' : ''} htmlFor={`label-${idx}`}>
                    <Input
                      id={`label-${idx}`}
                      value={item.label}
                      onChange={(e) => updateLine(idx, { label: e.target.value })}
                      placeholder="DPE Vente — 75m²"
                      required
                    />
                  </FormField>
                  <FormField label={idx === 0 ? 'Qté' : ''} htmlFor={`qty-${idx}`}>
                    <Input
                      id={`qty-${idx}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.quantity}
                      onChange={(e) =>
                        updateLine(idx, {
                          quantity: Number.parseFloat(e.target.value) || 0,
                        })
                      }
                      required
                    />
                  </FormField>
                  <FormField label={idx === 0 ? 'P.U. HT (€)' : ''} htmlFor={`pu-${idx}`}>
                    <Input
                      id={`pu-${idx}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unit_price_ht}
                      onChange={(e) =>
                        updateLine(idx, {
                          unit_price_ht: Number.parseFloat(e.target.value) || 0,
                        })
                      }
                      required
                    />
                  </FormField>
                  <FormField label={idx === 0 ? 'TVA %' : ''} htmlFor={`tva-${idx}`}>
                    <Input
                      id={`tva-${idx}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.tva_rate}
                      onChange={(e) =>
                        updateLine(idx, { tva_rate: Number.parseFloat(e.target.value) || 0 })
                      }
                      required
                    />
                  </FormField>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(idx)}
                    disabled={lineItems.length <= 1}
                    aria-label={`Supprimer la ligne ${idx + 1}`}
                  >
                    <Trash2 className="size-4 text-danger" />
                  </Button>
                </div>
              ))}
            </div>
            {formState?.fieldErrors?.line_items ? (
              <p className="text-[12px] text-danger">{formState.fieldErrors.line_items}</p>
            ) : null}
          </CardContent>
        </Card>

        {/* Bloc paiement */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-serif italic text-[20px] text-ink">Paiement</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Délai (jours)" htmlFor="payment_terms_days" required>
                <Input
                  id="payment_terms_days"
                  type="number"
                  min="1"
                  max="60"
                  value={paymentTermsDays}
                  onChange={(e) => setPaymentTermsDays(Number.parseInt(e.target.value, 10) || 30)}
                />
              </FormField>
              <FormField label="Mode privilégié" htmlFor="payment_method" required>
                <Select
                  id="payment_method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABEL[m]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="TVA globale (%)" htmlFor="tva_rate">
                <Input
                  id="tva_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={tvaRate}
                  onChange={(e) => setTvaRate(Number.parseFloat(e.target.value) || 0)}
                />
              </FormField>
            </div>
            <FormField label="Notes / mentions complémentaires" htmlFor="notes">
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Optionnel — apparaîtra en pied de facture."
              />
            </FormField>
          </CardContent>
        </Card>

        {formState?.error ? (
          <p className="text-[13px] text-danger" role="alert">
            {formState.error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <Button type="submit" variant="accent" disabled={isPending || !clientId}>
            {isPending ? 'Création…' : 'Créer la facture (brouillon)'}
          </Button>
        </div>
      </div>

      {/* Colonne droite : aperçu live (sticky desktop) */}
      <div className="lg:sticky lg:top-24 self-start">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute mb-2">
          Aperçu
        </p>
        <InvoiceLivePreview
          reference="FAC-2026-XXXXX"
          kind="invoice"
          issuedAt={issuedAtIso}
          dueDate={dueDateIso}
          paymentTermsDays={paymentTermsDays}
          lineItems={lineItems}
          amountHt={totals.amount_ht}
          amountTva={totals.amount_tva}
          amountTtc={totals.amount_ttc}
          tvaRate={tvaRate}
          notes={notes || null}
          issuer={previewIssuer}
          client={previewClient}
        />
      </div>
    </form>
  )
}
