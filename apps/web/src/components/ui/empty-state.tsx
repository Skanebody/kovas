import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  /** Icône Lucide affichée en hero (160×160 conceptuellement). */
  icon: LucideIcon
  /** Titre court Instrument Serif italic — phrase canonique courte. */
  title: string
  /** Description sobre, 1 phrase max. */
  description?: string
  /** CTA principal (généralement `<Pill variant="primary">` ou `<Button>` warm). */
  action?: ReactNode
  /** Action secondaire optionnelle. */
  secondaryAction?: ReactNode
  className?: string
}

/**
 * EmptyState — pattern canonique unifié v4 (cf. doc wireframes §15.2).
 * Utilisation sur tous les écrans vides : /dossiers vide, /clients vide,
 * /messages vide, /facturation vide, /planning vide, etc.
 *
 * Pattern strict :
 * - Icône hero 64-80px circle pastel
 * - Titre Instrument Serif italic 24-28px
 * - Description 13-14px ink-mute, 1 phrase max
 * - CTA primary ou warm + action secondaire ghost optionnelle
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-16 px-6',
        className,
      )}
    >
      <div
        aria-hidden
        className="mb-6 flex size-20 items-center justify-center rounded-full bg-cyan-light/70 text-navy-900 shadow-glass-sm"
      >
        <Icon className="size-9" strokeWidth={1.5} />
      </div>
      <h2 className="font-serif italic font-normal text-2xl md:text-3xl tracking-tight text-ink mb-2 max-w-md">
        {title}
      </h2>
      {description && (
        <p className="text-sm text-ink-mute mb-6 max-w-sm leading-relaxed">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
