'use client'

/**
 * AlertManager — composant central qui rend les alertes selon
 * la philosophie KOVAS.
 *
 * Garanties :
 *  - Affiche au plus MAX_ALERTS_PER_MISSION (3) alertes simultanément
 *  - Tonalité filtrée (filterTone) sur chaque message
 *  - Tri : critical → warning → info, par priorityScore desc
 *  - Filtrage des types auto-désactivés (passés en prop)
 *  - Ignore = enregistre un dismissal, masque l'alerte localement
 *  - Jamais bloquant (toutes les alertes sont dismissibles)
 *  - Ton aidant, sobre, vouvoiement par défaut
 *
 * Utilisation typique :
 *   <AlertManager
 *     findings={coherenceFindings}
 *     onDismiss={(f) => recordDismissalAction(f.type, f.subtype)}
 *     autoDisabledTypes={autoDisabled}
 *   />
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { consolidateFindings } from '@/lib/alerts/consolidator'
import { filterTone } from '@/lib/alerts/formulations'
import {
  MAX_ALERTS_PER_MISSION,
  type AlertSeverity,
  type Finding,
} from '@/lib/alerts/types'
import { cn } from '@/lib/utils'
import { CheckCircle2, Eye, Info, Lightbulb, X } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

interface AlertManagerProps {
  findings: readonly Finding[]
  /** Max d'alertes affichées. Défaut 3. */
  maxN?: number
  /** Types auto-désactivés (clé `type` ou `type:subtype`). */
  autoDisabledTypes?: ReadonlySet<string>
  /** Callback ignorance — pour persister en DB. */
  onDismiss?: (finding: Finding) => void | Promise<void>
  /** Override du titre. Par défaut : "Points à regarder". */
  title?: string
  /** Cache complètement la card si aucune alerte. Défaut true. */
  hideWhenEmpty?: boolean
  className?: string
}

const SEVERITY_STYLES: Record<
  AlertSeverity,
  { icon: typeof Info; color: string; label: string }
> = {
  critical: {
    icon: Eye,
    color: 'text-accent-orange',
    label: 'À regarder',
  },
  warning: {
    icon: Lightbulb,
    color: 'text-accent-amber',
    label: 'À confirmer',
  },
  info: {
    icon: Info,
    color: 'text-ink-mute',
    label: 'Pour info',
  },
}

export function AlertManager({
  findings,
  maxN = MAX_ALERTS_PER_MISSION,
  autoDisabledTypes,
  onDismiss,
  title = 'Points à regarder',
  hideWhenEmpty = true,
  className,
}: AlertManagerProps) {
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(new Set())

  const visible = useMemo(() => {
    // 1. Filtre les types auto-désactivés
    const filtered = findings.filter((f) => {
      const fullKey = f.subtype ? `${f.type}:${f.subtype}` : f.type
      if (autoDisabledTypes?.has(fullKey)) return false
      if (autoDisabledTypes?.has(f.type)) return false
      if (dismissedIds.has(f.id)) return false
      return true
    })
    // 2. Consolide + plafond
    return consolidateFindings(filtered, maxN)
  }, [findings, autoDisabledTypes, dismissedIds, maxN])

  if (hideWhenEmpty && visible.length === 0) return null

  if (visible.length === 0) {
    return (
      <Card variant="opaque" padding="default" className={className}>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 text-sm text-ink-mute">
            <CheckCircle2 className="size-4 text-accent-green" />
            Tout est en ordre, vous pouvez continuer.
          </div>
        </CardContent>
      </Card>
    )
  }

  const handleDismiss = (f: Finding) => {
    setDismissedIds((prev) => {
      const next = new Set(prev)
      next.add(f.id)
      return next
    })
    void onDismiss?.(f)
  }

  return (
    <Card variant="warm" padding="default" className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between text-ink">
          <span>{title}</span>
          <span className="text-[11px] font-medium text-ink-mute tabular-nums">
            {visible.length} / {maxN}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-2">
          {visible.map((f) => {
            const style = SEVERITY_STYLES[f.severity]
            const Icon = style.icon
            return (
              <li
                key={f.id}
                className="flex items-start gap-3 text-sm rounded-md p-2 -mx-2 hover:bg-ink/5 transition-colors"
              >
                <Icon className={cn('size-4 mt-0.5 shrink-0', style.color)} />
                <div className="flex-1 min-w-0">
                  <p className="text-ink leading-snug">{filterTone(f.message)}</p>
                  {f.detail && (
                    <p className="text-xs text-ink-mute mt-0.5 whitespace-pre-line">
                      {filterTone(f.detail)}
                    </p>
                  )}
                  {f.href && (
                    <Button
                      asChild
                      variant="link"
                      size="sm"
                      className="px-0 h-auto text-xs mt-1"
                    >
                      <Link href={f.href}>Voir le détail</Link>
                    </Button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDismiss(f)}
                  className="shrink-0 text-ink-mute hover:text-ink rounded-full p-1"
                  aria-label="Ignorer cette alerte"
                  title="Ignorer (ne plus afficher si répété)"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
