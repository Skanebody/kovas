'use client'

import { cn } from '@/lib/utils'
import { pendingCount, listPending, retry, discard, unresolvedConflictsCount } from '@/lib/sync/queue'
import type { MutationRow } from '@/lib/sync/db'
import { setupAutoSync } from '@/lib/sync/sync'
import { toast } from '@/components/ui/toaster'
import { CheckCircle2, CloudOff, RefreshCw, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface SyncIndicatorProps {
  organizationId: string
  className?: string
}

/**
 * SyncIndicator — pastille discret dans le header app avec count des
 * mutations en attente de sync. Click ouvre un panneau (popover ou bottom
 * sheet) avec détail de la queue, conflits, et options retry/discard.
 *
 * Visible UNIQUEMENT si count > 0 ou si conflicts > 0.
 * En idle (queue vide + online), rien affiché — l'OfflineBanner gère
 * déjà l'indication "hors ligne" globale.
 *
 * Spec : CLAUDE.md §3 feature #10 + doc wireframes v4 §14.3 (badge sidebar).
 */
export function SyncIndicator({ organizationId, className }: SyncIndicatorProps) {
  const [pending, setPending] = useState(0)
  const [conflicts, setConflicts] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<MutationRow[]>([])

  // Setup auto-sync au mount
  useEffect(() => {
    if (!organizationId) return
    const teardown = setupAutoSync(organizationId)

    function refreshCounts() {
      void pendingCount(organizationId).then(setPending)
      void unresolvedConflictsCount().then(setConflicts)
    }

    refreshCounts()
    const interval = window.setInterval(refreshCounts, 5_000)

    function handleSyncComplete(e: Event) {
      const detail = (e as CustomEvent).detail as { succeeded: number }
      if (detail.succeeded > 0) {
        toast.success(
          `${detail.succeeded} modification${detail.succeeded > 1 ? 's' : ''} synchronisée${detail.succeeded > 1 ? 's' : ''}`,
        )
      }
      refreshCounts()
    }
    window.addEventListener('kovas:sync:complete', handleSyncComplete)

    return () => {
      teardown()
      window.clearInterval(interval)
      window.removeEventListener('kovas:sync:complete', handleSyncComplete)
    }
  }, [organizationId])

  useEffect(() => {
    if (!open) return
    void listPending(organizationId).then(setItems)
  }, [open, organizationId])

  if (pending === 0 && conflicts === 0) return null

  const hasConflicts = conflicts > 0
  const label = hasConflicts
    ? `${conflicts} conflit${conflicts > 1 ? 's' : ''}`
    : `${pending} en attente`

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors',
          hasConflicts
            ? 'bg-danger/15 text-danger hover:bg-danger/20'
            : 'bg-amber/15 text-amber hover:bg-amber/20',
          className,
        )}
        title={hasConflicts ? 'Conflits à résoudre' : 'Modifications en attente de sync'}
        aria-label={label}
      >
        <CloudOff className="size-3.5" strokeWidth={2} />
        <span>{label}</span>
      </button>

      {open && (
        <SyncPanel
          items={items}
          conflicts={conflicts}
          onClose={() => setOpen(false)}
          onRefresh={() => listPending(organizationId).then(setItems)}
        />
      )}
    </>
  )
}

function SyncPanel({
  items,
  conflicts,
  onClose,
  onRefresh,
}: {
  items: MutationRow[]
  conflicts: number
  onClose: () => void
  onRefresh: () => void
}) {
  async function handleRetry(id: number) {
    await retry(id)
    await onRefresh()
    toast.info('Mutation remise en file d\'attente')
  }

  async function handleDiscard(id: number) {
    if (!confirm('Abandonner définitivement cette modification ? Cette action est irréversible.')) return
    await discard(id)
    await onRefresh()
    toast.success('Mutation supprimée')
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="File de synchronisation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-rule bg-paper shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
          <div>
            <h2 className="font-semibold text-base text-ink">File de synchronisation</h2>
            <p className="text-xs text-ink-mute mt-0.5">
              {items.length} modification{items.length > 1 ? 's' : ''} en attente
              {conflicts > 0 && ` · ${conflicts} conflit${conflicts > 1 ? 's' : ''} à résoudre`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full hover:bg-ink/5 transition-colors"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-ink-mute">
              <CheckCircle2 className="size-8 mx-auto text-success mb-2" />
              Tout est synchronisé.
            </div>
          ) : (
            <ul className="divide-y divide-rule">
              {items.map((mut) => (
                <li key={mut.id} className="px-5 py-3 flex items-start gap-3">
                  <div
                    aria-hidden
                    className={cn(
                      'mt-1 size-2 rounded-full shrink-0',
                      mut.status === 'failed' ? 'bg-danger' : 'bg-amber animate-pulse',
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {labelForKind(mut.kind)}
                    </p>
                    <p className="text-[11px] font-mono text-ink-mute mt-0.5">
                      {new Date(mut.createdAt).toLocaleString('fr-FR')}
                      {mut.attempts > 0 && ` · ${mut.attempts} essai${mut.attempts > 1 ? 's' : ''}`}
                    </p>
                    {mut.lastError && (
                      <p className="text-[11px] text-danger mt-1">{mut.lastError}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {mut.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => mut.id && handleRetry(mut.id)}
                        className="flex size-8 items-center justify-center rounded-md hover:bg-ink/5 text-ink-mute hover:text-ink transition-colors"
                        aria-label="Réessayer"
                        title="Réessayer"
                      >
                        <RefreshCw className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => mut.id && handleDiscard(mut.id)}
                      className="flex size-8 items-center justify-center rounded-md hover:bg-danger/10 text-ink-mute hover:text-danger transition-colors"
                      aria-label="Abandonner"
                      title="Abandonner"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-rule bg-cream-deep/30">
          <p className="text-[11px] text-ink-mute">
            Les modifications sont synchronisées automatiquement au retour du réseau. Les blobs
            (photos, audio) sont stockés en local et envoyés en différé.
          </p>
        </div>
      </div>
    </div>
  )
}

function labelForKind(kind: string): string {
  const labels: Record<string, string> = {
    create_dossier: 'Création de dossier',
    update_dossier: 'Modification de dossier',
    create_mission: 'Création de mission',
    update_mission_status: 'Changement de statut mission',
    create_room: 'Ajout de pièce',
    update_room: 'Modification de pièce',
    delete_room: 'Suppression de pièce',
    add_photo: 'Ajout de photo',
    delete_photo: 'Suppression de photo',
    add_voice_note: 'Note vocale',
    delete_voice_note: 'Suppression note vocale',
    toggle_checklist_item: 'Validation checklist',
    update_owner_document: 'Document propriétaire',
  }
  return labels[kind] ?? kind
}
