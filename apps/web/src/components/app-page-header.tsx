import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type AppPageHeaderProps = {
  /** Titre principal (sans-serif léger Urbanist) */
  title: string
  /** Mot-clé éditorial Instrument Serif italic dramatisé inline. Si fourni,
   * le rendu devient `{title} {accent}` avec accent en serif italic. */
  accent?: string
  /** Description courte sobre sous le titre */
  description?: string
  /** Slot action droite (Pill / Button) */
  action?: ReactNode
  /** Eyebrow mono uppercase au-dessus du titre (optionnel) */
  eyebrow?: string
  className?: string
}

/**
 * AppPageHeader v4 — pattern signature wireframes :
 *
 *   [eyebrow mono uppercase optionnel]
 *   {title} {accent en Instrument Serif italic}.
 *   {description ink-mute}
 *
 * Exemples :
 * - <AppPageHeader title="Dossiers" /> → "Dossiers"
 * - <AppPageHeader title="Vos" accent="dossiers" /> → "Vos *dossiers*."
 * - <AppPageHeader title="Performance" accent="ce mois" eyebrow="Mai 2026" />
 */
export function AppPageHeader({
  title,
  accent,
  description,
  action,
  eyebrow,
  className,
}: AppPageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="space-y-2 min-w-0">
        {eyebrow ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-sans font-light text-display-m md:text-display-l tracking-tight text-ink leading-[1.05]">
          {title}
          {accent ? (
            <>
              {' '}
              <span className="font-serif italic font-normal">{accent}</span>
              <span className="text-ink-mute">.</span>
            </>
          ) : null}
        </h1>
        {description ? <p className="text-sm text-ink-mute max-w-xl">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
