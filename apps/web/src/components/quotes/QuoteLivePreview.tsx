'use client'

/**
 * KOVAS — Aperçu live d'un devis (HTML/CSS — miroir du PDF jsPDF).
 *
 * Le rendu reste cohérent avec `generate-pdf.ts` :
 *   - Header logo + cartouche
 *   - Filet horizontal couleur brand
 *   - 2 colonnes émetteur/destinataire
 *   - Tableau prestations
 *   - Totaux à droite avec total TTC mis en valeur
 *
 * Volontairement statique (pas de scroll, pas de pagination) — c'est un
 * mini aperçu, l'utilisateur télécharge le PDF pour le rendu final.
 */

import {
  QUOTE_PAYMENT_METHOD_LABELS,
  type QuoteClientSnapshot,
  type QuoteLineItem,
  type QuoteOrganizationSnapshot,
  type QuotePaymentMethod,
  computeQuoteTotals,
  formatDateLong,
  formatEur,
} from '@/lib/quotes/types'
import { cn } from '@/lib/utils'

export interface QuoteLivePreviewProps {
  reference: string
  issuedAt: string
  expiresAt: string
  organization: QuoteOrganizationSnapshot
  client: QuoteClientSnapshot
  lines: QuoteLineItem[]
  notes?: string | null
  paymentMethod: QuotePaymentMethod
  paymentTermsDays: number
  brandColorHex: string
  logoUrl?: string | null
  className?: string
}

export function QuoteLivePreview({
  reference,
  issuedAt,
  expiresAt,
  organization,
  client,
  lines,
  notes,
  paymentMethod,
  paymentTermsDays,
  brandColorHex,
  logoUrl,
  className,
}: QuoteLivePreviewProps) {
  const totals = computeQuoteTotals(lines)

  return (
    <div
      className={cn(
        'bg-white text-[#0F1419] rounded-lg shadow-glass-sm border border-rule/60',
        'p-6 text-[11px] font-sans',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4">
        <div className="min-w-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={organization.name}
              className="max-h-12 max-w-[160px] object-contain"
            />
          ) : (
            <p className="font-bold text-[14px] truncate">{organization.name}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-[18px] leading-none tracking-tight">DEVIS</p>
          <p className="font-mono text-[10px] text-[#4A5878] mt-1">{reference}</p>
          <p className="text-[10px] text-[#4A5878]">Émis le {formatDateLong(issuedAt)}</p>
          <p className="text-[10px] text-[#4A5878]">
            Valable jusqu&apos;au {formatDateLong(expiresAt)}
          </p>
        </div>
      </div>

      {/* Filet brand */}
      <div className="h-[2px] mb-4" style={{ backgroundColor: brandColorHex }} />

      {/* Parties */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <PartyBlock title="Émetteur">
          <p className="font-bold text-[12px]">{organization.name}</p>
          {organization.address ? <p>{organization.address}</p> : null}
          <p>{[organization.postalCode, organization.city].filter(Boolean).join(' ') || '—'}</p>
          {organization.siret ? <p className="text-[#4A5878]">SIRET {organization.siret}</p> : null}
          {organization.vatNumber ? (
            <p className="text-[#4A5878]">TVA {organization.vatNumber}</p>
          ) : null}
        </PartyBlock>
        <PartyBlock title="Destinataire">
          <p className="font-bold text-[12px]">{client.displayName}</p>
          {client.companyName && client.companyName !== client.displayName ? (
            <p>{client.companyName}</p>
          ) : null}
          {client.address ? <p>{client.address}</p> : null}
          <p>{[client.postalCode, client.city].filter(Boolean).join(' ') || '—'}</p>
          {client.email ? <p className="text-[#4A5878]">{client.email}</p> : null}
          {client.phone ? <p className="text-[#4A5878]">{client.phone}</p> : null}
        </PartyBlock>
      </div>

      {/* Tableau prestations */}
      <table className="w-full text-[10px] border-collapse mb-4">
        <thead>
          <tr className="bg-[#F5F7F4] text-[9px] uppercase tracking-wide text-[#4A5878]">
            <th className="text-left py-1.5 px-2 font-semibold">Désignation</th>
            <th className="text-right py-1.5 px-2 font-semibold w-[40px]">Qté</th>
            <th className="text-right py-1.5 px-2 font-semibold w-[70px]">PU HT</th>
            <th className="text-right py-1.5 px-2 font-semibold w-[70px]">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-4 text-center text-[#7E8AA4] italic">
                Aucune prestation
              </td>
            </tr>
          ) : (
            lines.map((line) => (
              <tr key={line.id} className="border-b border-[#E5DECB]">
                <td className="py-1.5 px-2">{line.designation}</td>
                <td className="py-1.5 px-2 text-right">{line.quantity}</td>
                <td className="py-1.5 px-2 text-right font-mono">{formatEur(line.unitPriceHt)}</td>
                <td className="py-1.5 px-2 text-right font-mono">
                  {formatEur(line.quantity * line.unitPriceHt)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Totaux */}
      <div className="flex justify-end mb-4">
        <div className="w-[200px] space-y-1 text-[10px]">
          <div className="flex justify-between text-[#4A5878]">
            <span>Sous-total HT</span>
            <span className="font-mono">{formatEur(totals.subtotalHt)}</span>
          </div>
          <div className="flex justify-between text-[#4A5878]">
            <span>TVA</span>
            <span className="font-mono">{formatEur(totals.totalTva)}</span>
          </div>
          <div
            className="flex justify-between mt-1.5 py-1.5 px-2 rounded text-white font-bold"
            style={{ backgroundColor: brandColorHex }}
          >
            <span>Total TTC</span>
            <span className="font-mono">{formatEur(totals.totalTtc)}</span>
          </div>
        </div>
      </div>

      {/* Conditions */}
      <p className="text-[9px] text-[#4A5878] mb-1">
        Conditions de paiement : {QUOTE_PAYMENT_METHOD_LABELS[paymentMethod]} à {paymentTermsDays}{' '}
        jours.
      </p>
      {notes && notes.trim().length > 0 ? (
        <p className="text-[9px] text-[#4A5878] whitespace-pre-wrap mb-1">{notes}</p>
      ) : null}
      <div className="border-t border-[#E5DECB] mt-3 pt-2 text-[8px] text-[#7E8AA4] leading-snug">
        Diagnostics immobiliers — Art. L271-4 et suivants du Code de la construction et de
        l&apos;habitation.
        {organization.siret ? <> · SIRET {organization.siret}</> : null}
        {organization.certificationN ? <> · Cert. {organization.certificationN}</> : null}
      </div>
    </div>
  )
}

function PartyBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="font-mono text-[8px] uppercase tracking-wider text-[#4A5878] mb-1">{title}</p>
      {children}
    </div>
  )
}
