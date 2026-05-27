'use client'

/**
 * KOVAS — Liste des alertes ADEME actives.
 *
 * Card par alerte avec :
 *   - Badge severity (info / warning / error / critical)
 *   - Titre + description
 *   - Recommendation (optionnel)
 *   - Boutons Acknowledge / Resolve via PATCH /api/ademe/alerts
 *
 * Component client (interactif). Reçoit la liste pré-chargée depuis le
 * server component parent + actualise via PATCH au clic.
 */

import { AlertTriangle, CheckCircle2, Eye, Info } from 'lucide-react'
import { useState, useTransition } from 'react'

import type { AdemeAlertRow } from '@/app/api/ademe/alerts/route'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'

export interface AdemeAlertsListProps {
  alerts: AdemeAlertRow[]
}

const SEVERITY_META: Record<
  AdemeAlertRow['severity'],
  { label: string; variant: 'blue' | 'yellow' | 'red' | 'orange'; icon: typeof Info }
> = {
  info: { label: 'Information', variant: 'blue', icon: Info },
  warning: { label: 'Vigilance', variant: 'yellow', icon: AlertTriangle },
  error: { label: 'Erreur', variant: 'orange', icon: AlertTriangle },
  critical: { label: 'Critique', variant: 'red', icon: AlertTriangle },
}

export function AdemeAlertsList({ alerts: initialAlerts }: AdemeAlertsListProps) {
  const [alerts, setAlerts] = useState<AdemeAlertRow[]>(initialAlerts)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  if (alerts.length === 0) {
    return (
      <Card variant="opaque" padding="default" className="flex items-center gap-3">
        <CheckCircle2 className="size-5 text-success" />
        <p className="text-sm text-ink">Aucune alerte active. Votre cockpit est sain.</p>
      </Card>
    )
  }

  async function update(id: string, action: 'acknowledge' | 'resolve') {
    setPendingId(id)
    try {
      const res = await fetch('/api/ademe/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      startTransition(() => {
        setAlerts((prev) =>
          action === 'resolve'
            ? prev.filter((a) => a.id !== id)
            : prev.map((a) =>
                a.id === id ? { ...a, acknowledged_at: new Date().toISOString() } : a,
              ),
        )
      })
      toast.success(action === 'resolve' ? 'Alerte résolue' : 'Alerte vue')
    } catch {
      toast.error('Action impossible — réessayez')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const meta = SEVERITY_META[alert.severity]
        const Icon = meta.icon
        const acknowledged = Boolean(alert.acknowledged_at)
        return (
          <Card key={alert.id} variant="opaque" padding="default" className="space-y-3">
            <div className="flex items-start gap-3">
              <Icon className="size-5 shrink-0 mt-0.5 text-ink-mute" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  {acknowledged ? <Badge variant="muted">Vue</Badge> : null}
                  <span className="text-[11px] font-mono text-ink-mute">
                    {formatDate(alert.triggered_at)}
                  </span>
                </div>
                <h3 className="text-[15px] font-semibold text-ink">{alert.title}</h3>
                <p className="text-sm text-ink-mute leading-relaxed">{alert.description}</p>
                {alert.recommendation ? (
                  <div className="rounded-md border border-rule bg-sage-alt/60 p-3 text-[12px] text-ink leading-relaxed">
                    <span className="font-semibold">Recommandation : </span>
                    {alert.recommendation}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-rule pt-3">
              {!acknowledged ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId === alert.id}
                  onClick={() => update(alert.id, 'acknowledge')}
                >
                  <Eye className="size-4" /> Marquer comme vue
                </Button>
              ) : null}
              <Button
                variant="default"
                size="sm"
                disabled={pendingId === alert.id}
                onClick={() => update(alert.id, 'resolve')}
              >
                <CheckCircle2 className="size-4" /> Résoudre
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
