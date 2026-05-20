'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DossierVisualState } from '@/lib/dossier/types'
import { cn } from '@/lib/utils'
import {
  Archive,
  Download,
  Edit3,
  MoreHorizontal,
  Pause,
  RotateCcw,
  Share2,
  Trash2,
} from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'

export interface DossierMenuItem {
  id: string
  label: string
  icon: ReactNode
  /** Action déclenchée au click (déjà bound côté page). */
  onSelect: (event: Event) => void
  /** Variante "destructive" (rouge) — séparé du reste. */
  destructive?: boolean
  disabled?: boolean
}

interface DossierStickyMenuProps {
  state: DossierVisualState
  /** Items dynamiques injectés depuis la page d'assemblage. */
  items?: DossierMenuItem[]
  className?: string
}

/**
 * Menu ⋯ déroulant utilisé dans la sticky bar bottom.
 *
 * - Items "courants" affichés en premier
 * - Items destructifs en bas, séparés par un divider, texte rouge
 *
 * Si aucun `items` n'est fourni, on utilise un set par défaut adapté à
 * l'état (Édition, Partage, Pause/Reprendre, Archive, Supprimer).
 */
export function DossierStickyMenu({ state, items, className }: DossierStickyMenuProps) {
  const resolvedItems = items ?? defaultItemsFor(state)
  const standard = resolvedItems.filter((i) => !i.destructive)
  const destructive = resolvedItems.filter((i) => i.destructive)

  const stopBubble = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Actions du dossier"
          className={cn('size-11', className)}
          onClick={stopBubble}
        >
          <MoreHorizontal className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
        {standard.map((item) => (
          <DropdownMenuItem key={item.id} onSelect={item.onSelect} disabled={item.disabled}>
            <span aria-hidden className="text-ink-mute">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </DropdownMenuItem>
        ))}

        {destructive.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {destructive.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onSelect={item.onSelect}
                disabled={item.disabled}
                className="text-danger focus:text-danger focus:bg-coral-mist"
              >
                <span aria-hidden className="text-danger">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function defaultItemsFor(state: DossierVisualState): DossierMenuItem[] {
  const noop = (event: Event): void => {
    event.preventDefault()
  }
  const baseItems: DossierMenuItem[] = [
    {
      id: 'edit',
      label: 'Éditer les infos',
      icon: <Edit3 className="size-4" />,
      onSelect: noop,
    },
    {
      id: 'share',
      label: 'Partager',
      icon: <Share2 className="size-4" />,
      onSelect: noop,
    },
  ]

  if (state === 'in-progress') {
    baseItems.push({
      id: 'pause',
      label: 'Mettre en pause',
      icon: <Pause className="size-4" />,
      onSelect: noop,
    })
  }

  if (state === 'completed') {
    baseItems.push(
      {
        id: 'reopen',
        label: 'Ré-ouvrir le dossier',
        icon: <RotateCcw className="size-4" />,
        onSelect: noop,
      },
      {
        id: 'export',
        label: 'Exporter',
        icon: <Download className="size-4" />,
        onSelect: noop,
      },
    )
  }

  baseItems.push(
    {
      id: 'archive',
      label: 'Archiver',
      icon: <Archive className="size-4" />,
      onSelect: noop,
    },
    {
      id: 'delete',
      label: 'Supprimer le dossier',
      icon: <Trash2 className="size-4" />,
      onSelect: noop,
      destructive: true,
    },
  )

  return baseItems
}
