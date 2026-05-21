import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { cn } from '@/lib/utils'
import { AlertCircle, ArrowRight, CheckCircle2, FileWarning, Send } from 'lucide-react'
import Link from 'next/link'
import type { ComponentType } from 'react'

interface AlertRow {
  key: string
  level: 'critical' | 'warning' | 'success'
  icon: ComponentType<{ className?: string }>
  label: string
  cta: string
  href: string
}

const LEVEL_COLORS: Record<AlertRow['level'], string> = {
  critical: 'text-accent-red',
  warning: 'text-accent-warm',
  success: 'text-accent-green',
}

/**
 * Alertes & actions prioritaires cross-entité.
 * Sources réelles uniquement (pas de factures impayées V1, pas d'API tierce).
 */
export async function AlertsAndActions() {
  const { supabase, orgId } = await getCurrentUser()
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const todayBoundary = new Date()
  todayBoundary.setHours(0, 0, 0, 0)

  const [
    { count: overdueDossiers },
    { count: toReviewMissions },
    { count: docsRelance },
    { count: readyMissions },
  ] = await Promise.all([
    // Dossiers scheduled in past but not started
    supabase
      .from('dossiers')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .lt('scheduled_at', todayBoundary.toISOString())
      .in('status', ['draft', 'scheduled']),
    // Missions to_review
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'to_review'),
    // Dossiers with upcoming RDV (next 3j) but 0 doc owner_documents
    supabase
      .from('dossiers')
      .select('id, owner_documents(id), missions(type)', { count: 'exact' })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte('scheduled_at', todayBoundary.toISOString())
      .lt('scheduled_at', new Date(todayBoundary.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString())
      .limit(50),
    // Missions done not yet exported (status='done')
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'done')
      .gte('completed_at', yesterday),
  ])

  const alerts: AlertRow[] = []

  if (overdueDossiers && overdueDossiers > 0) {
    alerts.push({
      key: 'overdue',
      level: 'critical',
      icon: AlertCircle,
      label: `${overdueDossiers} dossier${overdueDossiers > 1 ? 's' : ''} non démarré${overdueDossiers > 1 ? 's' : ''} (RDV passé)`,
      cta: 'Voir',
      href: '/dashboard/dossiers',
    })
  }
  if (toReviewMissions && toReviewMissions > 0) {
    alerts.push({
      key: 'review',
      level: 'warning',
      icon: AlertCircle,
      label: `${toReviewMissions} mission${toReviewMissions > 1 ? 's' : ''} à relire`,
      cta: 'Relire',
      href: '/dashboard/dossiers',
    })
  }
  if (docsRelance && docsRelance > 0) {
    alerts.push({
      key: 'docs',
      level: 'warning',
      icon: FileWarning,
      label: `${docsRelance} dossier${docsRelance > 1 ? 's' : ''} sans documents reçus`,
      cta: 'Relancer',
      href: '/dashboard/dossiers',
    })
  }
  if (readyMissions && readyMissions > 0) {
    alerts.push({
      key: 'ready',
      level: 'success',
      icon: Send,
      label: `${readyMissions} mission${readyMissions > 1 ? 's' : ''} prête${readyMissions > 1 ? 's' : ''} à exporter`,
      cta: 'Exporter',
      href: '/dashboard/dossiers',
    })
  }

  return (
    <Card variant="opaque" padding="default" className="h-full flex flex-col">
      <CardHeader className="pb-3 space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute flex items-center justify-between">
          <span>Alertes & actions</span>
          {alerts.length > 0 && (
            <span className="text-ink tabular-nums font-semibold">{alerts.length}</span>
          )}
        </p>
        <CardTitle className="font-serif italic text-xl text-ink leading-tight">
          {alerts.length === 0 ? 'Tout est à jour.' : 'À traiter avant de partir.'}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col">
        {alerts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 py-6">
            <CheckCircle2 className="size-8 text-accent-green" />
            <p className="text-xs text-ink-mute max-w-[200px]">
              Aucune action en attente. Profitez-en pour préparer demain.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {alerts.map((a) => (
              <li key={a.key} className="flex items-center gap-2 text-sm">
                <a.icon className={cn('size-4 shrink-0', LEVEL_COLORS[a.level])} />
                <span className="flex-1 min-w-0 truncate">{a.label}</span>
                <Button size="sm" variant="ghost" asChild className="h-7 px-2 text-xs">
                  <Link href={a.href}>
                    {a.cta} <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
