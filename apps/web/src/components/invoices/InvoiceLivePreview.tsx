import type {
  InvoiceClientSnapshot,
  InvoiceIssuerSnapshot,
  InvoiceLineItem,
} from '@/lib/invoices/types'
import { cn } from '@/lib/utils'

export interface InvoiceLivePreviewProps {
  reference: string
  kind: 'invoice' | 'credit_note'
  issuedAt: string | null
  dueDate: string | null
  paymentTermsDays: number
  lineItems: InvoiceLineItem[]
  amountHt: number
  amountTva: number
  amountTtc: number
  tvaRate: number
  notes: string | null
  issuer: InvoiceIssuerSnapshot
  client: InvoiceClientSnapshot
  className?: string
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

/**
 * Aperçu live HTML d'une facture en cours de création / édition.
 * Pas d'interaction — purement visuel, mis à jour à chaque changement
 * de form côté wizard. Format proche du PDF final pour rassurer l'utilisateur.
 *
 * DS v5 : carte paper-on-sage, typographie sobre, pas d'animation.
 */
export function InvoiceLivePreview(props: InvoiceLivePreviewProps) {
  const isCreditNote = props.kind === 'credit_note'
  const title = isCreditNote ? 'AVOIR' : 'FACTURE'

  return (
    <div
      className={cn(
        'bg-paper rounded-[16px] border border-[#0F1419]/[0.08] p-6 text-[12px] text-ink shadow-sm',
        props.className,
      )}
      aria-label="Aperçu de la facture"
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="font-semibold text-[14px] text-ink">{props.issuer.name}</p>
          <p className="text-[11px] text-ink-mute">{props.issuer.address ?? ''}</p>
          <p className="text-[11px] text-ink-mute">
            {[props.issuer.postal_code, props.issuer.city].filter(Boolean).join(' ')}
          </p>
          {props.issuer.siret ? (
            <p className="text-[11px] text-ink-mute">SIRET : {props.issuer.siret}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p
            className="font-serif italic text-[22px] leading-none text-ink"
            style={{ color: props.issuer.brand_color_hex ?? undefined }}
          >
            {title}
          </p>
          <p className="font-mono text-[11px] text-ink-mute mt-1">N° {props.reference}</p>
          <p className="text-[11px] text-ink-mute mt-0.5">
            Émise le {formatDateFr(props.issuedAt)}
          </p>
          {!isCreditNote && props.dueDate ? (
            <p className="text-[11px] text-ink-mute">Échéance : {formatDateFr(props.dueDate)}</p>
          ) : null}
        </div>
      </div>

      <hr className="border-rule mb-4" />

      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-wide font-mono text-ink-mute mb-1">
          Facturé à
        </p>
        <p className="text-[13px] font-semibold text-ink">{props.client.display_name}</p>
        {props.client.address ? (
          <p className="text-[11px] text-ink-mute">{props.client.address}</p>
        ) : null}
        <p className="text-[11px] text-ink-mute">
          {[props.client.postal_code, props.client.city].filter(Boolean).join(' ')}
        </p>
      </div>

      {/* Lignes prestations */}
      <table className="w-full text-[11px] mb-4">
        <thead>
          <tr className="border-b border-rule">
            <th className="text-left py-2 font-medium text-ink-mute">Désignation</th>
            <th className="text-center py-2 font-medium text-ink-mute w-12">Qté</th>
            <th className="text-right py-2 font-medium text-ink-mute w-20">P.U. HT</th>
            <th className="text-right py-2 font-medium text-ink-mute w-24">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {props.lineItems.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-4 text-center text-ink-faint italic">
                Aucune prestation ajoutée
              </td>
            </tr>
          ) : (
            props.lineItems.map((item, idx) => {
              const lineHt = item.quantity * item.unit_price_ht
              const sign = isCreditNote ? -1 : 1
              return (
                <tr key={idx} className="border-b border-rule/60 align-top">
                  <td className="py-2 text-ink">{item.label || '—'}</td>
                  <td className="py-2 text-center text-ink-mute">{item.quantity}</td>
                  <td className="py-2 text-right tabular-nums text-ink-mute">
                    {formatEur(item.unit_price_ht * sign)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink">
                    {formatEur(lineHt * sign)}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="w-56 space-y-1.5">
          <div className="flex justify-between text-[12px] text-ink-mute">
            <span>Total HT</span>
            <span className="tabular-nums text-ink">
              {formatEur(props.amountHt * (isCreditNote ? -1 : 1))}
            </span>
          </div>
          <div className="flex justify-between text-[12px] text-ink-mute">
            <span>TVA ({props.tvaRate}%)</span>
            <span className="tabular-nums text-ink">
              {formatEur(props.amountTva * (isCreditNote ? -1 : 1))}
            </span>
          </div>
          <hr className="border-ink" />
          <div className="flex justify-between text-[14px] font-semibold text-ink">
            <span>Total TTC</span>
            <span className="tabular-nums">
              {formatEur(props.amountTtc * (isCreditNote ? -1 : 1))}
            </span>
          </div>
        </div>
      </div>

      {!isCreditNote && props.issuer.iban ? (
        <div className="mt-5 p-3 rounded-[10px] bg-cream-deep/40 text-[11px] text-ink-mute">
          <p className="font-medium text-ink mb-1">Virement bancaire</p>
          {props.issuer.bank_name ? <p>{props.issuer.bank_name}</p> : null}
          <p className="font-mono text-[10px]">IBAN : {props.issuer.iban}</p>
          {props.issuer.bic ? (
            <p className="font-mono text-[10px]">BIC : {props.issuer.bic}</p>
          ) : null}
          <p className="mt-1">Référence à indiquer : {props.reference}</p>
        </div>
      ) : null}

      {props.notes ? (
        <p className="mt-4 text-[11px] italic text-ink-mute whitespace-pre-line">{props.notes}</p>
      ) : null}
    </div>
  )
}
