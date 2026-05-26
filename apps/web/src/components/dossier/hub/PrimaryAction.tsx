'use client'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import type { PrimaryAction as PrimaryActionType } from '@/lib/dossier/states'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

interface PrimaryActionProps {
  action: PrimaryActionType
  dossierId: string
}

interface StartMissionResponse {
  ok: boolean
  sessionId?: string
  redirectTo?: string
  error?: string
}

/**
 * Action primaire contextuelle (bouton chartreuse) — droite du HubHeader.
 * Branche sur `actionId` pour exécuter un server action, ou `href` pour navigation.
 *
 * FIX-JJ : `start_mission` câblé sur POST /api/dossiers/[id]/start-mission qui
 * démarre une mission_session + redirige vers le mode tchat IA full-screen.
 */
export function PrimaryAction({ action, dossierId }: PrimaryActionProps) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  if (action.hidden) return null

  function handleClick() {
    if (!action.actionId) return
    startTransition(async () => {
      switch (action.actionId) {
        case 'start_mission': {
          try {
            const res = await fetch(`/api/dossiers/${dossierId}/start-mission`, {
              method: 'POST',
            })
            const json = (await res.json()) as StartMissionResponse
            if (!res.ok || !json.ok) {
              toast.error(json.error ?? 'Impossible de démarrer la mission.')
              return
            }
            router.push(json.redirectTo ?? `/dashboard/dossiers/${dossierId}/mission/tchat`)
          } catch {
            toast.error('Erreur réseau — vérifie ta connexion.')
          }
          break
        }
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
    <Button variant={action.variant ?? 'accent'} onClick={handleClick} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {action.label}
    </Button>
  )
}
