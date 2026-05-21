'use client'

import { cn } from '@/lib/utils'

interface SettingsSwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label: string
}

/**
 * Toggle iOS-style — track rounded-pill, dot blanc qui slide, on=green #34C759.
 *
 * Accessibilité : `role="switch"`, `aria-checked`, `aria-label` requis.
 * Transition `transform` smooth 200ms.
 */
export function SettingsSwitch({ checked, onChange, disabled, label }: SettingsSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer rounded-full',
        'transition-colors duration-200 ease-out',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F1419]/20',
        checked ? 'bg-[#34C759]' : 'bg-[#E5E5EA]',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white',
          'shadow-[0_2px_4px_rgba(0,0,0,0.2),0_0_1px_rgba(0,0,0,0.04)]',
          'transition-transform duration-200 ease-out',
          checked ? 'translate-x-[20px]' : 'translate-x-0',
        )}
      />
    </button>
  )
}
