'use client'

import { cn } from '@/lib/utils'
import { Bell, CheckCheck, Settings, X } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

/* ----------------------------------------------------------------------- */
/* Types                                                                    */
/* ----------------------------------------------------------------------- */

export interface NotificationItem {
  id: string
  title: string
  body?: string
  /** ISO 8601. */
  createdAt: string
  read: boolean
  /** URL de destination quand on clique. */
  href?: string
  /** Catégorie pour groupage léger. */
  category?: 'mission' | 'facturation' | 'systeme' | 'rappel'
}

interface NotificationsDrawerProps {
  /** Notifications à afficher (ordre quelconque — tri chronologique inverse géré). */
  notifications: readonly NotificationItem[]
  /** Callback pour marquer une notif comme lue. */
  onMarkRead?: (id: string) => void
  /** Callback "tout marquer lu". */
  onMarkAllRead?: () => void
  /** Si fourni, le composant gère lui-même son trigger (cloche header). Sinon controlled. */
  controlled?: {
    open: boolean
    onOpenChange: (open: boolean) => void
  }
}

/* ----------------------------------------------------------------------- */
/* Hook : count non lues                                                    */
/* ----------------------------------------------------------------------- */

function useUnreadCount(notifications: readonly NotificationItem[]): number {
  return notifications.filter((n) => !n.read).length
}

/* ----------------------------------------------------------------------- */
/* Composant principal                                                      */
/* ----------------------------------------------------------------------- */

/**
 * NotificationsDrawer — Cloche header + drawer latéral.
 *
 * Spec V5 simplification radicale :
 * — Cloche Bell + badge count (chartreuse non-zero, gris zero)
 * — Au clic → drawer slide from right 400px desktop, fullscreen mobile
 * — Liste chronologique inverse, lue=opacity 40%, non lue=dot chartreuse 8px
 * — Click notif → href + mark as read
 * — Footer drawer : "Tout marquer lu" + lien paramètres
 *
 * Mode controlled : le parent fournit open/onOpenChange. Sinon, le composant
 * affiche aussi son propre bouton cloche en uncontrolled.
 */
