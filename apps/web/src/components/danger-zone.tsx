'use client'

import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DangerZoneProps {
  /** Server action qui fait le soft-delete. Lance une erreur si problème. */
  onDelete: () => Promise<void>
  /** Label de l'entité supprimée — "client", "bien", "dossier", ... */
  entityLabel: string
  /** Confirmation textuelle obligatoire (ex: tape "supprimer" pour confirmer) */
  confirmWord?: string
}

export function DangerZone({ onDelete, entityLabel, confirmWord = 'supprimer' }: DangerZoneProps) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      try {
        await onDelete()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur')
      }
    })
  }

  return (
    <Card className="border-accent-red/40">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-accent-red">
          <AlertTriangle className="size-4" /> Zone sensible
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!open ? (
          <>
            <p className="text-sm text-ink-mute">
              La suppression de ce {entityLabel} le rend invisible (soft-delete). Les données
              restent en base 30 jours puis sont purgées.
            </p>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Trash2 className="size-4 text-accent-red" />
              Supprimer ce {entityLabel}
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              Pour confirmer, tapez{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                {confirmWord}
              </code>{' '}
              dans le champ ci-dessous :
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border bg-paper px-3 text-sm"
              placeholder={confirmWord}
            />
            {error && <p className="text-sm text-accent-red">{error}</p>}
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleDelete}
                disabled={typed.trim().toLowerCase() !== confirmWord.toLowerCase() || isPending}
                className="bg-accent-red hover:bg-accent-red/80"
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Confirmer la suppression
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpen(false)
                  setTyped('')
                  setError(null)
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
