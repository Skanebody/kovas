'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/toaster'
import { Loader2, MoreVertical, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { softDeleteDossierAction } from '../actions'

interface DossierMoreMenuProps {
  dossierId: string
}

/**
 * Menu Plus (⋮) en haut à droite du dossier.
 * V1 : seul Supprimer (soft-delete) est exposé. Les items Dupliquer / Archiver
 * sont retirés tant que les server actions ne sont pas branchées (un menu doit
 * montrer ce qui marche, pas un catalogue d'intentions).
 *
 * TODO V1.5 : réactiver duplicate + archive avec actions branchées.
 */
export function DossierMoreMenu({ dossierId }: DossierMoreMenuProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    if (typed.trim().toLowerCase() !== 'supprimer') {
      toast.error('Tapez "supprimer" pour confirmer')
      return
    }
    startTransition(async () => {
      try {
        await softDeleteDossierAction(dossierId)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur suppression')
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Plus d'actions">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => setConfirmOpen(true)}
            className="text-accent-red focus:text-accent-red"
          >
            <Trash2 className="size-4" /> Supprimer le dossier
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {confirmOpen && (
        // biome-ignore lint/a11y/useSemanticElements: pattern fixed+backdrop (pas <dialog>)
        // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click pour fermer — pattern modal standard
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmer la suppression"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => !pending && setConfirmOpen(false)}
        >
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation interne, pas une action keyboard */}
          <div
            className="w-full max-w-sm glass rounded-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Supprimer ce dossier ?</h3>
              <p className="text-sm text-[#0F1419]/72">
                Le dossier sera invisible (soft-delete). Les données restent en base 30 jours puis
                sont purgées. Tapez{' '}
                <code className="rounded bg-sage-alt px-1 py-0.5 font-mono text-xs">supprimer</code>{' '}
                pour confirmer.
              </p>
            </div>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="flex h-9 w-full rounded-md border border-[#0F1419]/[0.08] bg-paper px-3 text-sm"
              placeholder="supprimer"
              // biome-ignore lint/a11y/noAutofocus: confirmation modal — autofocus voulu pour validation rapide
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={pending || typed.trim().toLowerCase() !== 'supprimer'}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
