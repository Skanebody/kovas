'use client'

/**
 * Liste des alertes non résolues — polling 30s sur /api/admin/alerts.
 *
 * Tri : severity (critical d'abord) puis recent first.
 * Action : "Résoudre" ouvre AlertResolveModal.
 */

import type { AlertEventDto, AlertsListResponse } from '@/app/api/admin/alerts/route'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Bell, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { AlertCard } from './AlertCard'
import { AlertResolveModal } from './AlertResolveModal'

const POLL_INTERVAL_MS = 30_000

const SEVERITY_ORDER: Record<'info' | 'warning' | 'critical', number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

export function ActiveAlertsList() {
  const [data, setData] = useState<AlertsListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalEvent, setModalEvent] = useState<AlertEventDto | null>(null)

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/alerts', { cache: 'no-store' })
      if (!res.ok) {
        setError(`HTTP ${res.status}`)
        return
      }
      const body = (await res.json()) as AlertsListResponse
      setData(body)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
    const id = setInterval(fetchAlerts, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchAlerts])

  const active = (data?.active_events ?? []).slice().sort((a, b) => {
    const sa = SEVERITY_ORDER[a.rule_severity]
    const sb = SEVERITY_ORDER[b.rule_severity]
    if (sa !== sb) return sa - sb
    return b.created_at.localeCompare(a.created_at)
  })

  return (
    <>
      <Card variant="opaque" padding="default">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink flex items-center gap-2">
            <Bell className="size-4 text-ink-mute" aria-hidden />
            Alertes actives
          </h2>
          <span
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint"
            title="Polling 30s"
          >
            <RefreshCw className={cn('size-3', loading && 'animate-spin')} aria-hidden />
            {active.length} en cours
          </span>
        </div>

        {loading && active.length === 0 ? (
          <div className="grid gap-3 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder.
              <div key={i} className="h-24 rounded-md bg-ink/5" />
            ))}
          </div>
        ) : active.length === 0 ? (
          <p className="text-sm text-ink-mute py-4">
            Aucune alerte active. Tout est sous contrôle.
          </p>
        ) : (
          <div className="grid gap-3">
            {active.map((ev) => (
              <AlertCard key={ev.id} event={ev} onResolve={setModalEvent} />
            ))}
          </div>
        )}

        {error && active.length === 0 ? (
          <p className="text-[12px] text-accent-red mt-3" role="alert">
            Erreur de chargement : {error}
          </p>
        ) : null}
      </Card>

      <AlertResolveModal
        event={modalEvent}
        onClose={() => setModalEvent(null)}
        onResolved={fetchAlerts}
      />
    </>
  )
}
