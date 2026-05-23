'use client'

/**
 * KOVAS — SidebarMoreMenu (refonte Linear-style 2026-05-23).
 *
 * Item "Plus" qui révèle un popover des items secondaires (Zone 4).
 * En mode étendu : inline collapsible. En mode collapsed : popover flottant
 * à droite.
 *
 * Reste ouvert quand l'utilisateur est sur une page contenue dans la
 * sélection (active path matche un item du menu).
 */

import type { SidebarBadgeCounts } from '@/lib/sidebar/badge-counts'
import type { SidebarNotificationStyle } from '@/lib/sidebar/preferences-types'
import type { SidebarItemDef } from '@/lib/sidebar/sidebar-items'
import { cn } from '@/lib/utils'
import { ChevronDown, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

const CHARTREUSE = '#D4F542'
const CHARTREUSE_MID = '#A8C547'
const NAVY_800 = '#252B33'
const NAVY_700 = '#1A1F26'

interface SidebarMoreMenuProps {
  items: readonly SidebarItemDef[]
  collapsed: boolean
  badgeCounts: SidebarBadgeCounts
  notificationStyle: SidebarNotificationStyle
}

function isActiveHref(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  if (href === '/dashboard/dashboard') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SidebarMoreMenu({
  items,
  collapsed,
  badgeCounts,
  notificationStyle,
}: SidebarMoreMenuProps) {
  const pathname = usePathname()
  const containsActive = useMemo(
    () => items.some((item) => isActiveHref(pathname, item.href)),
    [items, pathname],
  )

  // Ouvert par défaut si on est sur une page d'item du Plus
  const [open, setOpen] = useState<boolean>(containsActive)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Si la nav atteint un item du menu, garde-le ouvert.
  useEffect(() => {
    if (containsActive) setOpen(true)
  }, [containsActive])

  // Click outside (mode collapsed popover uniquement)
  useEffect(() => {
    if (!collapsed || !open) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [collapsed, open])

  const triggerActive = open || containsActive
  const totalBadge = items.reduce((sum, item) => {
    if (!item.badgeKey) return sum
    return sum + (badgeCounts[item.badgeKey] ?? 0)
  }, 0)

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger "Plus" */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        title={collapsed ? 'Plus' : undefined}
        className={cn(
          'group relative flex items-center rounded-[10px] transition-colors duration-200 ease-in-out outline-none',
          'focus-visible:ring-2 focus-visible:ring-offset-0',
          collapsed ? 'h-11 w-11 mx-auto justify-center' : 'h-10 w-full px-2.5 gap-3',
        )}
        style={{
          backgroundColor: triggerActive ? NAVY_800 : 'transparent',
          ['--tw-ring-color' as string]: CHARTREUSE,
        }}
        onMouseEnter={(e) => {
          if (!triggerActive) e.currentTarget.style.backgroundColor = NAVY_700
        }}
        onMouseLeave={(e) => {
          if (!triggerActive) e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        <span
          className={cn(
            'relative shrink-0 flex items-center justify-center',
            collapsed ? 'size-10' : 'size-7',
          )}
        >
          <MoreHorizontal
            className={collapsed ? 'size-[22px]' : 'size-[18px]'}
            strokeWidth={1.5}
            style={{
              color: triggerActive ? CHARTREUSE_MID : 'rgba(255,255,255,0.65)',
            }}
          />
          {totalBadge > 0 && notificationStyle === 'dot' ? (
            <span
              aria-hidden
              className="absolute top-0 right-0 size-2 rounded-full"
              style={{ backgroundColor: CHARTREUSE }}
            />
          ) : null}
        </span>
        {!collapsed ? (
          <>
            <span
              className={cn(
                'flex-1 truncate text-[14px] leading-tight text-left',
                triggerActive ? 'font-semibold text-white' : 'text-white/85',
              )}
            >
              Plus
            </span>
            {totalBadge > 0 && notificationStyle === 'count' ? (
              <span
                className="min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.9)',
                }}
              >
                {totalBadge > 99 ? '99+' : totalBadge}
              </span>
            ) : null}
            <ChevronDown
              className={cn(
                'size-4 transition-transform shrink-0',
                open ? 'rotate-180' : 'rotate-0',
              )}
              strokeWidth={1.5}
              style={{ color: 'rgba(255,255,255,0.6)' }}
            />
          </>
        ) : null}
      </button>

      {/* Liste items — inline expanded ou popover collapsed */}
      {open ? (
        collapsed ? (
          <div
            role="menu"
            className="absolute left-full top-0 ml-2 z-50 min-w-[220px] rounded-[12px] border border-white/10 shadow-xl py-2"
            style={{ backgroundColor: '#0F1419' }}
          >
            {items.map((item) => {
              const active = isActiveHref(pathname, item.href)
              const count = item.badgeKey ? badgeCounts[item.badgeKey] : 0
              const Icon = item.icon
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  role="menuitem"
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 mx-1 rounded-[8px] transition-colors',
                    active ? 'bg-[#252B33]' : 'hover:bg-[#1A1F26]',
                  )}
                >
                  <Icon
                    className="size-[18px] shrink-0"
                    strokeWidth={1.5}
                    style={{
                      color: active ? CHARTREUSE_MID : 'rgba(255,255,255,0.65)',
                    }}
                  />
                  <span
                    className={cn(
                      'flex-1 truncate text-[14px]',
                      active ? 'font-semibold text-white' : 'text-white/85',
                    )}
                  >
                    {item.label}
                  </span>
                  {count > 0 && notificationStyle === 'count' ? (
                    <span
                      className="min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center"
                      style={{
                        backgroundColor: active ? CHARTREUSE : 'rgba(255,255,255,0.12)',
                        color: active ? '#0F1419' : 'rgba(255,255,255,0.9)',
                      }}
                    >
                      {count > 99 ? '99+' : count}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </div>
        ) : (
          <ul className="mt-1 ml-3 pl-3 border-l border-white/8 space-y-0.5">
            {items.map((item) => {
              const active = isActiveHref(pathname, item.href)
              const count = item.badgeKey ? badgeCounts[item.badgeKey] : 0
              const Icon = item.icon
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 h-9 px-2 rounded-[8px] transition-colors',
                      active ? 'bg-[#252B33]' : 'hover:bg-[#1A1F26]',
                    )}
                  >
                    <Icon
                      className="size-[16px] shrink-0"
                      strokeWidth={1.5}
                      style={{
                        color: active ? CHARTREUSE_MID : 'rgba(255,255,255,0.65)',
                      }}
                    />
                    <span
                      className={cn(
                        'flex-1 truncate text-[13px]',
                        active ? 'font-semibold text-white' : 'text-white/80',
                      )}
                    >
                      {item.label}
                    </span>
                    {count > 0 && notificationStyle === 'count' ? (
                      <span
                        className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center"
                        style={{
                          backgroundColor: active ? CHARTREUSE : 'rgba(255,255,255,0.12)',
                          color: active ? '#0F1419' : 'rgba(255,255,255,0.9)',
                        }}
                      >
                        {count > 99 ? '99+' : count}
                      </span>
                    ) : null}
                    {count > 0 && notificationStyle === 'dot' ? (
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: CHARTREUSE }}
                      />
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        )
      ) : null}
    </div>
  )
}
