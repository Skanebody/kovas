import { cn } from '@/lib/utils'
import { MISSION_PASTEL_CLASS, MISSION_TYPE_LABEL } from '@/lib/mission-pastels'
import type { MissionType } from '@kovas/shared'
import type { HTMLAttributes } from 'react'

interface MissionTypeTagProps extends HTMLAttributes<HTMLSpanElement> {
  type: MissionType | string
  size?: 'short' | 'full'
}

/** Label chip diagnostic — DS v3 §2.6 */
export function MissionTypeTag({ type, size = 'short', className, ...props }: MissionTypeTagProps) {
  const pastelClass = MISSION_PASTEL_CLASS[type as MissionType]
  const label =
    size === 'short'
      ? (MISSION_TYPE_LABEL[type as MissionType] ?? type)
      : (MISSION_TYPE_LABEL[type as MissionType] ?? type)

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-md font-display text-[10px] font-semibold uppercase tracking-[0.06em]',
        pastelClass ?? 'bg-cream-deep text-ink-mute',
        className,
      )}
      {...props}
    >
      {label}
    </span>
  )
}
