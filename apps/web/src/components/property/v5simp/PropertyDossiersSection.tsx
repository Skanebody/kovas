import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatPriceEUR } from '@kovas/shared'
import { ExternalLink, FolderOpen } from 'lucide-react'
import Link from 'next/link'

const DOSSIER_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  scheduled: 'Planifié',
  on_site: 'Sur place',
  back_office: 'Au bureau',
  done: 'Terminé',
  exported: 'Exporté',
  archived: 'Archivé',
  cancelled: 'Annulé',
}

const DOSSIER_STATUS_VARIANT: Record<string, 'muted' | 'blue' | 'green' | 'orange' | 'red'> = {
  draft: 'muted',
  scheduled: 'blue',
  on_site: 'orange',
  back_office: 'orange',
  done: 'green',
  exported: 'green',
  archived: 'muted',
  cancelled: 'red',
}

const TYPE_LABELS: Record<string, string> = {
  dpe_vente: 'DPE vente',
  dpe_location: 'DPE location',
  copropriete: 'DPE copropriété',
  amiante_vente: 'Amiante',
  amiante_avant_travaux: 'Amiante AT',
  plomb_crep: 'Plomb',
  gaz: 'Gaz',
  electricite: 'Électricité',
  termites: 'Termites',
  carrez_boutin: 'Carrez',
  erp: 'ERP',
}

export interface PropertyDossierItem {
  id: string
  reference: string
  status: string
  date_iso: string
  primary_mission_type: string | null
  /** Classe énergétique DPE dérivée — affichée serif italic inline si type DPE */
  dpe_letter: string | null
  total_cents: number | null
}

interface Props {
  dossiers: PropertyDossierItem[]
  /** Nombre de DPE existants sur ce bien dans la base ADEME publique (V1 mock) */
  ademeDpeCount: number
}

const dateFr = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return dateFr.format(d)
}

/**
 * Section 3 — Dossiers réalisés (page property SIMP-2).
 *
 *  - Si ADEME DPE count ≥1 : badge link au-dessus de la timeline
 *  - Timeline verticale chronologique (date / type + classe DPE serif / status / montant)
 */
export function PropertyDossiersSection({ dossiers, ademeDpeCount }: Props) {
  return (
    <section aria-labelledby="property-dossiers-title" className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h2
          id="property-dossiers-title"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute"
        >
          Dossiers réalisés
        </h2>
        <span className="font-mono text-[11px] text-ink-mute">{dossiers.length}</span>
      </header>

      {ademeDpeCount > 0 ? (
        <a
          href="https://observatoire-dpe-audit.ademe.fr/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-pill border border-rule/60 bg-paper px-3 py-1.5 text-[11px] text-ink hover:bg-foreground/5"
        >
          <span className="font-mono uppercase tracking-[0.08em]">
            {ademeDpeCount} DPE existants dans la base ADEME
          </span>
          <ExternalLink className="size-3.5" strokeWidth={1.5} />
        </a>
      ) : null}

      {dossiers.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Aucun dossier sur ce bien."
          description="Créez un dossier sur ce bien pour le voir apparaître ici."
        />
      ) : (
        <ol className="space-y-0">
          {dossiers.map((d, idx) => {
            const isLast = idx === dossiers.length - 1
            const typeLabel = d.primary_mission_type
              ? (TYPE_LABELS[d.primary_mission_type] ?? d.primary_mission_type)
              : 'Dossier'
            const variant = DOSSIER_STATUS_VARIANT[d.status] ?? 'muted'
            const statusLabel = DOSSIER_STATUS_LABELS[d.status] ?? d.status
            const isDpe = d.primary_mission_type?.startsWith('dpe_') ?? false

            return (
              <li key={d.id} className="relative pl-6">
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
                <Link
                  href={`/dashboard/dossiers/${d.id}`}
                  className="flex items-center gap-3 py-3 px-3 -mx-3 rounded-lg hover:bg-foreground/5 focus-visible:outline-none focus-visible:bg-foreground/5 transition-colors"
                >
                  <span className="font-mono text-[11px] text-ink-mute w-[96px] shrink-0">
                    {formatDate(d.date_iso)}
                  </span>
                  <div className="flex-1 min-w-0 flex items-baseline gap-2">
                    <span className="text-[13px] font-medium text-ink truncate">{typeLabel}</span>
                    {isDpe && d.dpe_letter ? (
                      <span className="font-serif italic text-[24px] leading-none text-ink">
                        {d.dpe_letter}
                      </span>
                    ) : null}
                  </div>
                  <Badge variant={variant} className="shrink-0">
                    {statusLabel}
                  </Badge>
                  <span className="font-mono text-[12px] text-ink shrink-0 w-[96px] text-right">
                    {d.total_cents !== null ? formatPriceEUR(d.total_cents) : '—'}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute shrink-0">
                    Ouvrir →
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
