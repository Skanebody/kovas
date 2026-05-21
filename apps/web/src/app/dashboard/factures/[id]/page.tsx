import { AppPageHeader } from '@/components/app-page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { InvoiceLivePreview } from '@/components/invoices/InvoiceLivePreview'
import { InvoiceStatusPill } from '@/components/invoices/InvoiceStatusPill'
import { InvoiceReminderHistory } from '@/components/invoices/InvoiceReminderHistory'
import {
  parseLineItems,
  type InvoiceClientSnapshot,
  type InvoiceIssuerSnapshot,
  type InvoiceStatus,
} from '@/lib/invoices/types'
import { hasActiveFollowUpSequenceAction } from '@/app/dashboard/relances/actions'
import { hasFeatureAccess } from '@/lib/upsell/access-control'
import { loadUserAccess } from '@/lib/upsell/load-access'
import { InvoiceDetailActions } from './InvoiceDetailActions'

export const metadata: Metadata = { title: 'Facture' }
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDateFr(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

export default async function FactureDetailPage({ params }: PageProps) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (error || !invoice) notFound()

  // Charge org pour aperçu / branding
  const { data: org } = await supabase
    .from('organizations')
    .select('name, siret, vat_number, address, city, postal_code, country, iban, bic, bank_name')
    .eq('id', orgId)
    .maybeSingle()

  // Snapshot client : priorité au snapshot stocké à l'émission, sinon clients table
  let clientSnapshot = invoice.client_snapshot as InvoiceClientSnapshot | null
  if (!clientSnapshot && invoice.client_id) {
    const { data: c } = await supabase
      .from('clients')
      .select('display_name, email, phone, address, city, postal_code, country, siret, type')
      .eq('id', invoice.client_id)
      .maybeSingle()
    if (c) {
      clientSnapshot = {
        display_name: c.display_name,
        email: c.email,
        phone: c.phone,
        address: c.address,
        city: c.city,
        postal_code: c.postal_code,
        country: c.country ?? 'FR',
        siret: c.siret,
        type: c.type,
      }
    }
  }
  const safeClient: InvoiceClientSnapshot = clientSnapshot ?? {
    display_name: 'Client supprimé',
    email: null,
    phone: null,
    address: null,
    city: null,
    postal_code: null,
    country: 'FR',
    siret: null,
    type: 'particulier',
  }

  const issuer: InvoiceIssuerSnapshot = {
    name: org?.name ?? 'Mon cabinet',
    siret: org?.siret ?? null,
    vat_number: org?.vat_number ?? null,
    address: org?.address ?? null,
    city: org?.city ?? null,
    postal_code: org?.postal_code ?? null,
    country: org?.country ?? 'FR',
    iban: org?.iban ?? null,
    bic: org?.bic ?? null,
    bank_name: org?.bank_name ?? null,
    logo_url: null,
    brand_color_hex: null,
  }

  const status = invoice.status as InvoiceStatus
  const isCreditNote = Boolean(invoice.credit_note_for_invoice_id)
  const lineItems = parseLineItems(invoice.line_items)
  const ttc = Number(invoice.amount_ttc)
  const paid = Number(invoice.paid_amount ?? 0)
  const remaining = Math.max(0, ttc - paid)

  // Charge éventuel avoir lié
  const { data: relatedCreditNotes } = await supabase
    .from('invoices')
    .select('id, reference, status, amount_ttc')
    .eq('organization_id', orgId)
    .eq('credit_note_for_invoice_id', invoice.id)

  // P7 — Vérifie s'il y a déjà une séquence relance active pour cette facture
  const followUp = await hasActiveFollowUpSequenceAction('invoice', invoice.id)

  // L1 — Vérifie si l'addon pennylane_sync est actif pour afficher le bouton
  // sans modal upsell (ou avec, si inactif).
  const access = await loadUserAccess(supabase, orgId)
  const hasPennylaneSync = hasFeatureAccess(access, { requiredAddons: ['pennylane_sync'] })

  // Si c'est un avoir : charge la facture d'origine
  let originalInvoice: { id: string; reference: string } | null = null
  if (invoice.credit_note_for_invoice_id) {
    const { data: orig } = await supabase
      .from('invoices')
      .select('id, reference')
      .eq('id', invoice.credit_note_for_invoice_id)
      .maybeSingle()
    originalInvoice = orig
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        title={isCreditNote ? 'Avoir' : 'Facture'}
        accent={invoice.reference}
        description={
          isCreditNote && originalInvoice
            ? `Annule la facture ${originalInvoice.reference}.`
            : undefined
        }
        action={
          <div className="flex items-center gap-3">
            <InvoiceStatusPill status={status} />
            <InvoiceDetailActions
              invoiceId={invoice.id}
              invoiceReference={invoice.reference}
              status={status}
              amountTtc={ttc}
              paidAmount={paid}
              isCreditNote={isCreditNote}
              clientEmail={safeClient.email}
              hasPdf={Boolean(invoice.pdf_path)}
              hasXml={Boolean(invoice.facturx_xml)}
              hasActiveFollowUp={followUp.exists}
              hasPennylaneSync={hasPennylaneSync}
            />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,380px)]">
        {/* Colonne gauche : aperçu */}
        <div className="space-y-6">
          <InvoiceLivePreview
            reference={invoice.reference}
            kind={isCreditNote ? 'credit_note' : 'invoice'}
            issuedAt={invoice.issued_at}
            dueDate={invoice.due_date}
            paymentTermsDays={invoice.payment_terms_days ?? 30}
            lineItems={lineItems}
            amountHt={Number(invoice.amount_ht)}
            amountTva={Number(invoice.amount_tva)}
            amountTtc={ttc}
            tvaRate={Number(invoice.tva_rate ?? 20)}
            notes={invoice.notes}
            issuer={issuer}
            client={safeClient}
          />

          {/* Avoir(s) lié(s) */}
          {relatedCreditNotes && relatedCreditNotes.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Avoirs liés</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {relatedCreditNotes.map((cn) => (
                    <li
                      key={cn.id}
                      className="flex items-center justify-between p-3 rounded-[12px] bg-paper border border-[#0F1419]/[0.06]"
                    >
                      <div>
                        <Link
                          href={`/dashboard/factures/${cn.id}`}
                          className="font-mono text-[12px] font-semibold text-ink hover:underline"
                        >
                          {cn.reference}
                        </Link>
                        <p className="text-[11px] text-ink-mute mt-0.5">
                          {formatEur(Number(cn.amount_ttc))} TTC
                        </p>
                      </div>
                      <InvoiceStatusPill status={cn.status as InvoiceStatus} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Colonne droite : récap + historique relances */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Récapitulatif</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-ink-mute">Émise le</span>
                <span className="text-ink">{formatDateFr(invoice.issued_at)}</span>
              </div>
              {!isCreditNote ? (
                <div className="flex justify-between">
                  <span className="text-ink-mute">Échéance</span>
                  <span className="text-ink">{formatDateFr(invoice.due_date)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-rule pt-3">
                <span className="text-ink-mute">Montant HT</span>
                <span className="tabular-nums text-ink">{formatEur(Number(invoice.amount_ht))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-mute">TVA</span>
                <span className="tabular-nums text-ink">{formatEur(Number(invoice.amount_tva))}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-ink">Total TTC</span>
                <span className="tabular-nums text-ink">{formatEur(ttc)}</span>
              </div>
              {!isCreditNote ? (
                <>
                  <div className="flex justify-between border-t border-rule pt-3">
                    <span className="text-ink-mute">Encaissé</span>
                    <span className="tabular-nums text-ink">{formatEur(paid)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-ink">Restant dû</span>
                    <span className="tabular-nums text-ink">{formatEur(remaining)}</span>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          {!isCreditNote && status !== 'draft' && status !== 'paid' && status !== 'cancelled' ? (
            <Card>
              <CardHeader>
                <CardTitle>Relances</CardTitle>
              </CardHeader>
              <CardContent>
                <InvoiceReminderHistory
                  reminderJ7At={invoice.reminder_j7_sent_at}
                  reminderJ15At={invoice.reminder_j15_sent_at}
                  reminderJ30At={invoice.reminder_j30_sent_at}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
