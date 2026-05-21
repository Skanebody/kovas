'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Menu, MoreHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'

interface DossierContextBarProps {
  /** Titre principal (ex: "DPE Mme Dupont"). Tronqué si trop long. */
  title: string
  /** Sous-titre mono (ex: "12 rue République · Dieppe"). */
  subtitle: string
  /** Appelé au clic sur le burger (≡) — ouvre le drawer sections. */
  onOpenSectionsDrawer: () => void
  /** Appelé au clic sur "Vérifier" — ouvre le bottom sheet bilan. */
  onVerify: () => void
  /** Slot optionnel pour menu Plus (Dupliquer/Archiver/Supprimer). */
  moreMenu?: ReactNode
}

/**
 * Context bar sticky (56px) du dossier — V5 simplifié.
 *
 * Layout grid-cols-[auto_1fr_auto] :
 *  - Gauche : burger (≡) → drawer sections
 *  - Centre : titre + sous-titre mono
 *  - Droite : bouton "Vérifier" + menu Plus
 *
 * Conforme V5 brand : bg paper + border-b 1px, pas de glow/gradient.
 */
export function DossierContextBar({
  title,
  subtitle,
  onOpenSectionsDrawer,
  onVerify,
  moreMenu,
}: DossierContextBarProps) {
  return (
    <div className="sticky top-0 z-30 bg-paper border-b border-rule/60">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 sm:px-6 h-14">
        {/* Burger gauche */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ouvrir les sections du dossier"
          onClick={onOpenSectionsDrawer}
        >
          <Menu className="size-5" />
        </Button>

        {/* Centre : titre + sous-titre */}
        <div className="min-w-0 flex flex-col leading-tight">
          <span className="font-sans font-medium text-[15px] text-ink truncate">{title}</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute truncate">
            {subtitle}
          </span>
        </div>

        {/* Droite : Vérifier + Plus */}
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onVerify}>
            Vérifier
          </Button>
          {moreMenu ?? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Plus d'actions">
                  <MoreHorizontal className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled className="text-ink-mute">
                  Dupliquer (bientôt)
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="text-ink-mute">
                  Archiver (bientôt)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-ink-mute">
                  Supprimer (bientôt)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  )
}
