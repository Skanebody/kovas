'use client'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { EmptyState } from '@/components/ui/empty-state'
import { Activity, FileText, FolderOpen, Receipt } from 'lucide-react'
import { useState } from 'react'

export type HistoryEventKind = 'dossier_created' | 'dossier_status' | 'quote' | 'invoice'

export interface ClientHistoryEvent {
  id: string
  /** Date ISO trié desc */
  dateIso: string
  kind: HistoryEventKind
  /** Résumé d'une ligne */
  summary: string
  /** Détail multi-lignes affiché dans le BottomSheet */
  detail?: string
  /** Lien optionnel vers la ressource source */
  href?: string
}

interface Props {
  events: ClientHistoryEvent[]
}

const KIND_LABELS: Record<HistoryEventKind, string> = {
  dossier_created: 'Dossier créé',
  dossier_status: 'Changement de statut',
  quote: 'Devis',
  invoice: 'Facture',
}

const KIND_ICONS: Record<HistoryEventKind, React.ElementType> = {
  dossier_created: FolderOpen,
  dossier_status: Activity,
  quote: FileText,
  invoice: Receipt,
}

const dateFr = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const dateTimeFr = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return dateFr.format(d)
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return dateTimeFr.format(d)
}

/**
 * Section 4 — Historique (page client SIMP-2).
 * Timeline des N derniers événements (default 10). Click ligne → BottomSheet détail.
 */
export function ClientHistoriqueSection({ events }: Props) {
  const [activeEvent, setActiveEvent] = useState<ClientHistoryEvent | null>(null)

  return (
    <section aria-labelledby="client-history-title" className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h2
          id="client-history-title"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute"
        >
          Historique
        </h2>
        <span className="font-mono text-[11px] text-ink-mute">{events.length}</span>
      </header>

      {events.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Aucun événement enregistré."
          description="Les créations de dossier, devis et factures s'afficheront ici."
        />
      ) : (
        <ol className="space-y-0">
          {events.map((e, idx) => {
            const Icon = KIND_ICONS[e.kind]
            const isLast = idx === events.length - 1
            return (
              <li key={e.id} className="relative pl-6">
                {/* puce navy 8px */}
                <span
                  aria-hidden
                  className="absolute left-0 top-[18px] size-2 rounded-full bg-navy"
                />
                {!isLast ? (
                  <span
                    aria-hidden
                    className="absolute left-[3px] top-[28px] bottom-0 w-px bg-rule/40"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => setActiveEvent(e)}
                  className="w-full text-left flex items-start gap-3 py-3 px-3 -mx-3 rounded-lg hover:bg-foreground/5 focus-visible:outline-none focus-visible:bg-foreground/5 transition-colors"
                >
                  <span className="font-mono text-[11px] text-ink-mute w-[96px] shrink-0 pt-0.5">
                    {formatDate(e.dateIso)}
                  </span>
                  <Icon className="size-4 text-ink-mute shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span className="text-[13px] text-ink leading-snug truncate">{e.summary}</span>
                </button>
              </li>
            )
          })}
        </ol>
      )}

      <BottomSheet
        open={activeEvent !== null}
        onOpenChange={(open) => {
          if (!open) setActiveEvent(null)
        }}
        title={activeEvent ? KIND_LABELS[activeEvent.kind] : undefined}
        description={activeEvent ? formatDateTime(activeEvent.dateIso) : undefined}
      >
        <div className="space-y-3 px-2 pb-4">
          <p className="text-sm text-ink">{activeEvent?.summary}</p>
          {activeEvent?.detail ? (
            <p className="text-sm text-ink-mute whitespace-pre-wrap">{activeEvent.detail}</p>
          ) : null}
          {activeEvent?.href ? (
            <a
              href={activeEvent.href}
              className="inline-block font-mono text-[11px] uppercase tracking-[0.1em] text-ink hover:underline"
            >
              Ouvrir la ressource →
            </a>
          ) : null}
        </div>
      </BottomSheet>
    </section>
  )
}
