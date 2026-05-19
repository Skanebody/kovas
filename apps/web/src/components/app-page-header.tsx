import type { ReactNode } from 'react'

type AppPageHeaderProps = {
  title: string
  description?: string
  action?: ReactNode
}

export function AppPageHeader({ title, description, action }: AppPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1 min-w-0">
        <h1 className="font-display font-light text-display-m md:text-display-l tracking-tight text-ink">
          {title}
        </h1>
        {description ? <p className="text-[12px] text-ink-mute">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
