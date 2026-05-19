import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DiagChip } from '@/components/ui/diag-chip'
import { getCurrentUser } from '@/lib/auth/current-user'
import { cn } from '@/lib/utils'
import type { MissionType } from '@kovas/shared'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface MissionRow {
  id: string
  type: string
  reference: string
  status: string
  dossier_id: string
  scheduled_at: string | null
  client_name: string | null
  property_city: string | null
}

const COLUMNS = [
  {
    id: 'todo' as const,
    label: 'À démarrer',
    statuses: ['draft', 'scheduled'] as string[],
    accent: 'bg-accent-blue/40',
  },
  {
    id: 'in_progress' as const,
    label: 'En cours',
    statuses: ['in_progress'] as string[],
    accent: 'bg-accent-orange',
  },
  {
    id: 'to_finalize' as const,
    label: 'À finaliser',
    statuses: ['to_review'] as string[],
    accent: 'bg-accent-green',
  },
  {
    id: 'done' as const,
    label: 'Terminé',
    statuses: ['done', 'exported'] as string[],
    accent: 'bg-subtle-foreground',
  },
] as const

/**
 * Pipeline Kanban horizontal 4 colonnes — vue semaine + jours adjacents.
 * Pas de drag-and-drop V1. Tap card = ouvre la mission.
 */
export async function DashboardPipeline() {
  const { supabase, orgId } = await getCurrentUser()
  const sinceIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: missions } = await supabase
    .from('missions')
    .select(
      'id, type, reference, status, dossier_id, dossiers(scheduled_at, clients(display_name), properties(city))',
    )
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .in('status', ['draft', 'scheduled', 'in_progress', 'to_review', 'done', 'exported'])
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(60)

  const rows: MissionRow[] = (missions ?? []).map((m) => {
    const d = Array.isArray(m.dossiers) ? m.dossiers[0] : m.dossiers
    const client = Array.isArray(d?.clients) ? d?.clients[0] : d?.clients
    const prop = Array.isArray(d?.properties) ? d?.properties[0] : d?.properties
    return {
      id: m.id,
      type: m.type,
      reference: m.reference,
      status: m.status,
      dossier_id: m.dossier_id,
      scheduled_at: d?.scheduled_at ?? null,
      client_name: client?.display_name ?? null,
      property_city: prop?.city ?? null,
    }
  })

  const byColumn = new Map<string, MissionRow[]>(COLUMNS.map((c) => [c.id, []]))
  for (const r of rows) {
    for (const col of COLUMNS) {
      if (col.statuses.includes(r.status)) {
        byColumn.get(col.id)?.push(r)
        break
      }
    }
  }
  // Terminé : limite à 5 récents pour éviter de noyer le pipeline
  const done = byColumn.get('done') ?? []
  byColumn.set('done', done.slice(0, 5))

  return (
    <Card variant="opaque" padding="default">
      <CardHeader className="pb-3">
        <CardTitle className="text-[11px] uppercase tracking-wider font-semibold text-ink-mute">
          Pipeline de la semaine
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {COLUMNS.map((col) => {
            const cards = byColumn.get(col.id) ?? []
            return (
              <div
                key={col.id}
                className="rounded-xl border border-rule/80 bg-cream/60 p-2 min-h-[180px] flex flex-col"
              >
                <div className="flex items-center justify-between px-1 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn('size-2 rounded-full', col.accent)} aria-hidden />
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      {col.label}
                    </span>
                  </div>
                  <Badge variant="muted" className="text-[10px] py-0">
                    {cards.length}
                  </Badge>
                </div>
                {cards.length === 0 ? (
                  <p className="text-xs text-ink-mute italic px-1 py-3">—</p>
                ) : (
                  <ul className="space-y-1.5">
                    {cards.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/app/dossiers/${r.dossier_id}#mission-${r.id}`}
                          className="flex items-stretch gap-2 rounded-lg bg-paper/90 hover:bg-ink/5 transition-colors duration-fast overflow-hidden border border-rule/60"
                        >
                          <span className={cn('w-1 shrink-0', col.accent)} aria-hidden />
                          <div className="flex-1 min-w-0 py-2 pr-2 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <DiagChip type={r.type as MissionType} />
                              <span className="text-[10px] font-mono text-ink-mute">
                                {r.reference}
                              </span>
                            </div>
                            <div className="text-xs font-medium truncate">
                              {r.client_name ?? 'Sans client'}
                            </div>
                            <div className="text-[10px] text-ink-mute truncate">
                              {r.property_city ?? ''}
                              {r.scheduled_at && (
                                <>
                                  {r.property_city && ' · '}
                                  {new Date(r.scheduled_at).toLocaleDateString('fr-FR', {
                                    day: '2-digit',
                                    month: 'short',
                                  })}
                                </>
                              )}
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-end mt-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app/dossiers">
              Tous les dossiers <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
