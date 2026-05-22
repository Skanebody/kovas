import { FolderOpen, Plus } from 'lucide-react'
import Link from 'next/link'
import {
  AppListTable,
  AppListTableCell,
  AppListTableHead,
  AppListTableRow,
} from '@/components/ui/app-list-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DiagChip } from '@/components/ui/diag-chip'
import { createClient } from '@/lib/supabase/server'
import type { MissionType } from '@kovas/shared'
import { EmptyTabState } from './empty-tab-state'
import { formatDate } from './format-helpers'

type Props = {
  clientId: string
  orgId: string
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

const DOSSIER_STATUS_VARIANT: Record<
  string,
  'muted' | 'blue' | 'green' | 'orange' | 'red'
> = {
  draft: 'muted',
  scheduled: 'blue',
  on_site: 'orange',
  back_office: 'orange',
  done: 'green',
  archived: 'muted',
  cancelled: 'red',
}

/**
 * Onglet Dossiers — historique missions du client.
 */
export async function ClientDossiersTab({ clientId, orgId }: Props) {
  const supabase = await createClient()
  const { data: dossiers } = await supabase
    .from('dossiers')
    .select(
      'id, reference, status, scheduled_at, created_at, properties(address, city, postal_code), missions(type)',
    )
    .eq('organization_id', orgId)
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const items = dossiers ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.08em] text-ink-mute">
          Dossiers
        </h2>
        <Button asChild variant="default" size="sm">
          <Link href={`/dashboard/dossiers/new?client_id=${clientId}`}>
            <Plus className="size-4" />
            Nouveau dossier
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyTabState
          icon={FolderOpen}
          title="Aucun dossier pour ce client."
          description="Créez un dossier pour démarrer une mission (DPE, Amiante, Plomb, etc.) sur un bien de ce client."
          action={
            <Button asChild variant="default" size="sm">
              <Link href={`/dashboard/dossiers/new?client_id=${clientId}`}>
                <Plus className="size-4" />
                Créer un dossier
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop : table */}
          <div className="hidden sm:block">
            <AppListTable>
              <AppListTableHead>
                <tr>
                  <th className="text-left font-medium px-4 py-3">Référence</th>
                  <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Bien</th>
                  <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">
                    Diagnostics
                  </th>
                  <th className="text-left font-medium px-4 py-3">Date</th>
                  <th className="text-left font-medium px-4 py-3">Statut</th>
                </tr>
              </AppListTableHead>
              <tbody>
                {items.map((d) => {
                  const prop = Array.isArray(d.properties) ? d.properties[0] : d.properties
                  const missions = (d.missions ?? []) as { type: string }[]
                  return (
                    <AppListTableRow key={d.id}>
                      <AppListTableCell>
                        <Link
                          href={`/dashboard/dossiers/${d.id}`}
                          className="font-mono text-[11px] font-semibold text-ink hover:underline"
                        >
                          {d.reference}
                        </Link>
                      </AppListTableCell>
                      <AppListTableCell className="hidden md:table-cell">
                        <div className="text-[13px]">{prop?.address ?? '—'}</div>
                        {prop?.city && (
                          <div className="text-[11px] text-ink-mute">
                            {prop.postal_code} {prop.city}
                          </div>
                        )}
                      </AppListTableCell>
                      <AppListTableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {missions.slice(0, 3).map((m, i) => (
                            <DiagChip
                              key={`${d.id}-${m.type}-${i}`}
                              type={m.type as MissionType}
                            />
                          ))}
                          {missions.length > 3 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{missions.length - 3}
                            </Badge>
                          )}
                        </div>
                      </AppListTableCell>
                      <AppListTableCell className="text-ink-mute text-[12px]">
                        {formatDate(d.scheduled_at ?? d.created_at)}
                      </AppListTableCell>
                      <AppListTableCell>
                        <Badge variant={DOSSIER_STATUS_VARIANT[d.status] ?? 'muted'}>
                          {DOSSIER_STATUS_LABELS[d.status] ?? d.status}
                        </Badge>
                      </AppListTableCell>
                    </AppListTableRow>
                  )
                })}
              </tbody>
            </AppListTable>
          </div>

          {/* Mobile : cards verticales */}
          <ul className="sm:hidden space-y-2">
            {items.map((d) => {
              const prop = Array.isArray(d.properties) ? d.properties[0] : d.properties
              const missions = (d.missions ?? []) as { type: string }[]
              return (
                <li
                  key={d.id}
                  className="rounded-xl border border-rule/60 bg-paper/85 p-4 shadow-glass-xs"
                >
                  <Link href={`/dashboard/dossiers/${d.id}`} className="block space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12px] font-semibold text-ink">
                        {d.reference}
                      </span>
                      <Badge variant={DOSSIER_STATUS_VARIANT[d.status] ?? 'muted'}>
                        {DOSSIER_STATUS_LABELS[d.status] ?? d.status}
                      </Badge>
                    </div>
                    {prop?.address ? (
                      <div className="text-[13px] text-ink">
                        {prop.address}
                        {prop.city ? (
                          <span className="text-ink-mute">
                            {' · '}
                            {prop.postal_code} {prop.city}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {missions.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {missions.slice(0, 4).map((m, i) => (
                          <DiagChip
                            key={`${d.id}-mob-${m.type}-${i}`}
                            type={m.type as MissionType}
                          />
                        ))}
                        {missions.length > 4 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{missions.length - 4}
                          </Badge>
                        )}
                      </div>
                    ) : null}
                    <div className="text-[11px] text-ink-mute">
                      {formatDate(d.scheduled_at ?? d.created_at)}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
