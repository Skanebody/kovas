'use client'

/**
 * KOVAS — CockpitFraudeList — affiche les missions DPE en cours + statut DPE shopping.
 *
 * Pour chaque mission, lazy-load via /api/missions/[id]/dpe-shopping-check
 * (non-bloquant, fetch parallèle).
 *
 * UI sobre v5 : sage paper + bordures 1px + chartreuse seulement si OK.
 */

import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2, ChevronRight, Loader2, MapPin } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface MissionItem {
  mission_id: string
  status: string
  address: string
}

interface DpeShoppingApi {
  ok: boolean
  has_recent_dpe?: boolean
  previous_class?: string | null
  previous_date?: string | null
  days_since_previous?: number | null
  alert_level?: 'none' | 'info' | 'warning'
  user_message?: string
  error?: string
}

export function CockpitFraudeList({ items }: { items: MissionItem[] }): React.ReactElement {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-rule/60 bg-paper px-6 py-12 text-center">
        <p className="text-[14px] text-ink-soft">
          Aucune mission DPE en cours. Quand vous démarrez un nouveau DPE, il apparaîtra ici avec
          une pré-vérification ADEME automatique.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {items.map((m) => (
        <MissionRow key={m.mission_id} item={m} />
      ))}
    </ul>
  )
}

function MissionRow({ item }: { item: MissionItem }): React.ReactElement {
  const [data, setData] = useState<DpeShoppingApi | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/missions/${item.mission_id}/dpe-shopping-check`)
      .then((r) => r.json())
      .then((d: DpeShoppingApi) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setData({ ok: false, error: 'fetch failed' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [item.mission_id])

  const alertLevel = data?.alert_level ?? 'none'

  return (
    <li
      className={cn(
        'rounded-lg border bg-paper px-3 py-3',
        alertLevel === 'warning' && 'border-accent-warm/40',
        alertLevel === 'info' && 'border-rule/60',
        alertLevel === 'none' && 'border-rule/60',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 shrink-0">
          {loading ? (
            <Loader2 className="size-4 animate-spin text-ink-mute" aria-hidden />
          ) : alertLevel === 'warning' ? (
            <AlertCircle className="size-4 text-accent-warm" aria-hidden />
          ) : alertLevel === 'info' && data?.has_recent_dpe ? (
            <AlertCircle className="size-4 text-accent-blue" aria-hidden />
          ) : (
            <CheckCircle2 className="size-4 text-accent-green" aria-hidden />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <MapPin className="size-3 text-ink-mute shrink-0" aria-hidden />
            <p className="text-[13px] font-medium text-ink truncate">{item.address}</p>
          </div>

          {loading ? (
            <p className="font-mono text-[10px] text-ink-mute">Vérification ADEME…</p>
          ) : data?.error ? (
            <p className="font-mono text-[10px] text-ink-mute">Vérification indisponible.</p>
          ) : data?.has_recent_dpe ? (
            <p className="text-[12px] text-ink-soft leading-relaxed">
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-mute">
                DPE existant {data.previous_class ?? '?'} ·{' '}
                {data.days_since_previous != null
                  ? `il y a ${data.days_since_previous}j`
                  : 'récent'}
              </span>
              {data.user_message ? (
                <span className="block mt-1 text-ink-soft">{data.user_message}</span>
              ) : null}
            </p>
          ) : (
            <p className="text-[12px] text-ink-mute">Aucun DPE récent détecté sur ce bien.</p>
          )}
        </div>

        <Link
          href={`/dashboard/dossiers/${item.mission_id}/mission`}
          className="shrink-0 text-ink-mute hover:text-ink"
          aria-label="Ouvrir la mission"
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </li>
  )
}
