'use client'

import { KIND_LABEL, formatRelative } from '@/lib/notifications/format'
import type { Notification } from '@/lib/notifications/types'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  FileWarning,
  Inbox,
  Receipt,
  Scale,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'

/* ----------------------------------------------------------------------- */
/* Icône par catégorie                                                      */
/* ----------------------------------------------------------------------- */

function KindIcon({ kind }: { kind: Notification['kind'] }) {
  const cls = 'size-3.5'
  const strokeWidth = 1.5
  switch (kind) {
    case 'lead_directory':
      return <Inbox className={cls} strokeWidth={strokeWidth} />
    case 'mission_completed':
      return <Sparkles className={cls} strokeWidth={strokeWidth} />
    case 'ademe_alert':
      return <AlertTriangle className={cls} strokeWidth={strokeWidth} />
    case 'invoice_overdue':
      return <Receipt className={cls} strokeWidth={strokeWidth} />
    case 'regulatory_update':
      return <Scale className={cls} strokeWidth={strokeWidth} />
    case 'system':
      return <FileWarning className={cls} strokeWidth={strokeWidth} />
    default:
      return <Bell className={cls} strokeWidth={strokeWidth} />
  }
}

/* ----------------------------------------------------------------------- */
/* Row                                                                      */
/* ----------------------------------------------------------------------- */

interface NotificationRowProps {
  notification: Notification
  onActivate?: (id: string) => void
}

function NotificationRow({ notification, onActivate }: NotificationRowProps) {
  const isUnread = notification.readAt === null
  const dateLabel = formatRelative(notification.createdAt)
  const categoryLabel = KIND_LABEL[notification.kind]

  const content = (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 transition-colors',
        'hover:bg-sage focus-visible:bg-sage',
        !isUnread && 'opacity-60',
      )}
    >
      {/* Dot non-lu chartreuse 8px — accent unique DS v5 */}
      <span
        aria-hidden
        className={cn(
          'mt-1.5 size-2 shrink-0 rounded-full',
          isUnread ? 'bg-chartreuse' : 'bg-transparent',
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-ink-mute mb-0.5">
          <KindIcon kind={notification.kind} />
          <span className="text-[10px] font-mono uppercase tracking-[0.08em]">{categoryLabel}</span>
        </div>
        <p className="text-[13px] font-semibold text-ink leading-snug">{notification.title}</p>
        {notification.message && (
          <p className="mt-0.5 text-[12px] text-ink-mute leading-relaxed line-clamp-2">
            {notification.message}
          </p>
        )}
        <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.08em] text-ink-faint">
          {dateLabel}
        </p>
      </div>
    </div>
  )

  const handleClick = (): void => {
    if (isUnread) onActivate?.(notification.id)
  }

  if (notification.href) {
    return (
      <li>
        <Link
          href={notification.href}
          onClick={handleClick}
          className="block focus-visible:outline-none"
        >
          {content}
        </Link>
      </li>
    )
  }

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className="block w-full text-left focus-visible:outline-none"
      >
        {content}
      </button>
    </li>
  )
}

/* ----------------------------------------------------------------------- */
/* Empty                                                                    */
/* ----------------------------------------------------------------------- */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
      <Bell className="size-7 text-ink-faint" strokeWidth={1.5} />
      <p className="text-sm text-ink-mute">Aucune notification</p>
      <p className="text-[11px] text-ink-faint">
        Vous serez alerté ici des leads, missions et événements importants.
      </p>
    </div>
  )
}

/* ----------------------------------------------------------------------- */
/* Liste réutilisable (popover + page)                                      */
/* ----------------------------------------------------------------------- */

interface NotificationsListProps {
  notifications: readonly Notification[]
  onMarkRead?: (id: string) => void
  /** Pour le popover : limite à N + lien "Voir tout". Undefined = pas de cap. */
  limit?: number
  /** Affiche le footer "Voir toutes les notifications" (popover only). */
  showSeeAll?: boolean
}

export function NotificationsList({
  notifications,
  onMarkRead,
  limit,
  showSeeAll = false,
}: NotificationsListProps) {
  // Tri chronologique inverse (plus récent d'abord).
  const sorted = [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const displayed = typeof limit === 'number' ? sorted.slice(0, limit) : sorted

  if (displayed.length === 0) {
    return <EmptyState />
  }

  return (
    <>
      <ul className="divide-y divide-rule/60">
        {displayed.map((n) => (
          <NotificationRow key={n.id} notification={n} onActivate={onMarkRead} />
        ))}
      </ul>
      {showSeeAll && sorted.length > 0 && (
        <div className="border-t border-rule/60 px-4 py-2.5 text-center">
          <Link
            href="/dashboard/notifications"
            className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute hover:text-ink transition-colors"
          >
            Voir toutes les notifications
          </Link>
        </div>
      )}
    </>
  )
}

/* ----------------------------------------------------------------------- */
/* Bandeau actions (utilisé par popover + page)                             */
/* ----------------------------------------------------------------------- */

interface NotificationsActionBarProps {
  unreadCount: number
  onMarkAllRead?: () => void
}

export function NotificationsActionBar({
  unreadCount,
  onMarkAllRead,
}: NotificationsActionBarProps) {
  if (unreadCount === 0 || !onMarkAllRead) return null
  return (
    <div className="px-4 py-2 border-b border-rule/60">
      <button
        type="button"
        onClick={onMarkAllRead}
        className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute hover:text-ink transition-colors"
      >
        <CheckCheck className="size-3.5" strokeWidth={1.5} />
        Tout marquer comme lu
      </button>
    </div>
  )
}
