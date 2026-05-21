import { AppPageHeader } from '@/components/app-page-header'
import { QuoteStatusPill } from '@/components/quotes/QuoteStatusPill'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  type QuoteClientSnapshot,
  type QuoteLineItem,
  QUOTE_PAYMENT_METHOD_LABELS,
  formatDateLong,
  formatEur,
} from '@/lib/quotes/types'
import { ArrowLeft, FileText } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { hasActiveFollowUpSequenceAction } from '@/app/app/relances/actions'
import { QuoteDetailActions } from './actions-bar'

export const metadata: Metadata = { title: 'Devis' }

interface PageProps {
  params: Promise<{ id: string }>
}

interface QuoteDetailRow {
  id: string
  reference: string
  status: string
  amount_ht: number
  amount_tva: number
  amount_ttc: number
  tva_rate: number | null
  line_items: QuoteLineItem[]
  pdf_path: string | null
  issued_at: string | null
  expires_at: string | null
  accepted_at: string | null
  sent_at: string | null
  notes: string | null
  payment_method: string | null
  payment_terms_days: number | null
  client_id: string
  client_snapshot: QuoteClientSnapshot | null
  clients: { display_name: string | null; email: string | null } | null
}

export default async function QuoteDetailPage({ params }: PageProps) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  const { data: quoteRaw } = await supabase
    .from('quotes')
    .select(
      'id, reference, status, amount_ht, amount_tva, amount_ttc, tva_rate, line_items, pdf_path, issued_at, expires_at, accepted_at, sent_at, notes, payment_method, payment_terms_days, client_id, client_snapshot, clients(display_name, email)',
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!quoteRaw) {
    notFound()
  }
  const quote = quoteRaw as unknown as QuoteDetailRow

  // Signed URL du PDF si stocké
  let pdfSignedUrl: string | null = null
  if (quote.pdf_path) {
    const { data: signed } = await supabase.storage
      .from('quotes-pdfs')
      .createSignedUrl(quote.pdf_path, 60 * 60) // 1h pour préview
    pdfSignedUrl = signed?.signedUrl ?? null
  }

  const clientName =
    quote.client_snapshot?.displayName ?? quote.clients?.display_name ?? 'Client retiré'

  // P7 — Vérifie s'il y a déjà une séquence de relance active pour ce devis
  const followUp = await hasActiveFollowUpSequenceAction('quote', quote.id)

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/devis">
          <ArrowLeft className="size-4" /> Retour aux devis
        </Link>
      </Button>

      <AppPageHeader
        title={quote.reference}
        accent={`· ${clientName}`}
        eyebrow="DEVIS"
        description={
          quote.issued_at
            ? `Émis le ${formatDateLong(quote.issued_at)}, valable jusqu'au ${formatDateLong(quote.expires_at)}.`
            : 'Brouillon en attente d\'envoi.'
        }
        action={<QuoteStatusPill status={quote.status} />}
      />

      <QuoteDetailActions
        quoteId={quote.id}
        quoteReference={quote.reference}
        status={quote.status}
        hasPdf={Boolean(pdfSignedUrl)}
        pdfUrl={pdfSignedUrl}
        hasActiveFollowUp={followUp.exists}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bloc principal : prestations + totaux */}
        <div className="lg:col-span-2 space-y-6">
          <Card variant="opaque" padding="default">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute mb-3">
              Prestations
            </p>
            {quote.line_items.length === 0 ? (
              <p className="text-[13px] text-ink-faint italic">Aucune prestation.</p>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-[13px] min-w-[480px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-ink-mute border-b border-rule/60">
                    <th className="text-left py-2 font-medium">Désignation</th>
                    <th className="text-right py-2 font-medium w-[50px]">Qté</th>
                    <th className="text-right py-2 font-medium w-[100px]">PU HT</th>
                    <th className="text-right py-2 font-medium w-[100px]">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.line_items.map((line) => (
                    <tr key={line.id} className="border-b border-rule/40">
                      <td className="py-2 align-top">{line.designation}</td>
                      <td className="py-2 text-right">{line.quantity}</td>
                      <td className="py-2 text-right font-mono">
                        {formatEur(line.unitPriceHt)}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {formatEur(line.quantity * line.unitPriceHt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <div className="w-full sm:w-[240px] space-y-1.5">
                <div className="flex justify-between text-[13px] text-ink-soft">
                  <span>Sous-total HT</span>
                  <span className="font-mono">{formatEur(quote.amount_ht)}</span>
                </div>
                <div className="flex justify-between text-[13px] text-ink-soft">
                  <span>TVA</span>
                  <span className="font-mono">{formatEur(quote.amount_tva)}</span>
                </div>
                <div className="flex justify-between mt-2 pt-2 border-t border-rule/60 text-ink font-semibold">
                  <span className="uppercase text-[11px] tracking-wider font-mono">
                    Total TTC
                  </span>
                  <span className="font-serif italic text-[22px] leading-none">
                    {formatEur(quote.amount_ttc)}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {quote.notes ? (
            <Card variant="opaque" padding="default">
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute mb-2">
                Notes
              </p>
              <p className="text-[13px] text-ink-soft whitespace-pre-wrap">{quote.notes}</p>
            </Card>
          ) : null}
        </div>

        {/* Sidebar : infos paiement + client */}
        <div className="space-y-4">
          <Card variant="opaque" padding="default">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute mb-2">
              Client destinataire
            </p>
            <p className="font-semibold text-ink">
              {quote.client_snapshot?.displayName ?? quote.clients?.display_name ?? '—'}
            </p>
            {quote.client_snapshot?.email ?? quote.clients?.email ? (
              <p className="text-[12px] text-ink-mute">
                {quote.client_snapshot?.email ?? quote.clients?.email}
              </p>
            ) : null}
            {quote.client_snapshot?.phone ? (
              <p className="text-[12px] text-ink-mute">{quote.client_snapshot.phone}</p>
            ) : null}
            {quote.client_snapshot?.companyName ? (
              <p className="text-[12px] text-ink-mute mt-1">
                {quote.client_snapshot.companyName}
              </p>
            ) : null}
            {quote.client_snapshot?.siret ? (
              <p className="text-[12px] text-ink-mute">SIRET {quote.client_snapshot.siret}</p>
            ) : null}
          </Card>

          <Card variant="opaque" padding="default">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute mb-2">
              Conditions de paiement
            </p>
            <p className="text-[13px] text-ink-soft">
              {quote.payment_method
                ? QUOTE_PAYMENT_METHOD_LABELS[
                    quote.payment_method as keyof typeof QUOTE_PAYMENT_METHOD_LABELS
                  ] ?? quote.payment_method
                : '—'}{' '}
              · {quote.payment_terms_days ?? 30} jours
            </p>
          </Card>

          <Card variant="opaque" padding="default">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute mb-2">
              Historique
            </p>
            <ul className="space-y-1.5 text-[12px] text-ink-soft">
              {quote.issued_at ? (
                <li>
                  <span className="text-ink-mute">Émission : </span>
                  {formatDateLong(quote.issued_at)}
                </li>
              ) : null}
              {quote.sent_at ? (
                <li>
                  <span className="text-ink-mute">Envoi : </span>
                  {formatDateLong(quote.sent_at)}
                </li>
              ) : null}
              {quote.expires_at ? (
                <li>
                  <span className="text-ink-mute">Expiration : </span>
                  {formatDateLong(quote.expires_at)}
                </li>
              ) : null}
              {quote.accepted_at ? (
                <li>
                  <span className="text-ink-mute">Acceptation : </span>
                  {formatDateLong(quote.accepted_at)}
                </li>
              ) : null}
            </ul>
          </Card>

          {pdfSignedUrl ? (
            <Card variant="opaque" padding="default">
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute mb-2">
                PDF
              </p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={pdfSignedUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="size-4" />
                  Télécharger le PDF
                </Link>
              </Button>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
