import type { ReactNode } from 'react'

interface SectionHeaderProps {
  /** Numéro affiché en gris léger style "01". */
  number: string
  /** Titre uppercase tracking large. */
  title: string
  /** Slot action droite (lien "Voir tout" ou meta texte). */
  action?: ReactNode
}

/**
 * En-tête de section data-dense, pattern mockup KOVAS terminal sobre.
 *
 *   01 · PERFORMANCE DU JOUR                              Voir tout →
 *   ──── ─────────────────────────                       ───────────
 *   mono mute  mono semibold uppercase tracking 0.18em   mono mute underline
 */
export function SectionHeader({ number, title, action }: SectionHeaderProps) {
  return (
    <div className="flex items-baseline gap-4 mb-4">
      <span className="font-mono text-[11px] text-[#0F1419]/72 tracking-[0.1em]">{number}</span>
      <span className="font-mono text-[11px] font-semibold text-[#0F1419] tracking-[0.18em] uppercase">
        {title}
      </span>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}
