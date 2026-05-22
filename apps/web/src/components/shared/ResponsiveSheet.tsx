'use client'

import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Drawer } from 'vaul'

/**
 * ResponsiveSheet — Principe de fluidité #7 (V5).
 *
 * Helper qui adapte l'affichage selon la taille d'écran :
 * — Mobile (<768px) : bottom sheet (slide-up depuis le bas, vaul)
 * — Desktop (≥768px) : side drawer fixe à droite (480px)
 *
 * Remplace toutes les modales bloquantes centrales pour les actions UX
 * importantes (édition, confirmation, sélection).
 *
 * Le détection est SSR-safe via un placeholder côté serveur, puis bascule
 * sur le mode réel après hydratation.
 *
 * @example
 *   <ResponsiveSheet isOpen={open} onClose={() => setOpen(false)} title="Modifier le client">
 *     <ClientForm onSubmit={…} />
 *   </ResponsiveSheet>
 */

interface ResponsiveSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  /** Largeur du drawer desktop. Défaut 480px. */
  desktopWidth?: number
  /** Désactive la fermeture sur backdrop click. */
  preventBackdropClose?: boolean
}

/** Breakpoint mobile/desktop — aligné Tailwind `md` (768px). */
const DESKTOP_BREAKPOINT = 768

function useIsDesktop(): boolean {
  // null = pas encore hydraté → on rend en mobile par défaut (mobile-first)
  const [isDesktop, setIsDesktop] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`)
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isDesktop
}

export function ResponsiveSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  desktopWidth = 480,
  preventBackdropClose = false,
}: ResponsiveSheetProps) {
  const isDesktop = useIsDesktop()

  // Escape ferme partout
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (isDesktop) {
    return (
      <DesktopDrawer
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        description={description}
        width={desktopWidth}
        preventBackdropClose={preventBackdropClose}
      >
        {children}
      </DesktopDrawer>
    )
  }

  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      preventBackdropClose={preventBackdropClose}
    >
      {children}
    </MobileSheet>
  )
}

/* ----------------------------------------------------------------------- */
/* Mobile : bottom sheet (vaul)                                             */
/* ----------------------------------------------------------------------- */

function MobileSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  preventBackdropClose,
}: {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  preventBackdropClose: boolean
}) {
  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      dismissible={!preventBackdropClose}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-sidebar-bg/40 animate-fade-in" />
        <Drawer.Content
          className={cn(
            'fixed bottom-0 inset-x-0 z-50 mt-24 flex flex-col outline-none focus:outline-none',
            'bg-paper border-t border-rule',
            'max-h-[85vh] overflow-hidden',
          )}
        >
          {/* Handle grip */}
          <div
            aria-hidden
            className="mx-auto mt-3 mb-2 h-1 w-9 rounded-full bg-sidebar-bg/40 shrink-0"
          />
          {title && (
            <Drawer.Title className="px-4 pt-2 pb-1 text-[18px] font-bold text-ink">
              {title}
            </Drawer.Title>
          )}
          {description ? (
            <Drawer.Description className="px-4 pb-2 text-sm text-ink-mute">
              {description}
            </Drawer.Description>
          ) : (
            <Drawer.Description className="sr-only">
              Panneau d&apos;action
            </Drawer.Description>
          )}
          <div className="flex-1 overflow-y-auto px-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-1">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

/* ----------------------------------------------------------------------- */
/* Desktop : side drawer custom                                             */
/* ----------------------------------------------------------------------- */

function DesktopDrawer({
  isOpen,
  onClose,
  title,
  description,
  width,
  preventBackdropClose,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  width: number
  preventBackdropClose: boolean
  children: ReactNode
}) {
  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Panneau d’action'}
      className="fixed inset-0 z-50"
    >
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={preventBackdropClose ? undefined : onClose}
        className="absolute inset-0 bg-sidebar-bg/40 animate-fade-in"
      />
      {/* Drawer panel */}
      <aside
        style={{ width }}
        className={cn(
          'absolute top-0 right-0 bottom-0 bg-paper border-l border-rule shadow-glass-hover',
          'flex flex-col overflow-hidden animate-slide-up',
          'max-w-[calc(100vw-2rem)]',
        )}
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3 border-b border-rule">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[18px] font-bold text-ink truncate">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-ink-mute mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 rounded-md p-1.5 text-ink-mute hover:bg-sidebar-bg/5 hover:text-ink transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/45"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </aside>
    </div>
  )
}
