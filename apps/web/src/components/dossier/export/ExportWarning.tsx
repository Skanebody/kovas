import { DiagChip } from '@/components/ui/diag-chip'
import type { DiagnosticType } from '@/lib/mission/types'
/**
 * KOVAS — Bandeau d'alerte champs manquants avant export (Partition D).
 *
 * Affiché en tête de la section #export-section quand `missingFields.length > 0`.
 * Box border-left orange + liste des manques (max 5 + "X autres" si plus).
 *
 * Authority : CLAUDE.md §3 features 5+7 (check-lists + validation cohérence).
 */
import { AlertTriangle } from 'lucide-react'

export interface ExportWarningMissingField {
  diagnostic: DiagnosticType
  label: string
}

interface ExportWarningProps {
  missingFields: ExportWarningMissingField[]
  /** Nombre max d'items affichés avant troncature. Défaut : 5. */
  maxVisible?: number
}

/**
 * Convertit le DiagnosticType interne (`ELEC`) vers le code DiagChip (`ELECTRICITE`).
 */
function diagnosticToChipType(d: DiagnosticType): string {
  return d === 'ELEC' ? 'ELECTRICITE' : d
}

export function ExportWarning({ missingFields, maxVisible = 5 }: ExportWarningProps) {
  if (missingFields.length === 0) return null

  const visible = missingFields.slice(0, maxVisible)
  const remaining = missingFields.length - visible.length

  return (
    <div className="rounded-lg border-l-4 border-accent-orange/60 bg-accent-orange/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="size-4 text-accent-orange shrink-0" />
        <h3 className="text-sm font-semibold text-ink">
          {missingFields.length} manque{missingFields.length > 1 ? 's' : ''} détecté
          {missingFields.length > 1 ? 's' : ''}
        </h3>
      </div>
      <ul className="space-y-2">
        {visible.map((field, idx) => (
          <li
            key={`${field.diagnostic}-${field.label}-${idx}`}
            className="flex items-center justify-between gap-3 text-[13px] text-ink-mute"
          >
            <span className="truncate">{field.label}</span>
            <DiagChip type={diagnosticToChipType(field.diagnostic) as never} short />
          </li>
        ))}
        {remaining > 0 && (
          <li className="text-[12px] text-ink-faint italic pt-1">
            + {remaining} autre{remaining > 1 ? 's' : ''} manque{remaining > 1 ? 's' : ''}
          </li>
        )}
      </ul>
    </div>
  )
}
