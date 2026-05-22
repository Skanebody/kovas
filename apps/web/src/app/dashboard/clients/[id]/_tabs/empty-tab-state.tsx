import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type EmptyTabStateProps = {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}

/**
 * Empty state compact pour onglets de fiche client.
 * Plus dense que EmptyState pleine page — adapté à un slot tab.
 */
export function EmptyTabState({ icon: Icon, title, description, action }: EmptyTabStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-rule/70 bg-paper/60 px-6 py-12 text-center">
      <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-cream-deep">
        <Icon className="size-5 text-ink-mute" />
      </div>
      <h3 className="font-sans font-semibold text-base text-ink mb-1">{title}</h3>
      <p className="mx-auto max-w-md text-sm text-ink-mute mb-4">{description}</p>
      {action ? <div className="flex justify-center">{action}</div> : null}
    </div>
  )
}
