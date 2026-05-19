'use client'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { cn } from '@/lib/utils'
import { Building2, FileText, Mic, Plus, Receipt, Users } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

/**
 * MobileQuickActions — FAB central + bottom sheet "Nouveau".
 * Spec v4 §4 (BottomNav central [+]) + §16.1 (sheet création rapide).
 *
 * Mobile uniquement (< md). Le FAB est positionné au centre du BottomNav
 * (offset négatif) pour pop visuellement. Click ouvre une bottom sheet
 * vaul avec 5 actions canoniques :
 * - Nouveau dossier
 * - Nouveau client
 * - Nouveau bien (V1.5 disabled state)
 * - Nouveau devis (V1.5 disabled state)
 * - Démarrer une mission (nav vers dashboard ou dossier en cours)
 */
export function MobileQuickActionsFab() {
  const [open, setOpen] = useState(false)

  const items = [
    {
      href: '/app/dossiers/new',
      icon: FileText,
      label: 'Nouveau dossier',
      hint: 'Adresse + diagnostics + client',
      available: true,
    },
    {
      href: '/app/clients/new',
      icon: Users,
      label: 'Nouveau client',
      hint: 'Propriétaire, agence ou syndic',
      available: true,
    },
    {
      href: '/app/properties/new',
      icon: Building2,
      label: 'Nouveau bien',
      hint: 'Adresse + caractéristiques',
      available: true,
    },
    {
      href: '/app/facturation',
      icon: Receipt,
      label: 'Nouveau devis',
      hint: 'Disponible V1.5',
      available: false,
    },
    {
      href: '/app/dashboard',
      icon: Mic,
      label: 'Démarrer une mission',
      hint: 'Reprendre la mission en cours',
      available: true,
    },
  ]

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Créer rapidement"
        className={cn(
          'md:hidden fixed bottom-[72px] left-1/2 -translate-x-1/2 z-40',
          'flex size-14 items-center justify-center rounded-full',
          /* v5 : accent UNIQUE chartreuse Synthex (était bg-amber v4) */
          'bg-chartreuse text-ink shadow-[0_6px_18px_rgba(212,245,66,0.45)] hover:bg-chartreuse-deep',
          'transition-transform duration-fast ease-spring active:scale-95',
          'ring-4 ring-white/20',
        )}
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </button>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Nouveau"
        description="Créer rapidement un dossier, client, ou démarrer une mission"
      >
        <ul className="space-y-1.5 pb-2">
          {items.map((item) => {
            const Icon = item.icon
            if (!item.available) {
              return (
                <li
                  key={item.label}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 bg-cream-deep/40 text-ink-ghost"
                >
                  <Icon className="size-5 shrink-0" strokeWidth={1.75} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-[11px]">{item.hint}</p>
                  </div>
                </li>
              )
            }
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-3',
                    'text-ink hover:bg-cream-deep/60 active:bg-cream-deep',
                    'transition-colors duration-fast',
                  )}
                >
                  <span
                    aria-hidden
                    className="flex size-9 items-center justify-center rounded-full bg-cyan-light text-navy-900"
                  >
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="text-[11px] text-ink-mute">{item.hint}</p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </BottomSheet>
    </>
  )
}
