'use client'

import { CollapsibleSection } from '@/components/ui/collapsible-section'
import type { HistoryItem, HistoryItemType } from '@/lib/dossier/types'
import { cn } from '@/lib/utils'
import {
  Camera,
  CheckCircle2,
  Clock,
  Download,
  History,
  type LucideIcon,
  MessageCircle,
  Mic,
  Pencil,
  Plus,
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface HistoryAccordionProps {
  dossierId: string
  /** Items préchargés (server-rendered) — si fourni, pas de fetch côté client. */
  initialItems?: HistoryItem[]
  /** URL de l'endpoint si différent de la valeur par défaut. */
  endpoint?: string
  defaultExpanded?: boolean
  className?: string
}

const ICON_BY_TYPE: Record<HistoryItemType, LucideIcon> = {
  created: Plus,
  updated: Pencil,
  photo: Camera,
  voice: Mic,
  export: Download,
  status_change: CheckCircle2,
  comment: MessageCircle,
}

/**
 * Accordion historique du dossier.
 *
 * - Si `initialItems` est passé, on l'utilise tel quel (rendu serveur OK).
 * - Sinon on fetch `/api/dossiers/[id]/history` à l'ouverture de l'accordion.
 *
 * L'endpoint est attendu mais peut ne pas exister encore (agent B) — dans
 * ce cas la liste reste vide avec un message empty-state.
 */
export function HistoryAccordion({
  dossierId,
  initialItems,
  endpoint,
  defaultExpanded = false,
  className,
}: HistoryAccordionProps) {
  const [items, setItems] = useState<HistoryItem[]>(initialItems ?? [])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [hasFetched, setHasFetched] = useState<boolean>(!!initialItems)

  const url = endpoint ?? `/api/dossiers/${encodeURIComponent(dossierId)}/history`

  useEffect(() => {
    if (hasFetched) return
    if (!defaultExpanded) return

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(url, { method: 'GET', credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: unknown = await res.json()
        if (cancelled) return
        const parsed = parseHistoryPayload(data)
        setItems(parsed)
        setHasFetched(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Erreur de chargement'
        setError(msg)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [url, defaultExpanded, hasFetched])

  const triggerLoad = (): void => {
    if (hasFetched || loading) return
    setLoading(true)
    setError(null)
    fetch(url, { method: 'GET', credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: unknown = await res.json()
        const parsed = parseHistoryPayload(data)
        setItems(parsed)
        setHasFetched(true)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Erreur de chargement'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }

  return (
    <div className={cn(className)} onMouseEnter={triggerLoad}>
      <CollapsibleSection
        storageKey={`kovas_dossier_${dossierId}_history_accordion`}
        defaultExpanded={defaultExpanded}
        title={
          <span className="flex items-center gap-2">
            <History aria-hidden className="size-4 text-ink-mute" />
            <span>Historique</span>
          </span>
        }
        meta={loading ? 'Chargement…' : `${items.length} événement${items.length > 1 ? 's' : ''}`}
      >
        {error ? (
          <p className="rounded-md bg-coral-mist/60 px-3 py-2 text-sm text-[#8B1414]">
            Impossible de charger l’historique : {error}
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-mute">Aucun événement enregistré.</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {items.map((it) => (
              <HistoryRow key={it.id} item={it} />
            ))}
          </ol>
        )}
      </CollapsibleSection>
    </div>
  )
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const Icon = ICON_BY_TYPE[item.type] ?? Clock
  return (
    <li className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-sage-alt/40">
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-sage-alt text-ink-mute"
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{item.label}</p>
        <p className="text-[11px] text-ink-mute">
          <time dateTime={item.ts}>{formatRelative(item.ts)}</time>
          {item.actor && <span aria-hidden> · {item.actor}</span>}
        </p>
      </div>
    </li>
  )
}

/**
 * Formate un timestamp ISO en relatif sobre ("il y a 5 min", "il y a 2 j").
 * Implémentation locale (pas de dep dayjs/luxon — CLAUDE.md "no new deps").
 */
function formatRelative(iso: string): string {
  const date = new Date(iso)
  const now = Date.now()
  const diffMs = now - date.getTime()
  if (Number.isNaN(diffMs)) return iso

  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return 'à l’instant'
  const min = Math.floor(sec / 60)
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  if (d < 30) return `il y a ${d} j`
  const m = Math.floor(d / 30)
  if (m < 12) return `il y a ${m} mois`
  const y = Math.floor(m / 12)
  return `il y a ${y} an${y > 1 ? 's' : ''}`
}

function parseHistoryPayload(raw: unknown): HistoryItem[] {
  if (!raw || typeof raw !== 'object') return []
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : []

  const result: HistoryItem[] = []
  for (const entry of arr) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const id = typeof e.id === 'string' ? e.id : null
    const type = typeof e.type === 'string' ? (e.type as HistoryItemType) : null
    const label = typeof e.label === 'string' ? e.label : null
    const ts = typeof e.ts === 'string' ? e.ts : null
    if (!id || !type || !label || !ts) continue
    const actor = typeof e.actor === 'string' ? e.actor : undefined
    result.push({ id, type, label, ts, actor })
  }
  return result
}
