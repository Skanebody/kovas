import { AppPageHeader } from '@/components/app-page-header'
import { AppListToolbar } from '@/components/app-list-toolbar'
import { parseListSearchParams } from '@/components/app-list-toolbar-utils'
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

const DOSSIER_STATUS_FILTER_OPTIONS = Object.entries(DOSSIER_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
)

const MISSION_TYPE_FILTER_OPTIONS: { value: MissionType; label: string }[] = [
  { value: 'dpe_vente', label: 'DPE (vente)' },
  { value: 'dpe_location', label: 'DPE (location)' },
  { value: 'amiante_vente', label: 'Amiante (vente)' },
  { value: 'amiante_avant_travaux', label: 'Amiante (avant travaux)' },
  { value: 'plomb_crep', label: 'Plomb CREP' },
  { value: 'gaz', label: 'Gaz' },
  { value: 'electricite', label: 'Électricité' },
  { value: 'termites', label: 'Termites' },
  { value: 'carrez_boutin', label: 'Carrez / Boutin' },
  { value: 'erp', label: 'ERP' },
  { value: 'copropriete', label: 'Copropriété' },
]

const VALID_STATUSES = new Set(Object.keys(DOSSIER_STATUS_LABELS))
const VALID_MISSION_TYPES = new Set(MISSION_TYPE_FILTER_OPTIONS.map((o) => o.value))

const PAGE_SIZE = 25

interface DossiersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DossiersPage({ searchParams }: DossiersPageProps) {
  const sp = await searchParams
  const parsed = parseListSearchParams(sp, {
    pageSize: PAGE_SIZE,
    filterKeys: ['status', 'mission_type'] as const,
  })

  const statusRaw = parsed.filters.status
  const statusFilter = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw
  const missionTypeRaw = parsed.filters.mission_type
  const missionTypeFilter = Array.isArray(missionTypeRaw) ? missionTypeRaw[0] : missionTypeRaw

  const validStatus =
    typeof statusFilter === 'string' && VALID_STATUSES.has(statusFilter) ? statusFilter : null
  const validMissionType =
    typeof missionTypeFilter === 'string' && VALID_MISSION_TYPES.has(missionTypeFilter as MissionType)
      ? (missionTypeFilter as MissionType)
      : null

  const { supabase, orgId } = await getCurrentUser()

  // Si filtre missions.type actif → utiliser un join `!inner` pour filtrer côté DB.
  const missionsRelation = validMissionType ? 'missions!inner(type)' : 'missions(type)'

  let query = supabase
    .from('dossiers')
    .select(
      `id, reference, status, scheduled_at, properties(address, city, postal_code), ${missionsRelation}`,
      { count: 'exact' },
    )
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  if (validStatus) {
    query = query.eq('status', validStatus)
  }
  if (validMissionType) {
    query = query.eq('missions.type', validMissionType)
  }

  if (parsed.q) {
    const escaped = parsed.q.replace(/[%,]/g, ' ').trim()
    if (escaped.length > 0) {
      const pattern = `%${escaped}%`
      // Search sur `reference` du dossier uniquement côté `.or()` (les colonnes
      // de tables jointes ne sont pas adressables dans un même `.or()`).
      // L'address côté `properties` est filtrée côté client en best-effort.
      query = query.ilike('reference', pattern)
    }
  }

  const { data: dossiers, count } = await query
    .order('created_at', { ascending: false })
    .range(parsed.offset, parsed.offset + PAGE_SIZE - 1)

  const totalCount = count ?? 0
  const hasActiveFilter = Boolean(parsed.q || validStatus || validMissionType)

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        title="Vos"
        accent="dossiers"
        description="Regroupant les diagnostics par visite et par bien."
      />

      <AppListToolbar
        searchPlaceholder="Rechercher un dossier (référence)…"
        totalCount={totalCount}
        currentPage={parsed.page}
        pageSize={PAGE_SIZE}
        filters={[
          {
            key: 'status',
            label: 'Tous les statuts',
            options: DOSSIER_STATUS_FILTER_OPTIONS,
          },
          {
            key: 'mission_type',
            label: 'Tous les diagnostics',
            options: MISSION_TYPE_FILTER_OPTIONS,
          },
        ]}
        primaryAction={
          <Button asChild variant="accent">
            <Link href="/dashboard/dossiers/new">
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
      ) : hasActiveFilter ? (
        <EmptyState
          icon={FolderOpen}
          title="Aucun dossier ne correspond à cette recherche."
          description="Affinez les filtres ou videz la recherche pour retrouver vos dossiers."
        />
      ) : (
        <EmptyState
          icon={FolderOpen}
          title="Premier dossier en 90 secondes."
          description="Un dossier regroupe les diagnostics d'une même visite sur un bien (DPE + Amiante + Plomb, etc.)."
          action={
            <Button asChild variant="accent">
              <Link href="/dashboard/dossiers/new">
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
