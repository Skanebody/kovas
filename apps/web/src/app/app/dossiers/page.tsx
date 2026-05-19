import { AppPageHeader } from '@/components/app-page-header'
import {
  AppListTable,
  AppListTableCell,
  AppListTableHead,
  AppListTableRow,
} from '@/components/ui/app-list-table'
import { FolderOpen, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DiagChip } from '@/components/ui/diag-chip'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { MissionType } from '@kovas/shared'

export const metadata: Metadata = { title: 'Dossiers' }

const DOSSIER_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  scheduled: 'Planifié',
  on_site: 'Sur place',
  back_office: 'Au bureau',
  done: 'Terminé',
  archived: 'Archivé',
  cancelled: 'Annulé',
}

const DOSSIER_STATUS_VARIANT: Record<string, 'muted' | 'blue' | 'green' | 'orange' | 'red'> = {
  draft: 'muted',
  scheduled: 'blue',
  on_site: 'orange',
  back_office: 'orange',
  done: 'green',
  archived: 'muted',
  cancelled: 'red',
}

export default async function DossiersPage() {
  const { supabase, orgId } = await getCurrentUser()

  const { data: dossiers } = await supabase
    .from('dossiers')
    .select(
      'id, reference, status, scheduled_at, properties(address, city, postal_code), missions(type)',
    )
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const count = dossiers?.length ?? 0

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        title="Vos"
        accent="dossiers"
        description={`${count} dossier${count > 1 ? 's' : ''} · regroupant les diagnostics par visite et par bien`}
        action={
          <Button asChild variant="warm">
            <Link href="/app/dossiers/new">
              <Plus className="size-4" />
              Nouveau dossier
            </Link>
          </Button>
        }
      />

      {dossiers && dossiers.length > 0 ? (
        <AppListTable>
          <AppListTableHead>
            <tr>
              <th className="text-left font-medium px-4 py-3">Référence</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Bien</th>
              <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Diagnostics</th>
              <th className="text-left font-medium px-4 py-3">Statut</th>
            </tr>
          </AppListTableHead>
          <tbody>
            {dossiers.map((d) => {
              const prop = Array.isArray(d.properties) ? d.properties[0] : d.properties
              const missions = (d.missions ?? []) as { type: string }[]
              return (
                <AppListTableRow key={d.id}>
                  <AppListTableCell>
                    <Link
                      href={`/app/dossiers/${d.id}`}
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
                  <AppListTableCell className="hidden sm:table-cell">
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
      ) : (
        <EmptyState
          icon={FolderOpen}
          title="Premier dossier en 90 secondes."
          description="Un dossier regroupe les diagnostics d'une même visite sur un bien (DPE + Amiante + Plomb, etc.)."
          action={
            <Button asChild variant="warm">
              <Link href="/app/dossiers/new">
                <Plus className="size-4" />
                Créer mon premier dossier
              </Link>
            </Button>
          }
        />
      )}
    </div>
  )
}
