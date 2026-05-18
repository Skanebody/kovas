'use client'

import { Loader2, Plus } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import { addMissionToDossierAction } from './actions'

const GROUPS: { label: string; types: string[] }[] = [
  { label: 'DPE', types: ['dpe_vente', 'dpe_location', 'copropriete'] },
  { label: 'Amiante', types: ['amiante_vente', 'amiante_avant_travaux'] },
  { label: 'Autres', types: ['plomb_crep', 'gaz', 'electricite', 'termites', 'carrez_boutin', 'erp'] },
]

export function AddMissionButton({
  dossierId,
  existingTypes,
}: {
  dossierId: string
  existingTypes: string[]
}) {
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState<string | null>(null)

  function handleAdd(type: string) {
    setAdding(type)
    startTransition(async () => {
      try {
        await addMissionToDossierAction(dossierId, type)
      } finally {
        setAdding(null)
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Ajouter un diagnostic
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        {GROUPS.map((g, i) => (
          <div key={g.label}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{g.label}</DropdownMenuLabel>
            {g.types.map((type) => {
              const already = existingTypes.includes(type)
              return (
                <DropdownMenuItem
                  key={type}
                  disabled={already || adding === type}
                  onClick={() => handleAdd(type)}
                >
                  <span className={already ? 'text-muted-foreground' : ''}>
                    {MISSION_TYPE_LABELS[type] ?? type}
                    {already && ' (déjà ajouté)'}
                  </span>
                </DropdownMenuItem>
              )
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
