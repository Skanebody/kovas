'use client'

/**
 * Badge compteur de notifications de veille non lues.
 *
 * À placer dans le header app (intégration ultérieure — ne pas modifier
 * app-sidebar.tsx pour le moment).
 *
 * Polling toutes les 60s + revalidation au focus de la fenêtre.
 */

import { Bell } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface NotifsCountResponse {
  unreadCount?: number
}

export function RegulatoryNotificationsBadge() {
  const [count, setCount] = useState<number>(0)

  useEffect(() => {
    let cancelled = false

    const fetchCount = async () => {
      try {
        const r = await fetch('/api/regulatory/notifications?unread=1&limit=1', {
          cache: 'no-store',
        })
        if (!r.ok) return
        const j = (await r.json()) as NotifsCountResponse
        if (!cancelled && typeof j.unreadCount === 'number') {
          setCount(j.unreadCount)
        }
      } catch {
        // Silencieux : pas critique.
      }
    }

    fetchCount()
    const interval = window.setInterval(fetchCount, 60_000)
    const onFocus = () => fetchCount()
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return (
    <Link
      href="/dashboard/veille"
      aria-label={
        count > 0
          ? `${count} nouvelle${count > 1 ? 's' : ''} évolution${count > 1 ? 's' : ''} réglementaire${count > 1 ? 's' : ''}`
          : 'Veille réglementaire'
      }
      className="relative inline-flex items-center justify-center size-10 rounded-full text-ink-mute hover:text-ink hover:bg-ink/5 transition-colors duration-fast"
    >
      <Bell className="size-4" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D4F542] text-ink text-[10px] font-bold font-mono flex items-center justify-center border border-paper">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
