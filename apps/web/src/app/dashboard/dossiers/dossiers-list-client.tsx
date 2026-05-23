'use client'

import { DiagChip } from '@/components/ui/diag-chip'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import type { MissionType } from '@kovas/shared'
import { ChevronRight, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

export interface DossierListItem {
  id: string
  reference: string
  status: string
  scheduledAt: string | null
  createdAt: string
  property: {
    address: string | null
    city: string | null
    postalCode: string | null
  } | null
  client: {
    displayName: string | null
  } | null
  missionTypes: MissionType[]
}

type TabKey = 'all' | 'in_progress' | 'todo' | 'done'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'todo', label: 'À traiter' },
  { key: 'done', label: 'Terminées' },
]

const TAB_STATUS_MATCH: Record<TabKey, (status: string) => boolean> = {
  all: () => true,
  in_progress: (s) => s === 'on_site' || s === 'back_office',
  todo: (s) => s === 'draft' || s === 'scheduled',
  done: (s) => s === 'done' || s === 'archived',
}

const DOSSIER_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  scheduled: 'Planifié',
  on_site: 'Sur place',
  back_office: 'Au bureau',
  done: 'Terminé',
  archived: 'Archivé',
  cancelled: 'Annulé',
}

const MONTH_SHORT_FR = [
  'jan',
  'fév',
  'mar',
  'avr',
  'mai',
  'juin',
  'juil',
  'août',
  'sep',
  'oct',
  'nov',
  'déc',
]

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const day = d.getDate()
  const month = MONTH_SHORT_FR[d.getMonth()] ?? ''
  return `${day} ${month}`
}

/**
 * Affiche l'heure HH:mm si elle est significative (pas minuit, indicateur
 * d'horaire réellement planifié). Retourne null sinon.
 */
function formatTime(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  // Heure rendue en Europe/Paris (UI strings FR).
  const hhmm = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
  // Si l'horaire est 00:00, considérer qu'il n'y a pas d'heure planifiée
  // significative (date-only stockée).
  if (hhmm === '00:00') return null
  return hhmm
}

function buildClientLine(item: DossierListItem): string {
  return item.client?.displayName?.trim() || 'Client à définir'
}

function buildAddressLine(item: DossierListItem): string {
  const parts: string[] = []
  if (item.property?.address) parts.push(item.property.address)
  if (item.property?.city) parts.push(item.property.city)
  return parts.join(' · ') || 'Adresse à compléter'
}

interface DossiersListClientProps {
  dossiers: DossierListItem[]
  initialTab: TabKey
}

/**
 * Liste verticale unique des dossiers avec 4 tabs filtres au-dessus.
 * Refonte 2026-05 : remplace tableau dense par lignes 72px épurées.
 * - Tabs horizontaux scrollables sur mobile
 * - Active tab underline chartreuse 2px
 * - Tri scheduled_at desc puis created_at desc
 * - Lien deep via URL hash `#status=in_progress`
 */
export function DossiersListClient({ dossiers, initialTab }: DossiersListClientProps) {
  const [active, setActive] = useState<TabKey>(initialTab)

  const counts = useMemo(() => {
    const out: Record<TabKey, number> = { all: 0, in_progress: 0, todo: 0, done: 0 }
    for (const d of dossiers) {
      out.all += 1
      if (TAB_STATUS_MATCH.in_progress(d.status)) out.in_progress += 1
      if (TAB_STATUS_MATCH.todo(d.status)) out.todo += 1
      if (TAB_STATUS_MATCH.done(d.status)) out.done += 1
    }
    return out
  }, [dossiers])

  const filtered = useMemo(() => {
    return dossiers.filter((d) => TAB_STATUS_MATCH[active](d.status))
  }, [dossiers, active])

  function selectTab(key: TabKey) {
    setActive(key)
    if (typeof window === 'undefined') return
    if (key === 'all') {
      // Nettoie le hash si on revient sur "Toutes"
      const url = new URL(window.location.href)
      url.hash = ''
      window.history.replaceState(null, '', url.toString())
    } else {
      window.history.replaceState(null, '', `#status=${key}`)
    }
  }

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Filtrer les dossiers par statut"
        className="flex items-center gap-1 overflow-x-auto -mx-2 px-2 scrollbar-none border-b border-rule/40"
      >
        {TABS.map((tab) => {
          const isActive = tab.key === active
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="dossiers-list-panel"
              onClick={() => selectTab(tab.key)}
              className={cn(
                'relative whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors duration-fast',
                'border-b-2 -mb-px',
                isActive
                  ? 'text-ink border-chartreuse'
                  : 'text-ink-mute border-transparent hover:text-ink',
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'ml-1.5 font-mono text-[11px] tabular-nums',
                  isActive ? 'text-ink-mute' : 'text-ink-mute/70',
                )}
              >
                {counts[tab.key]}
              </span>
            </button>
          )
        })}
      </div>

      <div
        id="dossiers-list-panel"
        role="tabpanel"
        aria-labelledby={`tab-${active}`}
        className="min-h-[200px]"
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={
              active === 'all'
                ? 'Aucun dossier pour le moment.'
                : 'Aucun dossier dans cette section.'
            }
            description={
              active === 'all'
                ? 'Créez votre premier dossier pour regrouper les diagnostics d\'une même visite.'
                : 'Sélectionnez un autre filtre ou créez un nouveau dossier.'
            }
          />
        ) : (
          <ul className="divide-y divide-rule/30">
            {filtered.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/dashboard/dossiers/${d.id}`}
                  className="group flex items-center gap-4 py-4 px-2 -mx-2 rounded-lg hover:bg-ink/5 transition-colors duration-fast min-h-[72px]"
                >
                  <span className="font-mono text-[12px] uppercase tracking-[0.05em] text-ink-mute w-[80px] shrink-0 tabular-nums flex flex-col leading-tight">
                    <span>{formatDate(d.scheduledAt ?? d.createdAt)}</span>
                    {(() => {
                      const t = formatTime(d.scheduledAt)
                      return t ? (
                        <span className="text-[11px] text-ink font-medium normal-case tracking-normal">
                          {t}
                        </span>
                      ) : null
                    })()}
                  </span>

                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="text-[15px] font-medium text-ink truncate">
                      {buildClientLine(d)}
                    </span>
                    <span className="text-[13px] text-ink-mute truncate">
                      {buildAddressLine(d)}
                    </span>
                  </div>

                  <div className="hidden sm:flex flex-wrap items-center gap-1 max-w-[200px] justify-end shrink-0">
                    {d.missionTypes.slice(0, 3).map((type, i) => (
                      <DiagChip key={`${d.id}-${type}-${i}`} type={type} />
                    ))}
                    {d.missionTypes.length > 3 ? (
                      <span className="font-mono text-[10px] text-ink-mute">
                        +{d.missionTypes.length - 3}
                      </span>
                    ) : null}
                  </div>

                  <span className="hidden md:inline-flex font-mono text-[11px] uppercase tracking-[0.05em] text-ink-mute shrink-0 w-[80px] text-right">
                    {DOSSIER_STATUS_LABELS[d.status] ?? d.status}
                  </span>

                  <ChevronRight
                    aria-hidden
                    className="size-4 text-ink-mute/60 shrink-0 group-hover:text-ink-mute transition-colors"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export type { TabKey }
