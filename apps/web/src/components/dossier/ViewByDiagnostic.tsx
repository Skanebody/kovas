import { DiagChip } from '@/components/ui/diag-chip'
import { diagnosticToDiagChip } from '@/lib/dossier/diagnostic-to-diag-chip'
import type { DiagnosticProgress } from '@/lib/dossier/types'
import { cn } from '@/lib/utils'

interface DiagnosticRowProps {
  item: DiagnosticProgress
  className?: string
}

/**
 * Ligne d'un diagnostic dans la vue "par diagnostic".
 *
 * - Header : DiagChip + pourcentage
 * - Barre progress (warning si < 60%, success >= 80%, info sinon)
 * - Sous-titre : "12/14 champs · Manque : ventilation, ECS"
 */
export function DiagnosticRow({ item, className }: DiagnosticRowProps) {
  const percent = Math.max(0, Math.min(100, Math.round(item.percent)))
  const barClass = percent < 60 ? 'bg-warning' : percent >= 80 ? 'bg-success' : 'bg-info'

  const missingLabel =
    item.missingFields.length > 0
      ? `Manque : ${item.missingFields.slice(0, 3).join(', ')}${
          item.missingFields.length > 3 ? '…' : ''
        }`
      : 'Tous les champs collectés'

  return (
    <li className={cn('flex flex-col gap-2 py-3', className)}>
      <div className="flex items-center gap-3">
        <DiagChip type={diagnosticToDiagChip(item.diagnostic)} />
        <span className="ml-auto font-mono text-[12px] font-semibold tabular-nums text-ink">
          {percent}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`Progression ${item.diagnostic}`}
        tabIndex={-1}
        className="h-1.5 w-full overflow-hidden rounded-full bg-sage-alt"
      >
        <div
          className={cn('h-full rounded-full transition-all duration-base', barClass)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-[12px] text-ink-mute">
        <span className="font-medium text-ink-soft">
          {item.fieldsCollected}/{item.fieldsTotal} champs
        </span>
        <span aria-hidden> · </span>
        <span>{missingLabel}</span>
      </p>
    </li>
  )
}

interface ViewByDiagnosticProps {
  items: DiagnosticProgress[]
  className?: string
}

/** Liste de DiagnosticRow séparées par divider. */
export function ViewByDiagnostic({ items, className }: ViewByDiagnosticProps) {
  if (items.length === 0) {
    return (
      <p className={cn('text-sm text-ink-mute', className)}>
        Aucun diagnostic actif pour ce dossier.
      </p>
    )
  }

  return (
    <ul className={cn('flex flex-col divide-y divide-rule/40', className)}>
      {items.map((item) => (
        <DiagnosticRow key={item.diagnostic} item={item} />
      ))}
    </ul>
  )
}
