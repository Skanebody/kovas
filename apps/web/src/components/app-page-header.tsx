import type { ReactNode } from 'react'

type AppPageHeaderProps = {
  title: string
  description?: string
  action?: ReactNode
}

/**
 * En-tête de page app — hiérarchie Ron (Manrope display + meta ink-mute).
 */
export function AppPageHeader({ title, description, action }: AppPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1 min-w-0">
        <h1 className="text-display text-3xl md:text-4xl tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-ink-mute">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
