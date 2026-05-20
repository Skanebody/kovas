'use client'

/**
 * Table audit log avec pagination cursor-based + click row → AuditDetailModal.
 */

import { Card } from '@/components/ui/card'
import { AUDIT_PAGE_SIZE, type AuditLogRow } from '@/lib/admin/audit-types'
import { Bot, Globe, MessageSquare, Server, Terminal } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { AuditDetailModal } from './AuditDetailModal'

interface AuditLogTableProps {
  rows: AuditLogRow[]
  /** True s'il existe une page suivante (rows.length === AUDIT_PAGE_SIZE). */
  hasMore: boolean
  /** True s'il existe une page précédente. */
  hasPrev: boolean
  /** Cursor created_at de la dernière row (pour Next). */
  nextCursor: string | null
  /** Cursor created_at de la première row (pour Prev). */
  prevCursor: string | null
}

const SOURCE_ICONS: Record<string, typeof Globe> = {
  dashboard_web: Globe,
  telegram_bot_command: Bot,
  telegram_bot_button: MessageSquare,
  telegram_bot_nlp: MessageSquare,
  system_automated: Server,
  cli: Terminal,
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })
}

function previewPayload(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload)
  if (keys.length === 0) return '—'
  return keys
    .slice(0, 3)
    .map((k) => {
      const v = payload[k]
      const str = typeof v === 'string' ? v : JSON.stringify(v)
      return `${k}=${str.slice(0, 30)}`
    })
    .join(' · ')
}

export function AuditLogTable({
  rows,
  hasMore,
  hasPrev,
  nextCursor,
  prevCursor,
}: AuditLogTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<AuditLogRow | null>(null)

  const navigate = (cursor: string | null, direction: 'next' | 'prev') => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('cursor')
    params.delete('cursor_dir')
    if (cursor) {
      params.set('cursor', cursor)
      params.set('cursor_dir', direction)
    }
    router.push(`/admin/audit${params.toString() ? `?${params.toString()}` : ''}`)
  }

  return (
    <Card variant="opaque" padding="default" className="space-y-3">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          📋 {rows.length} entries · page {AUDIT_PAGE_SIZE} max
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-mute italic">Aucune entry ne correspond aux filtres.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-rule text-left text-ink-mute font-mono uppercase tracking-wider text-[10px]">
                <th className="py-2 pr-3">Timestamp</th>
                <th className="py-2 pr-3">Admin</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Target</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Payload</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const Icon = SOURCE_ICONS[r.action_source] ?? Globe
                return (
                  <tr
                    key={r.id}
                    className="border-b border-rule/40 hover:bg-paper-soft cursor-pointer focus-visible:outline-none focus-visible:bg-paper-soft"
                    tabIndex={0}
                    onClick={() => setSelected(r)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelected(r)
                      }
                    }}
                  >
                    <td className="py-2 pr-3 text-ink-mute whitespace-nowrap font-mono text-[11px]">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="py-2 pr-3 text-ink truncate max-w-[160px]">
                      {r.admin_email ?? r.admin_user_id.slice(0, 8)}
                    </td>
                    <td className="py-2 pr-3 text-ink font-mono text-[11px]">{r.action_type}</td>
                    <td className="py-2 pr-3 text-ink-mute">
                      <span className="inline-flex items-center gap-1" title={r.action_source}>
                        <Icon className="size-3" aria-hidden />
                        <span className="hidden md:inline">
                          {r.action_source.replace(/_/g, ' ')}
                        </span>
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-ink-mute truncate max-w-[200px]">
                      {r.target_type ? (
                        <span>
                          <span className="font-mono text-[10px] text-ink-faint">
                            {r.target_type}
                          </span>{' '}
                          <span title={r.target_label ?? r.target_id ?? ''}>
                            {r.target_label ?? r.target_id ?? '—'}
                          </span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-pill ${
                          r.succeeded
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-danger/20 text-danger'
                        }`}
                      >
                        {r.succeeded ? 'ok' : 'fail'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-ink-faint font-mono text-[10px] truncate max-w-[260px]">
                      {previewPayload(r.payload)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px]">
        <button
          type="button"
          onClick={() => navigate(prevCursor, 'prev')}
          disabled={!hasPrev}
          className="rounded-pill border border-rule bg-paper px-3 py-1 text-ink hover:border-navy/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Précédent
        </button>
        <span className="text-ink-mute font-mono">cursor pagination</span>
        <button
          type="button"
          onClick={() => navigate(nextCursor, 'next')}
          disabled={!hasMore}
          className="rounded-pill border border-rule bg-paper px-3 py-1 text-ink hover:border-navy/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Suivant →
        </button>
      </div>

      <AuditDetailModal row={selected} onClose={() => setSelected(null)} />
    </Card>
  )
}
