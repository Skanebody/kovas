'use client'

import { type SyncState, useSyncStatus } from '@/lib/hooks/use-sync-status'
import type { MutationRow } from '@/lib/sync/db'
import { cn } from '@/lib/utils'
import { Check, Loader2, WifiOff } from 'lucide-react'
import { forwardRef, useEffect, useRef, useState } from 'react'

/**
 * SyncStatusBadge — indicateur permanent de fiabilité (Walter L2 Reliable).
 *
 * Toujours visible dans le header dashboard, 3 états :
 *  - synced  : "✓ Sync" sage discret (état nominal — la stabilité visible rassure)
 *  - syncing : "Sync en cours · N" avec Loader2 spin (ambre soft)
 *  - offline : "Hors-ligne · N en attente" (ambre soft) — réseau perdu, queue conservée
 *
 * Au clic : popover liste les items en attente (mission/dossier/photo/etc.).
 * Source signal : lib/sync/queue.ts (Dexie/IndexedDB) + navigator.onLine.
 *
 * Spec DS v5 : sage/navy/chartreuse uniquement. Le tick "Sync" utilise
 * `text-success` (vert sémantique sage-compatible) au lieu de chartreuse
 * pour rester sobre — la chartreuse reste réservée aux célébrations
 * (validation IA, conversion). L'animation pulse n'est appliquée qu'en
 * "syncing" et respecte `prefers-reduced-motion`.
 */

interface SyncStatusBadgeProps {
  organizationId: string
  className?: string
}

const STATE_LABEL: Record<SyncState, string> = {
  synced: 'Données synchronisées',
  syncing: 'Synchronisation en cours',
  offline: 'Hors-ligne, synchronisation à la reconnexion',
}

export function SyncStatusBadge({ organizationId, className }: SyncStatusBadgeProps) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const { state, pending, items } = useSyncStatus({
    organizationId,
    fetchDetails: open,
  })

  // Fermeture popover : clic dehors + Escape
  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent): void {
      const target = e.target as Node
      if (popoverRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setOpen(false)
    }

    function handleEscape(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const ariaLabel =
    state === 'synced'
      ? STATE_LABEL.synced
      : `${STATE_LABEL[state]} — ${pending} ${pending > 1 ? 'éléments' : 'élément'} en attente`

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-live="polite"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          state === 'synced' &&
            'bg-sage text-ink-soft hover:bg-sage-alt focus-visible:ring-success/40',
          state === 'syncing' &&
            'bg-amber/15 text-amber hover:bg-amber/20 focus-visible:ring-amber/40',
          state === 'offline' &&
            'bg-amber/15 text-amber hover:bg-amber/20 focus-visible:ring-amber/40',
        )}
      >
        <BadgeIcon state={state} />
        <BadgeLabel state={state} pending={pending} />
      </button>

      {open && (
        <SyncDetailsPopover ref={popoverRef} state={state} pending={pending} items={items} />
      )}
    </div>
  )
}

function BadgeIcon({ state }: { state: SyncState }) {
  if (state === 'synced') {
    return (
      <span aria-hidden className="inline-flex items-center justify-center">
        <Check className="size-3 text-success" strokeWidth={2.5} />
      </span>
    )
  }
  if (state === 'syncing') {
    return (
      <span
        aria-hidden
        className="inline-flex items-center justify-center motion-safe:animate-spin"
      >
        <Loader2 className="size-3" strokeWidth={2.5} />
      </span>
    )
  }
  return (
    <span aria-hidden className="inline-flex items-center justify-center">
      <WifiOff className="size-3" strokeWidth={2.5} />
    </span>
  )
}

function BadgeLabel({ state, pending }: { state: SyncState; pending: number }) {
  if (state === 'synced') return <span>Sync</span>
  if (state === 'syncing') {
    return (
      <span>
        Sync en cours
        {pending > 0 && (
          <>
            {' '}
            · <span className="font-mono">{pending}</span>
          </>
        )}
      </span>
    )
  }
  return (
    <span>
      Hors-ligne
      {pending > 0 && (
        <>
          {' '}
          · <span className="font-mono">{pending}</span> en attente
        </>
      )}
    </span>
  )
}

// --- Popover détail ---

interface SyncDetailsPopoverProps {
  state: SyncState
  pending: number
  items: MutationRow[]
}

const SyncDetailsPopover = forwardRef<HTMLElement, SyncDetailsPopoverProps>(
  function SyncDetailsPopover({ state, pending, items }, ref) {
    return (
      <section
        ref={ref}
        aria-label="Détail de la synchronisation"
        className={cn(
          'absolute right-0 top-[calc(100%+8px)] z-40 w-80 max-w-[calc(100vw-2rem)]',
          'rounded-xl border border-[#0F1419]/[0.08] bg-paper shadow-lg',
          'animate-in fade-in-0 zoom-in-95',
        )}
      >
        <div className="px-4 py-3 border-b border-[#0F1419]/[0.06]">
          <p className="text-sm font-semibold text-ink">
            {state === 'synced' && 'Tout est synchronisé'}
            {state === 'syncing' && 'Synchronisation en cours'}
            {state === 'offline' && 'Hors-ligne'}
          </p>
          <p className="text-xs text-ink-mute mt-0.5">
            {state === 'synced' && 'Vos données sont à jour sur le serveur.'}
            {state === 'syncing' && (
              <>
                {pending} {pending > 1 ? 'éléments' : 'élément'} en cours d&apos;envoi.
              </>
            )}
            {state === 'offline' && (
              <>
                Connexion réseau perdue.{' '}
                {pending > 0
                  ? `${pending} ${pending > 1 ? 'modifications seront' : 'modification sera'} synchronisée${pending > 1 ? 's' : ''} au retour du réseau.`
                  : "Vos prochaines modifications seront mises en file d'attente."}
              </>
            )}
          </p>
        </div>

        {items.length > 0 && (
          <ul className="max-h-64 overflow-y-auto divide-y divide-[#0F1419]/[0.06]">
            {items.slice(0, 12).map((mut) => (
              <li key={mut.id ?? mut.clientId} className="px-4 py-2.5 flex items-start gap-2.5">
                <span
                  aria-hidden
                  className={cn(
                    'mt-1.5 size-1.5 rounded-full shrink-0',
                    mut.status === 'failed' ? 'bg-danger' : 'bg-amber',
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-ink truncate">{labelForKind(mut.kind)}</p>
                  <p className="text-[10px] font-mono text-ink-mute mt-0.5">
                    {new Date(mut.createdAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </li>
            ))}
            {items.length > 12 && (
              <li className="px-4 py-2 text-[11px] text-ink-mute text-center">
                + {items.length - 12} autre{items.length - 12 > 1 ? 's' : ''}…
              </li>
            )}
          </ul>
        )}

        {state !== 'synced' && items.length === 0 && pending > 0 && (
          <div className="px-4 py-3 text-xs text-ink-mute">Chargement du détail…</div>
        )}
      </section>
    )
  },
)

// Labels métier — aligné avec sync-indicator.tsx pour cohérence.
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
