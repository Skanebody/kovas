/**
 * KOVAS — Pré-export · `FindingCard`
 *
 * Carte d'avertissement / suggestion produite par les 6 analyseurs.
 * Affichée en liste verticale dans `PreExportPanel`.
 *
 * Tokens V5 stricts. Pas d'emoji marketing. Ton sobre.
 */

import { cn } from '@/lib/utils'
import type {
  Finding,
  FindingSeverity,
  FindingCategory,
} from '@/lib/pre-export/types'
import { AlertCircle, AlertTriangle, Info, Lightbulb } from 'lucide-react'

interface FindingCardProps {
  finding: Finding
  /** Action utilisateur (ex: deep-link vers édition champ). */
  onAction?: (finding: Finding) => void
}

const SEVERITY_STYLE: Record<
  FindingSeverity,
  { container: string; iconColor: string; pill: string; pillLabel: string }
> = {
  critical: {
    container: 'border-l-4 border-l-danger',
    iconColor: 'text-danger',
    pill: 'bg-danger/10 text-danger',
    pillLabel: 'CRITIQUE',
  },
  warning: {
    container: 'border-l-4 border-l-warning',
    iconColor: 'text-warning',
    pill: 'bg-warning/10 text-warning',
    pillLabel: 'AVERTISSEMENT',
  },
  suggestion: {
    container: 'border-l-4 border-l-info',
    iconColor: 'text-info',
    pill: 'bg-info/10 text-info',
    pillLabel: 'SUGGESTION',
  },
  info: {
    container: 'border-l-4 border-l-ink-ghost',
    iconColor: 'text-ink-mute',
    pill: 'bg-ink/5 text-ink-mute',
    pillLabel: 'INFO',
  },
}

function SeverityIcon({
  severity,
  className,
  category,
}: {
  severity: FindingSeverity
  className?: string
  category: FindingCategory
}) {
  if (category === 'opportunity') {
    return <Lightbulb className={className} aria-hidden />
  }
  switch (severity) {
    case 'critical':
      return <AlertCircle className={className} aria-hidden />
    case 'warning':
      return <AlertTriangle className={className} aria-hidden />
    case 'suggestion':
      return <Info className={className} aria-hidden />
    default:
      return <Info className={className} aria-hidden />
  }
}

const CATEGORY_LABEL: Record<FindingCategory, string> = {
  conformity: 'Conformité ADEME',
  coherence: 'Cohérence',
  statistical: 'Statistique',
  opportunity: 'Opportunité',
  quality: 'Qualité',
  historical: 'Historique',
}

export function FindingCard({ finding, onAction }: FindingCardProps) {
  const style = SEVERITY_STYLE[finding.severity]
  return (
    <div
      className={cn(
        'rounded-lg bg-paper shadow-sm p-5 transition-all duration-base',
        style.container,
        'hover:shadow-md',
      )}
      data-finding-code={finding.code}
    >
      <div className="flex items-start gap-4">
        <SeverityIcon
          severity={finding.severity}
          category={finding.category}
          className={cn('size-5 shrink-0 mt-0.5', style.iconColor)}
        />

        <div className="flex-1 min-w-0">
          {/* Header : pill sévérité + catégorie */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-pill label-mono',
                style.pill,
              )}
            >
              {style.pillLabel}
            </span>
            <span className="label-mono text-ink-mute">
              {CATEGORY_LABEL[finding.category]}
            </span>
          </div>

          {/* Titre */}
          <h4 className="font-semibold text-ink text-[15px] leading-tight mb-1.5">
            {finding.title}
          </h4>

          {/* Message */}
          <p className="text-[13px] text-ink-soft leading-relaxed">{finding.message}</p>

          {/* Action suggérée */}
          {finding.suggested_action ? (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[12px] text-ink-mute">→</span>
              {onAction ? (
                <button
                  type="button"
                  onClick={() => onAction(finding)}
                  className="text-[12px] font-medium text-navy hover:text-navy-deep underline-offset-2 hover:underline"
                >
                  {finding.suggested_action}
                </button>
              ) : (
                <span className="text-[12px] font-medium text-ink-soft">
                  {finding.suggested_action}
                </span>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
