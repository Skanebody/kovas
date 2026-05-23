'use client'

/**
 * KOVAS — SidebarAvatar (zone 1, refonte 2026-05-23).
 *
 * Avatar circulaire en haut de la sidebar.
 *  - Mode étendu : avatar + nom du diagnostiqueur
 *  - Mode collapsed : avatar seul (cliquable, tooltip natif)
 *
 * Au clic : dropdown avec Profil / Abonnement / Déconnexion.
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { CreditCard, LogOut, Settings, User } from 'lucide-react'
import Link from 'next/link'
import { useTransition } from 'react'

interface SidebarAvatarProps {
  displayName: string
  email: string
  avatarUrl?: string | null
  collapsed: boolean
  onLogout: () => Promise<void>
}

function initialsFromName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/).filter(Boolean)
  const first = parts[0] ?? ''
  if (parts.length === 1) {
    return first.slice(0, 2).toUpperCase() || '?'
  }
  const last = parts[parts.length - 1] ?? ''
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?'
}

const CHARTREUSE_DEEP = '#A8C547'

export function SidebarAvatar({
  displayName,
  email,
  avatarUrl,
  collapsed,
  onLogout,
}: SidebarAvatarProps) {
  const [, startTransition] = useTransition()
  const initials = initialsFromName(displayName)

  function handleLogout() {
    startTransition(async () => {
      await onLogout()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menu compte"
          title={collapsed ? displayName : undefined}
          className={cn(
            'group w-full flex items-center rounded-[10px] transition-colors duration-200 outline-none',
            'focus-visible:ring-2',
            collapsed ? 'h-11 justify-center px-1' : 'h-12 px-2 gap-2.5',
            'hover:bg-[#1A1F26]',
          )}
          style={{ ['--tw-ring-color' as string]: '#D4F542' }}
        >
          <span
            className={cn(
              'shrink-0 inline-flex items-center justify-center rounded-full overflow-hidden text-[12px] font-semibold uppercase',
              'size-9',
            )}
            style={{ backgroundColor: CHARTREUSE_DEEP, color: '#0F1419' }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              initials
            )}
          </span>
          {!collapsed ? (
            <span className="flex-1 min-w-0 text-left">
              <span className="block text-[13px] font-semibold text-white truncate leading-tight">
                {displayName}
              </span>
              <span className="block text-[11px] text-white/55 truncate leading-tight">
                {email}
              </span>
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={collapsed ? 'start' : 'start'}
        side="right"
        sideOffset={8}
        className="min-w-60"
      >
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold truncate">{displayName}</span>
          <span className="text-xs text-ink-mute truncate font-normal">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/account" className="cursor-pointer">
            <User className="size-4" strokeWidth={1.5} />
            <span>Mon profil</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/account?tab=billing" className="cursor-pointer">
            <CreditCard className="size-4" strokeWidth={1.5} />
            <span>Abonnement</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/account" className="cursor-pointer">
            <Settings className="size-4" strokeWidth={1.5} />
            <span>Paramètres</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            handleLogout()
          }}
          className="cursor-pointer text-red-600 focus:text-red-700"
        >
          <LogOut className="size-4" strokeWidth={1.5} />
          <span>Déconnexion</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
