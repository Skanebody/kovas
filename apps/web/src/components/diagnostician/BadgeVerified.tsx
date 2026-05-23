import { cn } from '@/lib/utils'
import { CheckCircle, Sparkles } from 'lucide-react'

/**
 * Badge "Vérifié par KOVAS" — visibilité publique des diagnostiqueurs.
 *
 * Trois niveaux possibles, alignés sur `diagnostician_verification_status.badge_level` :
 *  - unverified    : aucun affichage (le profil n'apparaît de toute façon pas publiquement)
 *  - verified      : pillule navy + check chartreuse — "Vérifié par KOVAS"
 *  - verified_plus : pillule chartreuse pleine + sparkles — "Vérifié+"
 *
 * Doctolib 2022 : le badge n'est jamais affiché si les 4 phases (identité,
 * COFRAC, RC Pro, SIRENE) ne sont pas en `verified`.
 *
 * Brand v5 strict : navy `#0F1419` + chartreuse `#D4F542` + sage `#F5F7F4`.
 */

export type BadgeVerifiedLevel = 'unverified' | 'verified' | 'verified_plus'

interface BadgeVerifiedProps {
  level: BadgeVerifiedLevel
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_STYLES: Record<NonNullable<BadgeVerifiedProps['size']>, string> = {
  sm: 'text-[10px] px-2 py-0.5 gap-1',
  md: 'text-[11px] px-2.5 py-1 gap-1.5',
  lg: 'text-[13px] px-3 py-1.5 gap-2',
}

const ICON_SIZE: Record<NonNullable<BadgeVerifiedProps['size']>, string> = {
  sm: 'size-3',
  md: 'size-3.5',
  lg: 'size-4',
}

export function BadgeVerified({ level, size = 'md', className }: BadgeVerifiedProps) {
  if (level === 'unverified') {
    return null
  }

  const sizeClass = SIZE_STYLES[size]
  const iconClass = ICON_SIZE[size]

  if (level === 'verified_plus') {
    return (
      <span
        title="Engagement qualité KOVAS + audits réguliers"
        aria-label="Diagnostiqueur Vérifié+ par KOVAS"
        className={cn(
          'inline-flex items-center rounded-pill font-display font-semibold border border-chartreuse-deep/40',
          'bg-chartreuse text-ink shadow-[0_2px_8px_rgba(212,245,66,0.4)]',
          sizeClass,
          className,
        )}
      >
        <Sparkles className={iconClass} aria-hidden />
        Vérifié+
      </span>
    )
  }

  // verified
  return (
    <span
      title="Identité, certification COFRAC, RC Pro et entreprise vérifiées"
      aria-label="Diagnostiqueur Vérifié par KOVAS"
      className={cn(
        'inline-flex items-center rounded-pill font-display font-semibold border border-navy/20',
        'bg-navy text-paper',
        sizeClass,
        className,
      )}
    >
      <CheckCircle className={cn(iconClass, 'text-chartreuse')} aria-hidden />
      Vérifié par KOVAS
    </span>
  )
}
