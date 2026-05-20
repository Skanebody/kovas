'use client'

import { Card } from '@/components/ui/card'
import type { ScanQuota } from '@/lib/documents/types'
import { cn } from '@/lib/utils'
import { ScanLine } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ScanQuotaWidgetProps {
  /** Quota injecté (server-side) — sinon le widget fetch lui-même. */
  quota?: ScanQuota
  className?: string
}

/**
 * Petit widget de progression usage scans documents (mois courant).
 *
 * Couleurs :
 * - normal : navy / chartreuse
 * - warning < 20 restants : amber
 * - critical = 0 : red
 */
export function ScanQuotaWidget({ quota: injected, className }: ScanQuotaWidgetProps) {
  const [quota, setQuota] = useState<ScanQuota | null>(injected ?? null)
  const [loading, setLoading] = useState(!injected)

  useEffect(() => {
    if (injected) {
      setQuota(injected)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch('/api/quota/scans')
      .then((r) => (r.ok ? (r.json() as Promise<ScanQuota>) : Promise.reject(r)))
      .then((q) => {
        if (!cancelled) setQuota(q)
      })
      .catch(() => {
        if (!cancelled) setQuota(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [injected])

  if (loading) {
    return (
      <Card
        variant="opaque"
        padding="sm"
        className={cn('animate-pulse-soft h-[78px]', className)}
        aria-busy
      />
    )
  }

  if (!quota) {
    return null
  }

  const pct = quota.included > 0 ? Math.min(100, (quota.used / quota.included) * 100) : 0
  const critical = quota.remaining === 0
  const warning = !critical && quota.remaining < 20

  const barColor = critical ? 'bg-accent-red' : warning ? 'bg-accent-orange' : 'bg-chartreuse-deep'

  return (
    <Card variant="opaque" padding="sm" className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <ScanLine className="size-4 text-ink-mute" aria-hidden />
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          Scans documents ce mois
        </p>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-serif italic text-2xl text-ink">{quota.used}</span>
        <span className="text-sm text-ink-mute">/ {quota.included}</span>
        {critical ? (
          <span className="ml-auto text-xs font-semibold text-accent-red">Limite atteinte</span>
        ) : warning ? (
          <span className="ml-auto text-xs font-semibold text-accent-orange">
            {quota.remaining} restants
          </span>
        ) : (
          <span className="ml-auto text-xs text-ink-mute">{quota.remaining} restants</span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-rule/40" aria-hidden>
        <div
          className={cn('h-full rounded-full transition-all duration-base', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </Card>
  )
}
