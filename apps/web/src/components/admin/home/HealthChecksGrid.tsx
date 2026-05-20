'use client'

/**
 * Grille de health checks — dashboard admin.
 *
 * Polling 30s sur /api/admin/health (changements lents : latence, queue, dernière
 * activité). V2 : Realtime ou push event-driven si nécessaire.
 */

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { PieChart, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

type HealthStatus = 'green' | 'orange' | 'red' | 'unknown'

interface HealthCheck {
  id: string
  label: string
  value: string
  status: HealthStatus
  hint?: string
}

interface HealthResponse {
  generated_at?: string
  checks?: HealthCheck[]
  error?: string
}

const POLL_INTERVAL_MS = 30_000

const STATUS_DOT_CLASS: Record<HealthStatus, string> = {
  green: 'bg-success shadow-[0_0_0_4px_rgba(34,197,94,0.12)]',
  orange: 'bg-warning shadow-[0_0_0_4px_rgba(245,158,11,0.12)]',
  red: 'bg-accent-red shadow-[0_0_0_4px_rgba(220,38,38,0.12)]',
  unknown: 'bg-ink-faint shadow-[0_0_0_4px_rgba(0,0,0,0.05)]',
}

const STATUS_LABELS: Record<HealthStatus, string> = {
  green: 'OK',
  orange: 'Dégradé',
  red: 'Down',
  unknown: 'Inconnu',
}

export function HealthChecksGrid() {
  const [checks, setChecks] = useState<HealthCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  const fetchChecks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/health', { cache: 'no-store' })
      if (!res.ok) {
        setError(`HTTP ${res.status}`)
        return
      }
      const data = (await res.json()) as HealthResponse
      if (data.checks) {
        setChecks(data.checks)
        setGeneratedAt(data.generated_at ?? null)
        setError(null)
      } else if (data.error) {
        setError(data.error)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChecks()
    const id = setInterval(fetchChecks, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchChecks])

  const updatedAt = generatedAt
    ? new Date(generatedAt).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null

  return (
    <Card variant="opaque" padding="default" className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Health checks</h2>
        <span
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint"
          title="Polling 30s"
        >
          <RefreshCw className={cn('size-3', loading && 'animate-spin')} aria-hidden />
          {updatedAt ? `Maj ${updatedAt}` : '30s'}
        </span>
      </div>

      {loading && checks.length === 0 ? (
        <div className="grid grid-cols-2 gap-2 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder.
            <div key={i} className="h-16 rounded-md bg-ink/5" />
          ))}
        </div>
      ) : checks.length === 0 ? (
        <div className="flex items-center gap-3 py-4 text-sm text-ink-mute">
          <PieChart className="size-4" aria-hidden />
          Aucun check disponible.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2" aria-label="Indicateurs de santé des services">
          {checks.map((check) => (
            <li
              key={check.id}
              className="rounded-md border border-rule/60 bg-paper/60 px-3 py-2.5"
              title={check.hint}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn('size-2 rounded-full shrink-0', STATUS_DOT_CLASS[check.status])}
                  aria-label={STATUS_LABELS[check.status]}
                />
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute truncate">
                  {check.label}
                </p>
              </div>
              <p className="mt-1.5 text-[13px] font-semibold text-ink truncate">{check.value}</p>
              {check.hint ? (
                <p className="text-[10px] text-ink-faint truncate">{check.hint}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {error && checks.length === 0 ? (
        <p className="text-[12px] text-accent-red mt-3" role="alert">
          Erreur de chargement : {error}
        </p>
      ) : null}
    </Card>
  )
}
