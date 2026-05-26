'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

interface UserHeroCardProps {
  fullName: string | null
  email: string
  planName: string | null
  onClick: () => void
}

/**
 * User card hero style iOS Settings — avatar dark + chartreuse signature DS v5,
 * nom + email + plan badge, chevron à droite (ouvre Profile sheet).
 *
 * Avatar : carré arrondi 56×56, fond `#0F1419`, texte chartreuse `#D4F542`
 * font-mono medium. Initiales générées depuis fullName (1 ou 2 lettres max).
 */
export function UserHeroCard({ fullName, email, planName, onClick }: UserHeroCardProps) {
  const initials = computeInitials(fullName, email)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full bg-white rounded-3xl border border-[#0F1419]/[0.08]',
        'shadow-[0_1px_3px_rgba(15,20,25,0.05)]',
        'p-4 flex items-center gap-4 text-left',
        'hover:bg-[#0F1419]/[0.02] active:bg-[#0F1419]/[0.04]',
        'transition-colors duration-150',
      )}
    >
      <span
        aria-hidden
        className="size-14 rounded-2xl bg-[#0F1419] flex items-center justify-center shrink-0"
      >
        <span className="font-mono text-[18px] font-semibold tracking-wide text-[#D4F542]">
          {initials}
        </span>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[17px] font-semibold text-[#0F1419] leading-tight truncate">
          {fullName || 'Profil sans nom'}
        </p>
        <p className="text-[13px] text-[#0F1419]/55 leading-snug truncate mt-0.5">{email}</p>
        {planName && (
          <Badge
            variant="muted"
            className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] py-0"
          >
            {planName}
          </Badge>
        )}
      </div>
      <ChevronRight className="size-5 text-[#0F1419]/30 shrink-0" aria-hidden strokeWidth={2.5} />
    </button>
  )
}

function computeInitials(fullName: string | null, email: string): string {
  if (fullName) {
    const tokens = fullName.trim().split(/\s+/).filter(Boolean)
    if (tokens.length >= 2) {
      return `${tokens[0]?.[0] ?? ''}${tokens[1]?.[0] ?? ''}`.toUpperCase()
    }
    if (tokens.length === 1 && tokens[0]) {
      return tokens[0].slice(0, 2).toUpperCase()
    }
  }
  // Fallback : email avant @
  const local = email.split('@')[0] ?? 'KO'
  return local.slice(0, 2).toUpperCase()
}
