'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { Drawer } from 'vaul'

/* ----------------------------------------------------------------------- */
/* BottomSheet — composant réutilisable                                     */
/* ----------------------------------------------------------------------- */

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Titre legacy en haut du sheet (centré sous la poignée).
   * Préférer `<BottomSheetTitle>` enfant pour plus de contrôle.
   */
  title?: string
  /**
   * Description legacy courte sous le titre.
   * Préférer `<BottomSheetBody>` enfant.
   */
  description?: string
  /** Hauteur max du contenu. Défaut 80vh. */
  maxHeight?: string
  /** Désactive le snap point pour les mobiles natifs. */
  dismissible?: boolean
  children: ReactNode
}

/**
 * Bottom sheet réutilisable basé sur vaul.
 *
 * Spec V5 (simplification radicale) :
 * — Coins supérieurs SHARP (cohérent V5 angles vifs — pas de rounded-t)
 * — Animation slide-up 300ms ease-out (gérée par vaul)
 * — Handle visuel en haut : trait 36×4px navy/40 centré (swipe-to-close)
 * — Padding : 24px top, 16px sides, 32px bottom (safe-area iOS via pb-[env(safe-area-inset-bottom)])
 * — Backdrop bg-black/40 + click-outside close (géré par vaul)
 * — Swipe gesture support natif vaul
 *
 * Usage moderne (recommandé) :
 * ```tsx
 * <BottomSheet open={open} onOpenChange={setOpen}>
 *   <BottomSheetTitle>Confirmer l'envoi</BottomSheetTitle>
 *   <BottomSheetBody>...</BottomSheetBody>
 *   <BottomSheetActions primary="Envoyer" onPrimary={...} secondary="Annuler" />
 * </BottomSheet>
 * ```
 *
 * Usage legacy (compatibilité ascendante via props `title` / `description`).
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  maxHeight = '80vh',
  dismissible = true,
  children,
}: BottomSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} dismissible={dismissible}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content
          className={cn(
            'fixed bottom-0 inset-x-0 z-50 mt-24 flex flex-col outline-none focus:outline-none',
            'bg-paper border-t border-sidebar-bg/15',
          )}
          style={{ maxHeight }}
          aria-describedby={description ? 'bottom-sheet-description' : undefined}
        >
          {/* Handle 36×4px navy/40 — invite swipe-to-close */}
          <div
            aria-hidden
            className="mx-auto mt-3 mb-2 h-1 w-9 rounded-full bg-sidebar-bg/40 shrink-0"
          />

          {/* Legacy props (title/description) — affichage centré */}
          {title && (
            <Drawer.Title className="text-base font-semibold text-center px-6 pb-1 text-ink">
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
            <Drawer.Description className="sr-only">Menu d&apos;actions</Drawer.Description>
          )}

          {/* Conteneur scroll. Padding : 24px top (déjà via handle), 16px x, 32px bottom + safe-area iOS */}
          <div
            className={cn(
              'flex-1 overflow-y-auto px-4',
              // 32px bottom + safe-area iOS
              'pb-[calc(2rem+env(safe-area-inset-bottom,0px))]',
              // 24px top si pas de title legacy
              !title && 'pt-3',
            )}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

/* ----------------------------------------------------------------------- */
/* Sous-composants                                                          */
/* ----------------------------------------------------------------------- */

interface BottomSheetTitleProps {
  children: ReactNode
  className?: string
}

/** Titre principal du bottom sheet — typo H3 (Manrope bold 18px). */
export function BottomSheetTitle({ children, className }: BottomSheetTitleProps) {
  return (
    <Drawer.Title className={cn('px-4 pt-2 pb-1 text-[18px] font-bold text-ink', className)}>
      {children}
    </Drawer.Title>
  )
}

interface BottomSheetBodyProps {
  children: ReactNode
  className?: string
}

/** Body principal du bottom sheet — texte standard 14px ink-soft. */
export function BottomSheetBody({ children, className }: BottomSheetBodyProps) {
  return <div className={cn('px-4 py-3 text-sm text-ink-soft', className)}>{children}</div>
}

interface BottomSheetActionsProps {
  /** Libellé du CTA primaire (action confirmation). */
  primary: string
  onPrimary: () => void
  /** Libellé du CTA secondaire (annulation). Optionnel. */
  secondary?: string
  onSecondary?: () => void
  /** Désactive le primary (loading par ex). */
  primaryDisabled?: boolean
  /** Variant destructive (rouge) pour suppression. */
  destructive?: boolean
}

/**
 * Footer actions : 2 boutons empilés mobile, alignés à droite desktop.
 * Conforme à la spec "une seule action primaire" — secondaire est juste l'échappatoire.
 */
export function BottomSheetActions({
  primary,
  onPrimary,
  secondary,
  onSecondary,
  primaryDisabled,
  destructive,
}: BottomSheetActionsProps) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-4 pt-4">
      {secondary && (
        <Button type="button" variant="outline" onClick={onSecondary} className="sm:w-auto w-full">
          {secondary}
        </Button>
      )}
      <Button
        type="button"
        variant={destructive ? 'destructive' : 'default'}
        onClick={onPrimary}
        disabled={primaryDisabled}
        className="sm:w-auto w-full"
      >
        {primary}
      </Button>
    </div>
  )
}
