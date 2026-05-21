'use client'

import { cn } from '@/lib/utils'
import { Camera, FilePlus2, FileText, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

interface PropertyFabProps {
  propertyId: string
}

/**
 * FAB radial bottom-right pour la page bien SIMP-2.
 * Click → Nouveau dossier / Photo / Document.
 */
export function PropertyFab({ propertyId }: PropertyFabProps) {
  const [open, setOpen] = useState(false)

  const items = [
    {
      icon: FilePlus2,
      label: 'Nouveau dossier',
      href: `/dashboard/dossiers/new?propertyId=${propertyId}`,
    },
    {
      icon: Camera,
      label: 'Photo',
      href: `/dashboard/properties/${propertyId}/edit`,
    },
    {
      icon: FileText,
      label: 'Document',
      href: `/dashboard/properties/${propertyId}/edit`,
    },
  ]

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {open ? (
        <ul className="flex flex-col items-end gap-2 animate-fade-in">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 rounded-pill bg-paper px-4 py-2 text-[12px] font-medium text-ink shadow-md border border-rule/40 hover:bg-foreground/5"
                >
                  <Icon className="size-4" strokeWidth={1.5} />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fermer le menu rapide' : 'Ouvrir le menu rapide'}
        aria-expanded={open}
        className={cn(
          'flex size-14 items-center justify-center rounded-full',
          'bg-chartreuse text-ink shadow-lg hover:bg-chartreuse-deep',
          'transition-transform duration-fast active:scale-95',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy/20',
        )}
      >
        {open ? (
          <X className="size-6" strokeWidth={2} />
        ) : (
          <Plus className="size-6" strokeWidth={2} />
        )}
      </button>
    </div>
  )
}
