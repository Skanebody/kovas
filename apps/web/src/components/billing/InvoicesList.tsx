'use client'

import {
  AppListTable,
  AppListTableCell,
  AppListTableHead,
  AppListTableRow,
} from '@/components/ui/app-list-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { InvoiceSummary } from '@/lib/stripe/invoices'
import { ChevronLeft, ChevronRight, Download, ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'

interface InvoicesListProps {
  invoices: InvoiceSummary[]
}

type StatusVariant = 'green' | 'amber' | 'red' | 'muted' | 'blue'

const STATUS_LABEL: Record<string, string> = {
  paid: 'Payée',
  open: 'En attente',
  draft: 'Brouillon',
  uncollectible: 'Échec',
  void: 'Annulée',
}

const STATUS_VARIANT: Record<string, StatusVariant> = {
  paid: 'green',
  open: 'amber',
  draft: 'muted',
  uncollectible: 'red',
  void: 'muted',
}

const PAGE_SIZE = 25

function formatDate(unixSec: number): string {
  if (!unixSec) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(unixSec * 1000))
}

function formatPeriod(start: number, end: number): string {
  if (!start || !end) return '—'
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  return `${fmt.format(new Date(start * 1000))} → ${fmt.format(new Date(end * 1000))}`
}

function formatAmount(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amountCents / 100)
}

/**
 * InvoicesList — tableau client des factures Stripe d'une org.
 *
 * Tri par date d'émission décroissante (déjà côté serveur, on re-trie défensivement).
 * Pagination 25 lignes/page. Actions : téléchargement PDF + vue hosted Stripe.
 */
export function InvoicesList({ invoices }: InvoicesListProps) {
  const sorted = useMemo(() => [...invoices].sort((a, b) => b.created - a.created), [invoices])

  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageItems = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-3">
      <AppListTable>
        <AppListTableHead>
          <tr>
            <th className="text-left font-medium px-4 py-3">Date</th>
            <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Numéro</th>
            <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Période</th>
            <th className="text-left font-medium px-4 py-3">Statut</th>
            <th className="text-right font-medium px-4 py-3">Montant TTC</th>
            <th className="text-right font-medium px-4 py-3">Actions</th>
          </tr>
        </AppListTableHead>
        <tbody>
          {pageItems.map((inv) => {
            const status = inv.status ?? 'draft'
            const label = STATUS_LABEL[status] ?? status
            const variant = STATUS_VARIANT[status] ?? 'muted'
            // amount_paid si payée, sinon amount_due (montant attendu)
            const amount = inv.status === 'paid' ? inv.amount_paid : inv.amount_due

            return (
              <AppListTableRow key={inv.id}>
                <AppListTableCell className="whitespace-nowrap text-ink">
                  {formatDate(inv.created)}
                </AppListTableCell>
                <AppListTableCell className="hidden sm:table-cell font-mono text-[12px] text-ink-mute">
                  {inv.number ?? '—'}
                </AppListTableCell>
                <AppListTableCell className="hidden md:table-cell text-ink-mute">
                  {formatPeriod(inv.period_start, inv.period_end)}
                </AppListTableCell>
                <AppListTableCell>
                  <Badge variant={variant}>{label}</Badge>
                </AppListTableCell>
                <AppListTableCell className="text-right tabular-nums font-medium text-ink">
                  {formatAmount(amount, inv.currency)}
                </AppListTableCell>
                <AppListTableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {inv.invoice_pdf ? (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={inv.invoice_pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Télécharger la facture ${inv.number ?? inv.id} en PDF`}
                        >
                          <Download className="size-3.5" />
                          <span className="hidden sm:inline">PDF</span>
                        </a>
                      </Button>
                    ) : null}
                    {inv.hosted_invoice_url ? (
                      <Button asChild size="sm" variant="ghost">
                        <a
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Voir la facture ${inv.number ?? inv.id} en ligne`}
                        >
                          <ExternalLink className="size-3.5" />
                          <span className="hidden md:inline">Voir</span>
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </AppListTableCell>
              </AppListTableRow>
            )
          })}
        </tbody>
      </AppListTable>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-4 px-1">
          <p className="text-[12px] text-ink-mute">
            Page {page + 1} / {totalPages} · {sorted.length} facture
            {sorted.length > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="size-3.5" />
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Suivant
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
