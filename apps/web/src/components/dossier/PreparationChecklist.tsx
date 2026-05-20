'use client'

import { Card } from '@/components/ui/card'
import type { PreparationItem as PreparationItemModel } from '@/lib/dossier/types'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface PreparationItemProps {
  item: PreparationItemModel
  onToggle?: (id: PreparationItemModel['id'], next: boolean) => void
  className?: string
}

/** Item unitaire de la checklist (checkbox + label). */
export function PreparationItem({ item, onToggle, className }: PreparationItemProps) {
  const interactive = typeof onToggle === 'function'

  const inner = (
    <>
      <span
        aria-hidden
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-sm border-2 transition-colors',
          item.done
            ? 'border-success bg-success text-paper'
            : 'border-rule bg-paper text-transparent',
        )}
      >
        {item.done && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span
        className={cn(
          'text-sm',
          item.done
            ? 'text-ink-mute line-through decoration-rule decoration-1 underline-offset-2'
            : 'text-ink',
        )}
      >
        {item.label}
      </span>
    </>
  )

  return (
    <li className={cn(className)}>
      {interactive ? (
        <button
          type="button"
          onClick={() => onToggle?.(item.id, !item.done)}
          aria-pressed={item.done}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
            'hover:bg-sage-alt/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30',
          )}
        >
          {inner}
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-md px-3 py-2.5">{inner}</div>
      )}
    </li>
  )
}

interface PreparationChecklistProps {
  items: PreparationItemModel[]
  onToggle?: (id: PreparationItemModel['id'], next: boolean) => void
  className?: string
}

/**
 * Checklist de préparation (état to-start).
 *
 * Affiche un compteur "X/Y" en haut à droite + items checkboxes empilés.
 * `onToggle` rend les items interactifs (autrement, lecture seule).
 */
export function PreparationChecklist({ items, onToggle, className }: PreparationChecklistProps) {
  const doneCount = items.filter((i) => i.done).length

  return (
    <Card variant="opaque" padding="default" className={cn(className)}>
      <div className="flex items-center gap-3">
        <h3 className="font-serif italic font-normal text-xl text-ink flex-1">
          Préparation de la mission
        </h3>
        <span
          className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute"
          aria-label={`Progression préparation : ${doneCount} sur ${items.length}`}
        >
          {doneCount}/{items.length}
        </span>
      </div>

      <ul className="mt-4 flex flex-col gap-1">
        {items.map((item) => (
          <PreparationItem key={item.id} item={item} onToggle={onToggle} />
        ))}
      </ul>
    </Card>
  )
}
