'use client'

import { useFieldMode } from '@/lib/hooks/use-field-mode'
import { cn } from '@/lib/utils'
import { HardHat } from 'lucide-react'

/**
 * Toggle Mode terrain — bouton inline header.
 * Visible mobile + tablette principalement. Aff. desktop OK aussi.
 *
 * Pressed state : bg chartreuse navy → indique l'activation visuellement.
 */
export function FieldModeToggle({ className }: { className?: string }) {
  const { active, toggle } = useFieldMode()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={active}
      aria-label={active ? 'Désactiver le mode terrain' : 'Activer le mode terrain'}
      title={active ? 'Mode terrain actif' : 'Activer mode terrain'}
      className={cn(
        'inline-flex items-center gap-1.5 size-9 justify-center rounded-full transition-colors',
        active
          ? 'bg-chartreuse text-ink hover:bg-chartreuse-deep'
          : 'text-ink-mute hover:text-ink hover:bg-sage',
        className,
      )}
    >
      <HardHat className="size-[18px]" strokeWidth={1.5} />
    </button>
  )
}
