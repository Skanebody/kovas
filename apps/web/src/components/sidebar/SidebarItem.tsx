'use client'

/**
 * KOVAS — SidebarItem (refonte Linear-style 2026-05-23).
 *
 * Rend un item de sidebar (lien + icône + label + badge).
 * Adapte son rendu au mode collapsed/expanded.
 * Affiche un badge numérique ou un dot selon `notificationStyle`.
 */

import type { SidebarNotificationStyle } from '@/lib/sidebar/preferences-types'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import type { CSSProperties } from 'react'

interface SidebarItemProps {
  href: string
  label: string
  icon: LucideIcon
  active: boolean
  collapsed: boolean
  badgeCount?: number
  notificationStyle?: SidebarNotificationStyle
  /** Style accent chartreuse subtil (item Capture). */
  accent?: boolean
  /** Élément additionnel à droite (chevron, etc.). */
  trailing?: React.ReactNode
  /** Si fourni, override le <Link> et utilise un <button>. */
  onClick?: () => void
  ariaLabel?: string
  ariaCurrent?: 'page' | 'true' | 'false'
  ariaHasPopup?: boolean
  ariaExpanded?: boolean
}

const CHARTREUSE = '#D4F542'
const CHARTREUSE_MID = '#A8C547'
const NAVY_800 = '#252B33'
const NAVY_700 = '#1A1F26'

export function SidebarItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  badgeCount,
  notificationStyle = 'count',
  accent = false,
  trailing,
  onClick,
  ariaLabel,
  ariaCurrent,
  ariaHasPopup,
  ariaExpanded,
}: SidebarItemProps) {
  const hasBadge = typeof badgeCount === 'number' && badgeCount > 0
  const showCount = hasBadge && notificationStyle === 'count'
  const showDot = hasBadge && notificationStyle === 'dot'

  const baseStyle: CSSProperties = {
    backgroundColor: active ? NAVY_800 : 'transparent',
  }

  const content = (
    <>
      {/* Barre active chartreuse 3px à gauche */}
      {active ? (
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
          style={{ backgroundColor: CHARTREUSE }}
        />
      ) : null}

      {/* Icône */}
      <span
        className={cn(
          'relative shrink-0 flex items-center justify-center',
          collapsed ? 'size-10' : 'size-7',
        )}
      >
        <Icon
          className={cn(collapsed ? 'size-[22px]' : 'size-[18px]')}
          strokeWidth={1.5}
          style={{
            color: active ? CHARTREUSE_MID : accent ? CHARTREUSE : 'rgba(255,255,255,0.65)',
          }}
        />
        {/* Dot notification mode 'dot' — affiché aussi en collapsed */}
        {showDot ? (
          <span
            aria-hidden
            className="absolute top-0 right-0 size-2 rounded-full ring-2"
            style={{
              backgroundColor: CHARTREUSE,
              // navy 800 background ring pour matcher fond sidebar
              boxShadow: `0 0 0 2px ${active ? NAVY_800 : '#0F1419'}`,
            }}
          />
        ) : null}
        {/* Count compact en mode collapsed */}
        {showCount && collapsed ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center"
            style={{
              backgroundColor: CHARTREUSE,
              color: '#0F1419',
            }}
          >
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        ) : null}
      </span>

      {/* Label + badge (mode étendu uniquement) */}
      {!collapsed ? (
        <>
          <span
            className={cn(
              'flex-1 truncate text-[14px] leading-tight',
              active ? 'font-semibold text-white' : 'text-white/85',
            )}
          >
            {label}
          </span>
          {showCount ? (
            <span
              className="ml-2 min-w-[20px] h-[20px] px-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0"
              style={{
                backgroundColor: active ? CHARTREUSE : 'rgba(255,255,255,0.12)',
                color: active ? '#0F1419' : 'rgba(255,255,255,0.9)',
              }}
            >
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          ) : null}
          {trailing ? <span className="ml-1 shrink-0">{trailing}</span> : null}
        </>
      ) : null}
    </>
  )

  const commonClasses = cn(
    'group relative flex items-center rounded-[10px] transition-colors duration-200 ease-in-out outline-none',
    'focus-visible:ring-2 focus-visible:ring-offset-0',
    collapsed ? 'h-11 w-11 mx-auto justify-center' : 'h-10 w-full px-2.5 gap-3',
    !active && 'hover:bg-[color:var(--sidebar-hover,#1A1F26)]',
  )

  const focusStyle: CSSProperties = {
    // focus ring chartreuse 2px (custom via style for color-fidelity)
    ['--tw-ring-color' as string]: CHARTREUSE,
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={collapsed ? label : undefined}
        aria-label={ariaLabel ?? label}
        aria-current={ariaCurrent}
        aria-haspopup={ariaHasPopup}
        aria-expanded={ariaExpanded}
        className={commonClasses}
        style={{ ...baseStyle, ...focusStyle, ['--sidebar-hover' as string]: NAVY_700 }}
      >
        {content}
      </button>
    )
  }

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-label={ariaLabel ?? label}
      aria-current={active ? 'page' : undefined}
      className={commonClasses}
      style={{ ...baseStyle, ...focusStyle, ['--sidebar-hover' as string]: NAVY_700 }}
    >
      {content}
    </Link>
  )
}
