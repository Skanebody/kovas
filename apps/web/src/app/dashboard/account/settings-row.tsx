'use client'

import { cn } from '@/lib/utils'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

interface SettingsRowProps {
  icon: LucideIcon
  /** Couleur de fond hex de l'icône (palette iOS Settings). */
  iconColor: string
  /** Couleur de l'icône (par défaut blanc, mais chartreuse demande un anthracite). */
  iconForeground?: string
  label: string
  /** Texte de prévisualisation (valeur courante / description courte). */
  previewValue?: string
  /** Si fourni : ligne devient un lien (Next Link). */
  href?: string
  /** Si fourni : ligne devient un button. */
  onClick?: () => void
  /** Slot à droite remplaçant le chevron (utile pour switch / badge). */
  rightSlot?: ReactNode
  /** Indique si on cache le chevron. Utile si rightSlot est un switch. */
  hideChevron?: boolean
  /** Pour le filtre search — terms additionnels recherchables. */
  searchTerms?: string
}

/**
 * Ligne style iOS Settings — icône colorée + label + preview + chevron.
 *
 * Click-area pleine largeur. Hover discret. Aligne sur 44px min de hauteur
 * (recommandation Apple HIG). Padding 12 horizontal, 12 vertical.
 */
export function SettingsRow({
  icon: Icon,
  iconColor,
  iconForeground = '#FFFFFF',
  label,
  previewValue,
  href,
  onClick,
  rightSlot,
  hideChevron = false,
}: SettingsRowProps) {
  const content = (
    <>
      <span
        aria-hidden
        className="size-7 rounded-[7px] flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(15,20,25,0.12)]"
        style={{ backgroundColor: iconColor }}
      >
        <Icon className="size-[15px]" style={{ color: iconForeground }} strokeWidth={2.25} />
      </span>
      <span className="flex-1 min-w-0 text-[15px] font-normal text-[#0F1419] truncate">
        {label}
      </span>
      {previewValue && (
        <span className="font-mono text-[12px] tabular-nums text-[#0F1419]/55 truncate max-w-[140px]">
          {previewValue}
        </span>
      )}
      {rightSlot}
      {!hideChevron && !rightSlot && (
        <ChevronRight className="size-4 text-[#0F1419]/30 shrink-0" aria-hidden strokeWidth={2.5} />
      )}
    </>
  )

  const baseClass = cn(
    'flex items-center gap-3 px-4 py-2.5 min-h-[44px]',
    'transition-colors duration-150',
    (href || onClick) && 'hover:bg-[#0F1419]/[0.025] active:bg-[#0F1419]/[0.05]',
    (href || onClick) && 'cursor-pointer',
  )

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          baseClass,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F1419]/40 focus-visible:ring-offset-1',
        )}
      >
        {content}
      </Link>
    )
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          baseClass,
          'w-full text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F1419]/40 focus-visible:ring-offset-1',
        )}
      >
        {content}
      </button>
    )
  }

  return <div className={baseClass}>{content}</div>
}
