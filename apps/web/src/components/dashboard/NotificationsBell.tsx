'use client'

/**
 * NotificationsBell — Notifications Center général (pattern Linear).
 *
 * Cloche header dashboard + popover liste 10 dernières notifications.
 *
 * Spec V1 :
 * — Bouton cloche `aria-haspopup="dialog"` + badge count chartreuse si > 0
 * — Au clic → popover Radix DropdownMenu (aligné à droite, sideOffset 8px)
 * — Liste des 10 dernières notifs (titre, catégorie, timestamp relatif FR)
 * — Bouton "Tout marquer comme lu"
 * — Footer "Voir toutes les notifications" → /dashboard/notifications
 * — ESC ferme (géré par Radix), focus trap basique (géré par Radix)
 *
 * Distinct du badge réglementaire dédié `<RegulatoryNotificationsBadge />`
 * qui pointe directement vers /dashboard/veille (cf. layout dashboard).
 *
 * Data source V1 : props `initialNotifications` injectées par le serveur
 * (mock statique). V1.1 : SWR + endpoint `/api/notifications` adossé à
 * une vue PostgreSQL `app_notifications` côté Supabase.
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Notification } from '@/lib/notifications/types'
import { cn } from '@/lib/utils'
import { Bell } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { NotificationsActionBar, NotificationsList } from './NotificationsPopover'

interface NotificationsBellProps {
  /** Notifications initiales (server-injected en V1). */
  initialNotifications: readonly Notification[]
  /** Limite affichée dans le popover (par défaut 10). */
  popoverLimit?: number
  className?: string
}

export function NotificationsBell({
  initialNotifications,
  popoverLimit = 10,
  className,
}: NotificationsBellProps) {
  // État local : mark as read côté client (V1 — pas de mutation serveur).
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const n of initialNotifications) {
      if (n.readAt !== null) initial.add(n.id)
    }
    return initial
  })

  // Dérivation : applique les readIds sur le dataset initial.
  const notifications = useMemo<readonly Notification[]>(() => {
    return initialNotifications.map((n) => {
      if (readIds.has(n.id) && n.readAt === null) {
        return { ...n, readAt: new Date().toISOString() }
      }
      return n
    })
  }, [initialNotifications, readIds])

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.readAt === null).length,
    [notifications],
  )

  const handleMarkRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const handleMarkAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev)
      for (const n of initialNotifications) next.add(n.id)
      return next
    })
  }, [initialNotifications])

  const hasUnread = unreadCount > 0
  const ariaLabel = hasUnread
    ? `Notifications (${unreadCount} non lue${unreadCount > 1 ? 's' : ''})`
    : 'Notifications'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          className={cn(
            'relative inline-flex items-center justify-center size-10 rounded-full',
            'text-ink-mute hover:text-ink hover:bg-ink/5 transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chartreuse/60',
            className,
          )}
        >
          <Bell className="size-4" strokeWidth={1.5} />
          {hasUnread && (
            <span
              aria-hidden
              className={cn(
                'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1',
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
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        // Override min-width par défaut (32) + padding (1) pour popover liste.
        className="w-[380px] max-w-[calc(100vw-2rem)] p-0 border-rule shadow-glass-sm"
      >
        {/* Header popover */}
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rule/60">
          <h2 className="text-[13px] font-bold text-ink flex items-center gap-2">
            <Bell className="size-3.5 text-ink-mute" strokeWidth={1.5} />
            Notifications
          </h2>
          {hasUnread && (
            <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-ink-mute">
              {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
            </span>
          )}
        </header>

        <NotificationsActionBar unreadCount={unreadCount} onMarkAllRead={handleMarkAllRead} />

        {/* Liste */}
        <div className="max-h-[380px] overflow-y-auto">
          <NotificationsList
            notifications={notifications}
            onMarkRead={handleMarkRead}
            limit={popoverLimit}
            showSeeAll
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
