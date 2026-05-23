import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatPriceEUR } from '@kovas/shared'
import { FolderOpen } from 'lucide-react'
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

export interface ClientDossier {
  id: string
  reference: string
  scheduled_at: string | null
  created_at: string
  status: string
  property_address: string | null
  property_city: string | null
  /** Montant total en centimes (somme devis acceptés / factures dossier — null si non calculé V1) */
  total_cents: number | null
  /** Type principal (premier mission attaché) — utilisé pour l'étiquette de la ligne */
  primary_mission_type: string | null
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

const dateFr = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function pickDateIso(d: ClientDossier): string {
  return d.scheduled_at ?? d.created_at
}

function formatDateShort(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return dateFr.format(date)
}

/**
 * Heure HH:mm Europe/Paris si scheduled_at significatif (≠ 00:00), sinon null.
 * Format SOBRE JetBrains Mono côté UI : ne s'affiche que pour les RDV avec heure réelle.
 */
function formatTimeHHmm(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const hhmm = date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
  return hhmm === '00:00' ? null : hhmm
}

interface Props {
  dossiers: ClientDossier[]
}

/**
 * Section 3 — Dossiers (page client SIMP-2).
 * Liste verticale sobre, click ligne → détail dossier.
 */
export function ClientDossiersSection({ dossiers }: Props) {
  return (
    <section aria-labelledby="client-dossiers-title" className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h2
          id="client-dossiers-title"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute"
        >
          Dossiers
        </h2>
        <span className="font-mono text-[11px] text-ink-mute">{dossiers.length}</span>
      </header>

      {dossiers.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Aucun dossier pour ce client."
          description="Démarrez un dossier sur un bien rattaché pour le voir apparaître ici."
        />
      ) : (
        <ul className="overflow-hidden rounded-xl border border-rule/40 bg-paper">
          {dossiers.map((d, idx) => {
            const type = d.primary_mission_type
            const typeLabel = type ? (TYPE_LABELS[type] ?? type) : 'Dossier'
            const status = d.status
            const variant = DOSSIER_STATUS_VARIANT[status] ?? 'muted'
            const statusLabel = DOSSIER_STATUS_LABELS[status] ?? status
            const dateIso = pickDateIso(d)
            const isLast = idx === dossiers.length - 1
            const address = d.property_address
            const city = [d.property_city].filter(Boolean).join(' ')
            return (
              <li key={d.id}>
                <Link
                  href={`/dashboard/dossiers/${d.id}`}
                  className={`flex items-center gap-4 py-3 px-4 ${
                    isLast ? '' : 'border-b border-rule/30'
                  } hover:bg-foreground/5 transition-colors focus-visible:outline-none focus-visible:bg-foreground/5`}
                >
                  <span className="font-mono text-[11px] text-ink-mute w-[96px] shrink-0 flex flex-col leading-tight tabular-nums">
                    <span>{formatDateShort(dateIso)}</span>
                    {(() => {
                      const t = formatTimeHHmm(d.scheduled_at)
                      return t ? <span className="text-ink font-medium">{t}</span> : null
                    })()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-ink truncate">{typeLabel}</p>
                    {address ? (
                      <p className="text-[11px] text-ink-mute truncate">
                        {address}
                        {city ? ` · ${city}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant={variant} className="shrink-0">
                    {statusLabel}
                  </Badge>
                  <span className="font-mono text-[12px] text-ink shrink-0 w-[96px] text-right">
                    {d.total_cents !== null ? formatPriceEUR(d.total_cents) : '—'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
