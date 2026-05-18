import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowRight, Users } from 'lucide-react'
import Link from 'next/link'

interface RecentClient {
  id: string
  display_name: string
  last_dossier_at: string | null
  total_dossiers: number
  last_mission_types: string[]
}

function timeAgoFr(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const day = Math.round(diff / 86_400_000)
  if (day < 1) return "aujourd'hui"
  if (day === 1) return 'hier'
  if (day < 7) return `il y a ${day} j`
  const week = Math.round(day / 7)
  if (week < 5) return `il y a ${week} sem`
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

/**
 * F2 — 5 derniers clients (avec dossier récent) pour accès rapide depuis le dashboard.
 * Cas d'usage : appel téléphone imprévu, retrouver le client en 1 tap.
 * cf. docs/dashboard-spec.md F2.
 */
export async function RecentClientsBlock() {
  const { supabase, orgId } = await getCurrentUser()

  // On part de tous les clients de l'org, on rattache le dossier le plus récent + ses missions.
  const { data: clients } = await supabase
    .from('clients')
    .select('id, display_name, dossiers(id, created_at, missions(type))')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(40)

  const enriched: RecentClient[] = (clients ?? []).map((c) => {
    const dossiers = (c.dossiers ?? []) as {
      id: string
      created_at: string
      missions?: { type: string }[]
    }[]
    const active = dossiers.filter((d) => !!d.created_at)
    active.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const last = active[0]
    return {
      id: c.id,
      display_name: c.display_name,
      last_dossier_at: last?.created_at ?? null,
      total_dossiers: active.length,
      last_mission_types: (last?.missions ?? []).map((m) => m.type),
    }
  })

  const top = enriched
    .filter((c) => c.last_dossier_at !== null)
    .sort((a, b) => {
      const ta = a.last_dossier_at ? new Date(a.last_dossier_at).getTime() : 0
      const tb = b.last_dossier_at ? new Date(b.last_dossier_at).getTime() : 0
      return tb - ta
    })
    .slice(0, 5)

  if (top.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="size-4" /> Clients récents
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/clients">
            Voir tout <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {top.map((c) => (
            <li key={c.id} className="px-4 py-2.5 hover:bg-muted/30 transition-colors">
              <Link href={`/app/clients/${c.id}`} className="flex items-center gap-3 text-sm">
                <span className="font-medium flex-1 min-w-0 truncate">{c.display_name}</span>
                {c.last_mission_types.length > 0 && (
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {c.last_mission_types
                      .map((t) => t.split('_')[0]?.toUpperCase())
                      .filter(Boolean)
                      .slice(0, 3)
                      .join(' · ')}
                  </span>
                )}
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  {timeAgoFr(c.last_dossier_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
