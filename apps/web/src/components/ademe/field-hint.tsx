'use client'

import { Info } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

interface FieldHintProps {
  children: React.ReactNode
  /** Optionnel : message tooltip (icône Info) supplémentaire avec exemple concret. */
  tooltip?: string
  className?: string
}

/**
 * FieldHint — sous-texte explicatif court sous un FormField.
 *
 * - texte gris italic 11px (DS v5 sage/dark)
 * - si `tooltip` fourni : icône Info inline qui révèle un message au hover/click
 *
 * Pattern d'usage :
 *   <FormField label="Année de construction" required>
 *     <Input ... />
 *     <FieldHint tooltip="Ex : 1985, vérifiable sur les plans d'origine du bien">
 *       Date des plans d'origine
 *     </FieldHint>
 *   </FormField>
 */
export function FieldHint({ children, tooltip, className }: FieldHintProps) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={cn(
        'mt-1 flex items-start gap-1.5 text-[11px] italic text-ink-mute leading-snug',
        className,
      )}
    >
      <span className="flex-1">{children}</span>
      {tooltip ? (
        <span className="relative inline-flex shrink-0">
          <button
            type="button"
            aria-label="Voir un exemple"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onClick={(e) => {
              e.preventDefault()
              setOpen((v) => !v)
            }}
            className="inline-flex size-4 items-center justify-center rounded-full text-ink-mute hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
          >
            <Info className="size-3" />
          </button>
          {open ? (
            <span
              role="tooltip"
              className={cn(
                'absolute z-30 right-0 top-5 w-56 rounded-md border border-rule bg-paper p-2.5',
                'text-[11px] not-italic text-ink leading-relaxed shadow-glass-sm',
                'animate-in fade-in-0 zoom-in-95 duration-150',
              )}
            >
              {tooltip}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}
