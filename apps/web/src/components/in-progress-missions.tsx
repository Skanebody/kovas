import { ArrowRight, Play } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'

const ACTIVE_STATES = ['scheduled', 'in_progress', 'to_review'] as const

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Planifié',
  in_progress: 'En cours',
  to_review: 'À relire',
}

const STATUS_VARIANT: Record<string, 'blue' | 'orange'> = {
  scheduled: 'blue',
  in_progress: 'orange',
  to_review: 'orange',
}

/**
 * Widget dashboard : liste les diagnostics actifs (cross-dossier) avec
 * bouton de reprise rapide. Limité aux 8 plus récents.
 */
export async function InProgressMissions() {
  const { supabase, orgId } = await getCurrentUser()

  const { data: missions } = await supabase
    .from('missions')
    .select(
      'id, reference, type, status, dossier_id, dossiers(reference, properties(address, city))',
    )
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .in('status', ACTIVE_STATES)
    .order('created_at', { ascending: false })
    .limit(8)

  if (!missions || missions.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Play className="size-4" />
            Diagnostics en cours ({missions.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {missions.map((m) => {
            const dossier = Array.isArray(m.dossiers) ? m.dossiers[0] : m.dossiers
            const prop = Array.isArray(dossier?.properties)
              ? dossier?.properties[0]
              : dossier?.properties
            return (
              <li key={m.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {MISSION_TYPE_LABELS[m.type] ?? m.type}
                      </span>
                      <Badge variant={STATUS_VARIANT[m.status] ?? 'blue'}>
                        {STATUS_LABEL[m.status] ?? m.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {dossier?.reference && <span className="font-mono">{dossier.reference}</span>}
                      {prop?.address && (
                        <span>
                          {' · '}
                          {prop.address}
                          {prop.city ? `, ${prop.city}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/app/dossiers/${m.dossier_id}#mission-${m.id}`}>
                      Reprendre <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
