'use client'

import type { ReactNode } from 'react'
import { Drawer } from 'vaul'

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Titre en haut du sheet (centré sous la poignée) */
  title?: string
  /** Description courte sous le titre */
  description?: string
  children: ReactNode
}

/**
 * Bottom sheet réutilisable basé sur vaul.
 * Pattern standard mobile 2026 pour le contenu secondaire (filtres, menus,
 * confirmations). Sur desktop, vaul reste fonctionnel mais on préfère
 * généralement un Dropdown — utiliser via useMediaQuery côté caller.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: BottomSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content
          className="fixed bottom-0 inset-x-0 z-50 mt-24 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-border-soft bg-paper outline-none focus:outline-none"
          aria-describedby={description ? 'bottom-sheet-description' : undefined}
        >
          {/* Drag handle */}
          <div aria-hidden className="mx-auto my-3 h-1.5 w-12 rounded-full bg-muted shrink-0" />
          {title && (
            <Drawer.Title className="text-base font-semibold text-center px-6 pb-1">
              {title}
            </Drawer.Title>
          )}
          {description ? (
            <Drawer.Description
              id="bottom-sheet-description"
              className="text-sm text-ink-mute text-center px-6 pb-3"
            >
              {description}
            </Drawer.Description>
          ) : (
            <Drawer.Description className="sr-only">Menu d'actions</Drawer.Description>
          )}
          <div className="flex-1 overflow-y-auto px-4 pb-6">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
