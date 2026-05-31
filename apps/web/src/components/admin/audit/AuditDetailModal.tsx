'use client'

/**
 * Modal détaillé d'une row audit_log.
 * Affiche tous les champs incl. payload / previous_state / new_state en JSON.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AuditLogRow } from '@/lib/admin/audit-types'

interface AuditDetailModalProps {
  row: AuditLogRow | null
  onClose: () => void
}

function PayloadBlock({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null
  const isEmpty =
    typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0
  if (isEmpty) return null
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-ink-mute">{label}</p>
      <pre className="mt-1 rounded-md border border-rule bg-paper-soft p-2 text-[11px] font-mono text-ink overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

export function AuditDetailModal({ row, onClose }: AuditDetailModalProps) {
  return (
    <Dialog open={row !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        {row ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[12px]">{row.action_type}</span>
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-pill ${
                    row.succeeded ? 'bg-emerald-100 text-emerald-800' : 'bg-danger/20 text-danger'
                  }`}
                >
                  {row.succeeded ? '✓ Succès' : '✗ Échec'}
                </span>
              </DialogTitle>
              <DialogDescription>
                {new Date(row.created_at).toLocaleString('fr-FR')} · source {row.action_source}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-ink-mute">
                    Admin
                  </p>
                  <p className="text-ink">{row.admin_email ?? row.admin_user_id}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-ink-mute">
                    Target
                  </p>
                  <p className="text-ink">
                    {row.target_type ?? '—'}
                    {row.target_id ? (
                      <span className="text-ink-faint"> · {row.target_id}</span>
                    ) : null}
                  </p>
                  {row.target_label ? (
                    <p className="text-ink-mute text-[11px]">{row.target_label}</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-ink-mute">IP</p>
                  <p className="text-ink font-mono text-[11px]">{row.ip_address ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-ink-mute">
                    User-Agent
                  </p>
                  <p className="text-ink-mute text-[11px] truncate" title={row.user_agent ?? ''}>
                    {row.user_agent ?? '—'}
                  </p>
                </div>
              </div>

              {row.error_message ? (
                <div className="rounded-md border border-danger/30 bg-danger/5 p-2">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-danger">
                    Error message
                  </p>
                  <p className="mt-1 text-[12px] text-danger">{row.error_message}</p>
                </div>
              ) : null}

              <PayloadBlock label="Payload" value={row.payload} />
              <PayloadBlock label="Previous state" value={row.previous_state} />
              <PayloadBlock label="New state" value={row.new_state} />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
