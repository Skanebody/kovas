'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { Drawer } from 'vaul'

export interface DossierSectionItem {
  /** Id stable utilisé en URL hash et activeSection state. Ex: "00-preparation", "01-dpe", "99-documents". */
  id: string
  /** Numéro affiché à gauche du nom (ex: "00", "01", "99"). */
  number: string
  /** Label visible. Ex: "Préparation", "DPE", "Documents". */
  label: string
  /** Etat de la section. */
  state: 'current' | 'done' | 'pending'
}

interface DossierSectionsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sections: DossierSectionItem[]
  activeSectionId: string
  onSelect: (sectionId: string) => void
}

/**
 * Drawer hamburger gauche listant les sections du dossier (numérotées).
 * Pattern vaul direction="left" — pas de Sheet Radix dispo dans le projet.
 *
 * États visuels par section :
 *  - current : border navy + bg navy/5
 *  - done    : Check chartreuse à droite
 *  - pending : border navy/15 + text-ink-mute
 */
export function DossierSectionsDrawer({
  open,
  onOpenChange,
  sections,
  activeSectionId,
  onSelect,
}: DossierSectionsDrawerProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction="left">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content
          className="fixed top-0 bottom-0 left-0 z-50 w-[280px] flex flex-col bg-paper border-r border-rule outline-none focus:outline-none"
          aria-describedby="dossier-sections-description"
        >
          <Drawer.Title className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute px-6 pt-6 pb-2">
            Sections du dossier
          </Drawer.Title>
          <Drawer.Description id="dossier-sections-description" className="sr-only">
            Navigation entre les sections du dossier.
          </Drawer.Description>

          <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-1.5">
            {sections.map((s) => {
              const isCurrent = s.id === activeSectionId
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-colors duration-fast',
                    isCurrent
                      ? 'border-navy bg-navy/5 text-ink'
                      : s.state === 'done'
                        ? 'border-navy/15 bg-paper text-ink hover:bg-cream-deep'
                        : 'border-navy/15 bg-paper text-ink-mute hover:bg-cream-deep hover:text-ink',
                  )}
                  aria-current={isCurrent ? 'true' : undefined}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute shrink-0">
                      {s.number}
                    </span>
                    <span className="font-sans text-[13px] font-medium truncate">{s.label}</span>
                  </span>
                  {s.state === 'done' && (
                    <Check
                      className="size-4 text-chartreuse shrink-0"
                      aria-label="Section complète"
                    />
                  )}
                </button>
              )
            })}
          </nav>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
