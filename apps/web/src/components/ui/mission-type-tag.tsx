import { cn } from '@/lib/utils'
import { MISSION_PASTEL_CLASS, MISSION_TYPE_LABEL } from '@/lib/mission-pastels'
import type { MissionType } from '@kovas/shared'
import type { HTMLAttributes } from 'react'

interface MissionTypeTagProps extends HTMLAttributes<HTMLSpanElement> {
  type: MissionType | string
  /** `short` = label compact (DPE, AMIANTE...) — défaut. `full` = label complet (DPE vente, Amiante avant travaux). */
  size?: 'short' | 'full'
}

/**
 * MissionTypeTag — pastille catégorielle Design System v2.
 * Affiche un type de diagnostic avec son fond pastel signature
 * (cf. lib/mission-pastels.ts + CLAUDE.md §9).
 *
 * Mapping :
 * - DPE / ERP        → butter (#FFF0C5)
 * - Électricité      → lime (#E5F0D5)
 * - Amiante/Termites → peach (#FFE0D5)
 * - Plomb            → lavender (#E8E0F5)
 * - Gaz / Carrez     → sky (#DAE8F5)
 */
export function MissionTypeTag({ type, size = 'short', className, ...props }: MissionTypeTagProps) {
  const pastelClass = MISSION_PASTEL_CLASS[type as MissionType]
  const label = size === 'short'
    ? MISSION_TYPE_LABEL[type as MissionType] ?? type
    : (MISSION_TYPE_LABEL[type as MissionType] ?? type)

  if (!pastelClass) {
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-[10.5px] font-semibold uppercase tracking-wider bg-muted text-ink-mute',
          className,
        )}
        {...props}
      >
        {label}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-[10.5px] font-semibold uppercase tracking-wider',
        pastelClass,
        className,
      )}
      {...props}
    >
      {label}
    </span>
  )
}