export function NotificationsDrawer({
  notifications,
  onMarkRead,
  onMarkAllRead,
  controlled,
}: NotificationsDrawerProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlled?.open ?? internalOpen
  const setOpen = controlled?.onOpenChange ?? setInternalOpen

  const unreadCount = useUnreadCount(notifications)

  // Trie chronologique inverse (plus récent d'abord)
  const sorted = [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  // Bind Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  const handleNotifClick = useCallback(
    (notif: NotificationItem) => {
      if (!notif.read) onMarkRead?.(notif.id)
      setOpen(false)
    },
    [onMarkRead, setOpen],
  )

  return (
    <>
      {/* Bouton cloche uncontrolled */}
      {!controlled && <NotificationsBell unreadCount={unreadCount} onClick={() => setOpen(true)} />}

      {/* Drawer */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Notifications"
          className="fixed inset-0 z-[90]"
        >
          {/* Overlay */}
          <button
            type="button"
            aria-label="Fermer le panneau notifications"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
          />

          {/* Drawer panel */}
          <aside
            className={cn(
              'absolute right-0 top-0 bottom-0',
              'w-full sm:w-[400px]',
              'bg-paper border-l border-sidebar-bg/15',
              'flex flex-col',
              'animate-fade-in',
            )}
          >
            {/* Header */}
            <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-sidebar-bg/10">
              <h2 className="text-[15px] font-bold text-ink flex items-center gap-2">
                <Bell className="size-4 text-ink-mute" strokeWidth={1.5} />
                Notifications
                {unreadCount > 0 && (
                  <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-mute">
                    {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="text-ink-mute hover:text-ink p-1"
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </header>

            {/* Action bar : tout marquer lu */}
            {unreadCount > 0 && onMarkAllRead && (
              <div className="px-4 py-2 border-b border-sidebar-bg/10">
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute hover:text-ink transition-colors"
                >
                  <CheckCheck className="size-3.5" strokeWidth={1.5} />
                  Tout marquer lu
                </button>
              </div>
            )}

            {/* Liste */}
            <div className="flex-1 overflow-y-auto">
              {sorted.length === 0 ? (
                <EmptyState />
              ) : (
                <ul className="divide-y divide-sidebar-bg/10">
                  {sorted.map((notif) => (
                    <NotificationRow
                      key={notif.id}
                      notification={notif}
                      onClick={() => handleNotifClick(notif)}
                    />
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <footer className="border-t border-sidebar-bg/10 px-4 py-3">
              <Link
                href="/dashboard/account?tab=notifications"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute hover:text-ink transition-colors"
              >
                <Settings className="size-3.5" strokeWidth={1.5} />
                Paramètres notifications
              </Link>
            </footer>
          </aside>
        </div>
      )}
    </>
  )
}

/* ----------------------------------------------------------------------- */
/* Cloche header (composant standalone)                                     */
/* ----------------------------------------------------------------------- */

interface NotificationsBellProps {
  unreadCount: number
  onClick: () => void
  className?: string
}

/**
 * Cloche notifications avec badge count. À placer dans le header app.
 */
export function NotificationsBell({ unreadCount, onClick, className }: NotificationsBellProps) {
  const hasUnread = unreadCount > 0
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hasUnread ? `Notifications (${unreadCount} non lues)` : 'Notifications'}
      className={cn(
        'relative inline-flex items-center justify-center size-9 rounded-full',
        'text-ink-mute hover:text-ink hover:bg-sage transition-colors',
        className,
      )}
    >
      <Bell className="size-[18px]" strokeWidth={1.5} />
      {hasUnread && (
        <span
          aria-hidden
          className={cn(
            'absolute top-1 right-1 min-w-[18px] h-[18px] px-1',
            'inline-flex items-center justify-center',
            'bg-chartreuse text-ink',
            'text-[10px] font-mono font-bold rounded-full',
            'border border-paper',
          )}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}

/* ----------------------------------------------------------------------- */
/* Sous-composants                                                          */
/* ----------------------------------------------------------------------- */

function NotificationRow({
  notification,
  onClick,
}: {
  notification: NotificationItem
  onClick: () => void
}) {
  const dateLabel = formatRelative(notification.createdAt)

  const content = (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 transition-colors',
        notification.read ? 'opacity-40' : 'opacity-100',
        'hover:bg-sage',
      )}
    >
      {/* Dot non-lu chartreuse 8px */}
      <span
        aria-hidden
        className={cn(
          'mt-1.5 size-2 shrink-0 rounded-full',
          notification.read ? 'bg-transparent' : 'bg-chartreuse',
        )}
      />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-ink leading-snug">{notification.title}</p>
        {notification.body && (
          <p className="mt-0.5 text-[12px] text-ink-mute leading-relaxed line-clamp-2">
            {notification.body}
          </p>
        )}
        <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.08em] text-ink-faint">
          {dateLabel}
        </p>
      </div>
    </div>
  )

  if (notification.href) {
    return (
      <li>
        <Link href={notification.href} onClick={onClick} className="block">
          {content}
        </Link>
      </li>
    )
  }

  return (
    <li>
      <button type="button" onClick={onClick} className="block w-full text-left">
        {content}
      </button>
    </li>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center">
      <Bell className="size-8 text-ink-faint" strokeWidth={1.5} />
      <p className="text-sm text-ink-mute">Pas de notification pour l&apos;instant</p>
      <p className="text-[11px] text-ink-faint">
        Vous serez notifié des rappels et événements importants
      </p>
    </div>
  )
}

/* ----------------------------------------------------------------------- */
/* Helpers                                                                  */
/* ----------------------------------------------------------------------- */

/** Format relatif court : "il y a 3 min", "il y a 2h", "hier", "12 mai". */
function formatRelative(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `Il y a ${diffMin} min`
  if (diffH < 24) return `Il y a ${diffH}h`
  if (diffD === 1) return 'Hier'
  if (diffD < 7) return `Il y a ${diffD}j`

  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', timeZone: 'Europe/Paris' })
}

/* ----------------------------------------------------------------------- */
/* Toast undo helper (sonner wrapper)                                       */
/* ----------------------------------------------------------------------- */

/**
 * Toast avec bouton "Annuler" pour actions destructives (suppression, archivage).
 * Auto-dismiss 4s, bouton undo si fourni.
 *
 * Usage :
 * ```ts
 * import { toastUndo } from '@/components/notifications/NotificationsDrawer'
 * toastUndo('Dossier supprimé', { undo: () => restoreDossier(id) })
 * ```
 */
// Note : implémenté dans `lib/toast-undo.ts` pour éviter import cyclique
