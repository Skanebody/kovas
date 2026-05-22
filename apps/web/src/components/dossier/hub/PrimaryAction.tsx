'use client'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import type { PrimaryAction as PrimaryActionType } from '@/lib/dossier/states'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useTransition } from 'react'

interface PrimaryActionProps {
  action: PrimaryActionType
  dossierId: string
}

/**
 * Action primaire contextuelle (bouton chartreuse) — droite du HubHeader.
 * Branche sur `actionId` pour exécuter un server action, ou `href` pour navigation.
 *
 * Les server actions non encore implémentées affichent un toast info.
 */
export function PrimaryAction({ action, dossierId: _dossierId }: PrimaryActionProps) {
  const [pending, startTransition] = useTransition()
  if (action.hidden) return null

  function handleClick() {
    if (!action.actionId) return
    startTransition(async () => {
      // V1 : nombre d'actions encore non câblées au backend (envoi client, facture, relance, etc.)
      // → toast info pour ne pas bloquer la navigation
      switch (action.actionId) {
        case 'prepare':
        case 'sync':
        case 'export':
        case 'send':
        case 'invoice':
        case 'reminder_payment':
        case 'litigation':
        case 'restore':
        case 'schedule':
        case 'archive':
          toast.info(`Action "${action.label}" sera disponible prochainement.`)
          break
        default:
          toast.info(`Action "${action.label}" déclenchée.`)
      }
    })
  }

  if (action.href) {
    return (
      <Button variant={action.variant ?? 'accent'} asChild>
        <Link href={action.href}>{action.label}</Link>
      </Button>
    )
  }

  return (
    <Button
      variant={action.variant ?? 'accent'}
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {action.label}
    </Button>
  )
}
