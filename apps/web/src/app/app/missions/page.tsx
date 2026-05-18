import { FileText, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  MISSION_STATUS_LABELS,
  MISSION_STATUS_VARIANT,
  MISSION_TYPE_LABELS,
} from '@/lib/mission-helpers'

export const metadata: Metadata = { title: 'Missions' }

export default async function MissionsPage() {
  const { supabase, orgId } = await getCurrentUser()

  const { data: missions } = await supabase
    .from('missions')
    .select('id, reference, type, status, scheduled_at, property_id, properties(address, city)')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Missions</h1>
          <p className="text-sm text-muted-foreground">
            {missions?.length ?? 0} mission{(missions?.length ?? 0) > 1 ? 's' : ''}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/missions/new">
            <Plus className="size-4" />
            Nouvelle mission
          </Link>
        </Button>
      </div>

      {missions && missions.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">Référence</th>
                <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Type</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Bien</th>
                <th className="text-left font-medium px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {missions.map((m) => {
                // properties relation peut être un array selon le typing — on prend le 1er
                const prop = Array.isArray(m.properties) ? m.properties[0] : m.properties
                return (
                  <tr
                    key={m.id}
                    className="border-t border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/app/missions/${m.id}`} className="font-medium hover:underline">
                        {m.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                      {MISSION_TYPE_LABELS[m.type] ?? m.type}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {prop?.address ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={MISSION_STATUS_VARIANT[m.status] ?? 'muted'}>
                        {MISSION_STATUS_LABELS[m.status] ?? m.status}
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
            <FileText className="size-10 mx-auto text-muted-foreground" />
            <div className="space-y-1">
              <h2 className="font-semibold">Aucune mission pour le moment</h2>
              <p className="text-sm text-muted-foreground">
                Créez votre première mission — vous aurez besoin d'un bien existant.
              </p>
            </div>
            <Button asChild>
              <Link href="/app/missions/new">
                <Plus className="size-4" />
                Créer une mission
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
