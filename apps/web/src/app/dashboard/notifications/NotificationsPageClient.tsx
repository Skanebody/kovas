'use client'

/**
 * Page Notifications — client component pour mark-as-read.
 *
 * Réutilise `<NotificationsList />` + `<NotificationsActionBar />` du
 * popover header, sans cap de limite et sans lien "Voir tout".
 */

import {
  NotificationsActionBar,
  NotificationsList,
} from '@/components/dashboard/NotificationsPopover'
import type { Notification } from '@/lib/notifications/types'
import { useCallback, useMemo, useState } from 'react'

interface NotificationsPageClientProps {
  initialNotifications: readonly Notification[]
}

export function NotificationsPageClient({ initialNotifications }: NotificationsPageClientProps) {
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    const init = new Set<string>()
    for (const n of initialNotifications) {
      if (n.readAt !== null) init.add(n.id)
    }
    return init
  })

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

  return (
    <div className="flex flex-col">
      <NotificationsActionBar unreadCount={unreadCount} onMarkAllRead={handleMarkAllRead} />
      <NotificationsList notifications={notifications} onMarkRead={handleMarkRead} />
    </div>
  )
}
