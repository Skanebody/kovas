import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface SettingsSectionProps {
  /** Header section (eyebrow mono uppercase au-dessus de la card). */
  title?: string
  /** Texte d'aide sous la section (12px muted, max 2 lignes). */
  helperText?: ReactNode
  /** Permet de cibler la section depuis SettingsSearch. */
  searchKey?: string
  /** Slot à droite du header (lien optionnel). */
  headerAction?: ReactNode
  children: ReactNode
  /** Pour cacher la section via le filtre search. */
  hidden?: boolean
  className?: string
}

/**
 * Groupe de réglages style iOS Settings.
 *
 * Header optionnel en eyebrow mono uppercase (padding 4 horizontal), card
 * blanche radius 16 avec divisions internes auto-séparées via
 * `[&>*+*]:border-t [&>*+*]:border-[#0F1419]/[0.06]`. Texte d'aide sous la
 * card en 12px muted leading-relaxed.
 */
export function SettingsSection({
  title,
  helperText,
  headerAction,
  searchKey,
  children,
  hidden = false,
  className,
}: SettingsSectionProps) {
  if (hidden) return null

  return (
    <section data-search-key={searchKey} className={cn('space-y-1.5', className)}>
      {(title || headerAction) && (
        <div className="flex items-baseline justify-between gap-3 px-4">
          {title && (
            <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#0F1419]/55 font-medium">
              {title}
            </h2>
          )}
          {headerAction}
        </div>
      )}
      <div
        className={cn(
          'bg-white rounded-2xl border border-[#0F1419]/[0.08]',
          'shadow-[0_1px_2px_rgba(15,20,25,0.04)]',
          'overflow-hidden',
          '[&>*+*]:border-t [&>*+*]:border-[#0F1419]/[0.06]',
        )}
      >
        {children}
      </div>
      {helperText && (
        <p className="px-4 text-[12px] text-[#0F1419]/55 leading-relaxed">{helperText}</p>
      )}
    </section>
  )
}
