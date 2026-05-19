import { FolderOpen, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MissionTypeTag } from '@/components/ui/mission-type-tag'
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-display text-3xl md:text-4xl tracking-tight">Dossiers</h1>
          <p className="text-sm text-ink-mute">
            {dossiers?.length ?? 0} dossier{(dossiers?.length ?? 0) > 1 ? 's' : ''}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/dossiers/new">
            <Plus className="size-4" />
            Nouveau dossier
          </Link>
        </Button>
      </div>

      {dossiers && dossiers.length > 0 ? (
        <div className="rounded-xl border border-border-soft bg-paper overflow-hidden shadow-glass-sm">
          <table className="w-full text-sm">
            <thead className="bg-cream-deep/80 text-ink-mute">
              <tr>
                <th className="text-left font-medium px-4 py-3">Référence</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Bien</th>
                <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Diagnostics</th>
                <th className="text-left font-medium px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {dossiers.map((d) => {
                const prop = Array.isArray(d.properties) ? d.properties[0] : d.properties
                const missions = (d.missions ?? []) as { type: string }[]
                return (
                  <tr
                    key={d.id}
                    className="border-t border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/dossiers/${d.id}`}
                        className="font-medium hover:underline font-mono text-xs"
                      >
                        {d.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-sm">{prop?.address ?? '—'}</div>
                      {prop?.city && (
                        <div className="text-xs text-ink-mute">
                          {prop.postal_code} {prop.city}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {missions.slice(0, 3).map((m, i) => (
                          <MissionTypeTag
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
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={DOSSIER_STATUS_VARIANT[d.status] ?? 'muted'}>
                        {DOSSIER_STATUS_LABELS[d.status] ?? d.status}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 pb-8 text-center space-y-4">
            <FolderOpen className="size-10 mx-auto text-ink-mute" />
            <div className="space-y-1">
              <h2 className="font-semibold">Aucun dossier pour le moment</h2>
              <p className="text-sm text-ink-mute">
                Un dossier regroupe les diagnostics d'une même visite (DPE + Amiante + Plomb…) sur
                un bien.
              </p>
            </div>
            <Button asChild>
              <Link href="/app/dossiers/new">
                <Plus className="size-4" />
                Créer un dossier
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
