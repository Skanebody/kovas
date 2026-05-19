'use client'

import { Avatar } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ChevronDown, HelpCircle, LogOut, Mail, Settings } from 'lucide-react'
import Link from 'next/link'
import { useTransition } from 'react'

interface UserMenuProps {
  displayName: string
  email?: string | null
  /** Server action de déconnexion (Supabase signOut + redirect /login) */
  onLogout: () => Promise<void>
}

/**
 * Menu utilisateur déroulant dans le header de l'app.
 * Trigger discret = Avatar + ChevronDown subtle. Menu : FAQ, contact,
 * paramètres (placeholder), déconnexion.
 */
export function UserMenu({ displayName, email, onLogout }: UserMenuProps) {
  const [pending, startTransition] = useTransition()

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
          aria-label="Menu utilisateur"
          className={cn(
            'flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 transition-colors',
            'hover:bg-cta/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta/30',
          )}
        >
          <Avatar name={displayName} size="sm" />
          <ChevronDown className="size-3 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold truncate">{displayName}</span>
          {email && email !== displayName && (
            <span className="text-xs text-muted-foreground truncate font-normal">{email}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/faq" className="cursor-pointer">
            <HelpCircle className="size-4" /> Questions fréquentes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="mailto:contact@kovas.fr" className="cursor-pointer">
            <Mail className="size-4" /> Contacter le support
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="text-muted-foreground">
          <Settings className="size-4" /> Paramètres (bientôt)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={pending}
          className="text-accent-red focus:text-accent-red [&_svg]:text-accent-red cursor-pointer"
        >
          <LogOut className="size-4" /> Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
