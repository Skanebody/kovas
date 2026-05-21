'use client'

import { cn } from '@/lib/utils'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronLeft, X } from 'lucide-react'
import type { ReactNode } from 'react'

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
}

/**
 * Sheet drawer style iOS — slide-in depuis la droite (desktop) ou plein écran
 * (mobile). Header avec back-chevron + titre centré + close X.
 *
 * Utilise Radix Dialog primitives pour focus trap + aria + escape close gratuits.
 * Animation transform translateX driven par data-state, durée 250ms ease-out.
 */
export function SettingsSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: SettingsSheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-[#0F1419]/30 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'duration-200',
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50 bg-[#F5F7F4] shadow-2xl',
            // Mobile : bottom sheet plein écran
            'inset-x-0 bottom-0 top-0 sm:top-auto',
            // Desktop : slide-in droite, largeur fixe
            'sm:inset-y-0 sm:right-0 sm:left-auto sm:bottom-auto sm:w-full sm:max-w-md',
            'flex flex-col',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
            'duration-250',
          )}
        >
          {/* Header */}
          <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#0F1419]/[0.08] bg-white/50 backdrop-blur">
            <DialogPrimitive.Close className="size-9 -ml-1 flex items-center justify-center rounded-full hover:bg-[#0F1419]/[0.05] transition-colors">
              <ChevronLeft className="size-5 text-[#007AFF]" strokeWidth={2.5} />
              <span className="sr-only">Retour</span>
            </DialogPrimitive.Close>
            <DialogPrimitive.Title className="text-[15px] font-semibold text-[#0F1419] truncate">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="size-9 -mr-1 flex items-center justify-center rounded-full hover:bg-[#0F1419]/[0.05] transition-colors">
              <X className="size-4 text-[#0F1419]/55" strokeWidth={2.5} />
              <span className="sr-only">Fermer</span>
            </DialogPrimitive.Close>
          </header>
          {description && (
            <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>
          )}

          {/* Content scrollable */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
