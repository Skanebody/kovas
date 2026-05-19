'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useExpandState } from '@/lib/hooks/use-expand-state'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

interface CollapsibleSectionProps {
  /** Clé localStorage (ex: 'kovas_dossier_xx_owner_docs') */
  storageKey: string
  /** Titre + icône optionnelle dans le header */
  title: ReactNode
  /** Compteur ou meta affiché à droite du titre (avant la chevron) */
  meta?: ReactNode
  /** Boutons d'action toujours visibles dans le header */
  actions?: ReactNode
  /** Contenu collapsible */
  children: ReactNode
  /** État initial (false = collapsé) */
  defaultExpanded?: boolean
}

/**
 * Section Card collapsible générique avec persistance localStorage.
 * cf. spec dossier-allegement-visuel 2026-05-18.
 */
export function CollapsibleSection({
  storageKey,
  title,
  meta,
  actions,
  children,
  defaultExpanded = false,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useExpandState(storageKey, defaultExpanded)

  return (
    <Card variant="opaque" padding="none">
      <CardHeader className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls={`${storageKey}-body`}
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
          >
            <CardTitle className="text-base flex items-center gap-2">{title}</CardTitle>
            {meta && <span className="text-xs text-ink-mute shrink-0">{meta}</span>}
            <ChevronDown
              className={cn(
                'size-4 text-ink-mute transition-transform ml-auto shrink-0',
                expanded && 'rotate-180',
              )}
            />
          </button>
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent id={`${storageKey}-body`} className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  )
}
