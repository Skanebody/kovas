'use client'

import { Button } from '@/components/ui/button'
import { Loader2, Trash2 } from 'lucide-react'
import { useTransition } from 'react'
import { removeMissionFromDossierAction } from './actions'

export function RemoveMissionButton({
  missionId,
  missionLabel,
}: {
  missionId: string
  missionLabel: string
}) {
  const [pending, startTransition] = useTransition()

  function handle() {
    if (!confirm(`Retirer "${missionLabel}" de ce dossier ?`)) return
    startTransition(async () => {
      await removeMissionFromDossierAction(missionId)
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handle}
      disabled={pending}
      aria-label={`Retirer ${missionLabel}`}
      title="Retirer ce diagnostic du dossier"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4 text-ink-mute" />
      )}
    </Button>
  )
}
