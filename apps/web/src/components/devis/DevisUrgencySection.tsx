/**
 * KOVAS — Section urgence pour la page Devis refondue.
 *
 * Affiche une catégorie urgence (À envoyer / En attente signature / Refusés
 * ou expirés) sous forme de liste verticale compacte, pas de tableau.
 * Chaque devis est une ligne `<Link>` avec date mono · client · montant ·
 * action contextuelle · chevron.
 *
 * Cohérent V5 sage / chartreuse / navy. Ton sobre, vouvoiement.
 */

import { Button } from '@/components/ui/button'
import { formatEur } from '@/lib/quotes/types'
import { cn } from '@/lib/utils'
import { ChevronRight, FileText } from 'lucide-react'
import Link from 'next/link'

export type DevisUrgencyKind = 'to_send' | 'pending_signature' | 'refused_expired'

export interface DevisUrgencyRow {
  id: string
  /** Date courte FR « 23 mai » */
  dateShort: string
  /** Nom client + ville optionnelle */
  clientName: string
  clientCity?: string | null
  /** Montant TTC en euros (float) */
  amountTtcEur: number
  /** Référence DEV-YYYY-NNNN (affichage secondaire) */
  reference: string
}

export interface DevisUrgencySectionProps {
  kind: DevisUrgencyKind
  rows: readonly DevisUrgencyRow[]
}

const SECTION_META: Record<
  DevisUrgencyKind,
  { label: string; emptyHint: string; actionLabel: string; actionVariant: 'accent' | 'ghost' }
> = {
  to_send: {
    label: 'À envoyer',
    emptyHint: 'Aucun devis dans ce statut',
    actionLabel: 'Envoyer',
    actionVariant: 'accent',
  },
  pending_signature: {
    label: 'En attente de signature',
    emptyHint: 'Aucun devis envoyé sans réponse',
    actionLabel: 'Relancer',
    actionVariant: 'accent',
  },
  refused_expired: {
    label: 'Refusés ou expirés',
    emptyHint: 'Aucun devis à archiver',
    actionLabel: 'Archiver',
    actionVariant: 'ghost',
  },
}

export function DevisUrgencySection({ kind, rows }: DevisUrgencySectionProps) {
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
            count > 0 ? 'bg-ink/5 text-ink' : 'bg-transparent text-ink-faint',
          )}
          aria-label={`${count} devis dans cette section`}
        >
          {count}
        </span>
      </header>

      {count === 0 ? (
        <EmptyMicro hint={meta.emptyHint} />
      ) : (
        <ul className="rounded-xl bg-paper border border-rule/60 overflow-hidden">
          {rows.map((row, idx) => (
            <li
              key={row.id}
              className={cn(
                idx > 0 && 'border-t border-rule/40',
              )}
            >
              <DevisRow row={row} action={meta} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DevisRow({
  row,
  action,
}: {
  row: DevisUrgencyRow
  action: { actionLabel: string; actionVariant: 'accent' | 'ghost' }
}) {
  return (
    <div className="group flex items-center gap-4 py-3 px-4 hover:bg-ink/[0.03] transition-colors">
      <Link
        href={`/dashboard/devis/${row.id}`}
        className="flex flex-1 min-w-0 items-center gap-4 text-left"
        aria-label={`Devis ${row.reference} pour ${row.clientName}`}
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
            {row.clientCity ? ` · ${row.clientCity}` : ''}
          </span>
        </span>
        <span className="font-mono text-[13px] font-semibold text-ink tabular-nums whitespace-nowrap">
          {formatEur(row.amountTtcEur)}
        </span>
      </Link>

      <Button
        asChild
        size="sm"
        variant={action.actionVariant}
        className="shrink-0"
      >
        <Link
          href={`/dashboard/devis/${row.id}`}
          aria-label={`${action.actionLabel} le devis ${row.reference}`}
        >
          {action.actionLabel}
        </Link>
      </Button>
      <ChevronRight
        aria-hidden
        className="size-4 text-ink-faint shrink-0 group-hover:text-ink-mute transition-colors"
      />
    </div>
  )
}

function EmptyMicro({ hint }: { hint: string }) {
  return (
    <div className="rounded-xl bg-paper border border-dashed border-rule/60 px-4 py-5 flex items-center gap-3">
      <FileText aria-hidden className="size-4 text-ink-faint shrink-0" />
      <p className="text-[13px] text-ink-mute">{hint}</p>
    </div>
  )
}
