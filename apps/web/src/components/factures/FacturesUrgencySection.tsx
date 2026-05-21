'use client'

/**
 * KOVAS — Section urgence pour la page Factures refondue.
 *
 * 3 sections empilées : "En retard" (priorité), "À échéance" (à venir),
 * "Payées" (compteur seul, pas la liste — focus action).
 *
 * - Ligne en retard : action [Relancer] chartreuse → ouvre RelancerSheet
 * - Ligne à échéance : pas d'action inline (juste click → détail)
 * - Section Payées : compteur seul + lien "Voir l'historique"
 */

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronRight, Receipt } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { RelancerSheet } from './RelancerSheet'

export type FactureUrgencyKind = 'overdue' | 'upcoming'

export interface FactureUrgencyRow {
  id: string
  reference: string
  /** Date courte FR « 23 mai » — issued_at pour overdue, due_date pour upcoming */
  dateShort: string
  clientName: string
  clientEmail?: string | null
  /** Montant restant dû en euros (float) — pour overdue : ttc - paid */
  amountDueEur: number
}

export interface FacturesUrgencySectionProps {
  kind: FactureUrgencyKind
  rows: readonly FactureUrgencyRow[]
}

const SECTION_META: Record<
  FactureUrgencyKind,
  { label: string; emptyHint: string }
> = {
  overdue: {
    label: 'En retard',
    emptyHint: 'Aucune facture en retard — votre encours est sain.',
  },
  upcoming: {
    label: 'À échéance',
    emptyHint: 'Aucune facture à venir sur les 7 prochains jours.',
  },
}

export function FacturesUrgencySection({ kind, rows }: FacturesUrgencySectionProps) {
  const meta = SECTION_META[kind]
  const count = rows.length

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute font-medium">
          {meta.label}
        </h2>
        <span
          className={cn(
            'font-mono text-[11px] tabular-nums px-2 py-0.5 rounded-full',
            count > 0
              ? kind === 'overdue'
                ? 'bg-danger/10 text-danger'
                : 'bg-ink/5 text-ink'
              : 'bg-transparent text-ink-faint',
          )}
          aria-label={`${count} factures dans cette section`}
        >
          {count}
        </span>
      </header>

      {count === 0 ? (
        <EmptyMicro hint={meta.emptyHint} />
      ) : (
        <ul className="rounded-xl bg-paper border border-rule/60 overflow-hidden">
          {rows.map((row, idx) => (
            <li key={row.id} className={cn(idx > 0 && 'border-t border-rule/40')}>
              <FactureRow row={row} kind={kind} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function FactureRow({
  row,
  kind,
}: {
  row: FactureUrgencyRow
  kind: FactureUrgencyKind
}) {
  const [relancerOpen, setRelancerOpen] = useState(false)

  return (
    <>
      <div className="group flex items-center gap-4 py-3 px-4 hover:bg-ink/[0.03] transition-colors">
        <Link
          href={`/dashboard/factures/${row.id}`}
          className="flex flex-1 min-w-0 items-center gap-4 text-left"
          aria-label={`Facture ${row.reference} pour ${row.clientName}`}
        >
          <span className="font-mono text-[12px] text-ink-mute tabular-nums w-[64px] shrink-0">
            {row.dateShort}
          </span>
          <span className="flex flex-col min-w-0 flex-1">
            <span className="text-[14px] font-medium text-ink truncate">
              {row.clientName}
            </span>
            <span className="font-mono text-[11px] text-ink-faint truncate">
              {row.reference}
            </span>
          </span>
          <span
            className={cn(
              'font-mono text-[13px] font-semibold tabular-nums whitespace-nowrap',
              kind === 'overdue' ? 'text-danger' : 'text-ink',
            )}
          >
            {row.amountDueEur.toLocaleString('fr-FR', {
              style: 'currency',
              currency: 'EUR',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </Link>

        {kind === 'overdue' ? (
          <Button
            type="button"
            size="sm"
            variant="accent"
            className="shrink-0"
            onClick={() => setRelancerOpen(true)}
            aria-label={`Relancer la facture ${row.reference}`}
          >
            Relancer
          </Button>
        ) : null}
        <ChevronRight
          aria-hidden
          className="size-4 text-ink-faint shrink-0 group-hover:text-ink-mute transition-colors"
        />
      </div>

      {kind === 'overdue' ? (
        <RelancerSheet
          open={relancerOpen}
          onOpenChange={setRelancerOpen}
          invoiceId={row.id}
          invoiceReference={row.reference}
          clientName={row.clientName}
          clientEmail={row.clientEmail ?? null}
          amountDueEur={row.amountDueEur}
        />
      ) : null}
    </>
  )
}

function EmptyMicro({ hint }: { hint: string }) {
  return (
    <div className="rounded-xl bg-paper border border-dashed border-rule/60 px-4 py-5 flex items-center gap-3">
      <Receipt aria-hidden className="size-4 text-ink-faint shrink-0" />
      <p className="text-[13px] text-ink-mute">{hint}</p>
    </div>
  )
}

/* ============================================================
   FacturesPaidSummary — section "Payées" compteur seul
   ============================================================ */

export interface FacturesPaidSummaryProps {
  paidCount: number
  totalCollectedEur: number
}

export function FacturesPaidSummary({
  paidCount,
  totalCollectedEur,
}: FacturesPaidSummaryProps) {
  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute font-medium">
          Payées
        </h2>
        <span className="font-mono text-[11px] tabular-nums px-2 py-0.5 rounded-full bg-success/10 text-success">
          {paidCount}
        </span>
      </header>

      <div className="rounded-xl bg-paper border border-rule/60 px-4 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] text-ink">
            {paidCount} {paidCount > 1 ? 'factures payées' : 'facture payée'}
          </p>
          <p className="font-mono text-[12px] text-ink-mute tabular-nums">
            {totalCollectedEur.toLocaleString('fr-FR', {
              style: 'currency',
              currency: 'EUR',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            encaissés
          </p>
        </div>
        <Link
          href="/dashboard/factures/history"
          className="text-[13px] font-medium text-ink underline-offset-4 hover:underline shrink-0"
          aria-label="Voir l'historique complet des factures payées"
        >
          Voir l&apos;historique
          <ChevronRight aria-hidden className="inline size-4 align-text-bottom" />
        </Link>
      </div>
    </section>
  )
}
