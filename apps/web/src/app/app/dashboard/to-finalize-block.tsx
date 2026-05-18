import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import { AlertCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

/**
 * Dossiers terminés sur le terrain mais pas exportés / en attente de relecture.
 * Cible : missions en 'to_review' (à exporter) + dossiers stagnant en 'on_site'
 * depuis plus de 24h (visite finie sans transition).
 */
export async function ToFinalizeBlock() {
  const { supabase, orgId } = await getCurrentUser()
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: missions } = await supabase
    .from('missions')
    .select(
      'id, type, status, dossier_id, dossiers(reference, status, started_at, properties(address, city))',
    )
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .in('status', ['to_review'])
    .order('completed_at', { ascending: false })
    .limit(8)

  const { data: stagnantDossiers } = await supabase
    .from('dossiers')
    .select('id, reference, status, started_at, properties(address, city)')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .eq('status', 'on_site')
    .lt('started_at', yesterday)
    .order('started_at', { ascending: true })
    .limit(5)

  const items: {
    key: string
    title: string
    subtitle: string
    href: string
    cta: string
    variant: 'orange' | 'muted'
  }[] = []

  for (const m of missions ?? []) {
    const dossier = Array.isArray(m.dossiers) ? m.dossiers[0] : m.dossiers
    const prop = Array.isArray(dossier?.properties) ? dossier?.properties[0] : dossier?.properties
    items.push({
      key: `mission-${m.id}`,
      title: `${MISSION_TYPE_LABELS[m.type] ?? m.type} · à relire`,
      subtitle: `${dossier?.reference ?? ''}${prop?.address ? ` — ${prop.address}${prop.city ? `, ${prop.city}` : ''}` : ''}`,
      href: `/app/dossiers/${m.dossier_id}#mission-${m.id}`,
      cta: 'Relire',
      variant: 'orange',
    })
  }

  for (const d of stagnantDossiers ?? []) {
    const prop = Array.isArray(d.properties) ? d.properties[0] : d.properties
    items.push({
      key: `dossier-${d.id}`,
      title: 'Visite terminée — à finaliser au bureau',
      subtitle: `${d.reference}${prop?.address ? ` — ${prop.address}${prop.city ? `, ${prop.city}` : ''}` : ''}`,
      href: `/app/dossiers/${d.id}`,
      cta: 'Finaliser',
      variant: 'muted',
    })
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="size-4" />À finaliser
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Tout est à jour. Bien joué.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="size-4" />À finaliser ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <li key={it.key} className="px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={it.variant}>{it.title}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{it.subtitle}</div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={it.href}>
                    {it.cta} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
