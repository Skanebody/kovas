'use client'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useIsDesktop } from '@/lib/hooks/use-media-query'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import { Loader2, Plus } from 'lucide-react'
import { useState, useTransition } from 'react'
import { addMissionToDossierAction } from './actions'

const GROUPS: { label: string; types: string[] }[] = [
  { label: 'DPE', types: ['dpe_vente', 'dpe_location', 'copropriete'] },
  { label: 'Amiante', types: ['amiante_vente', 'amiante_avant_travaux'] },
  {
    label: 'Autres',
    types: ['plomb_crep', 'gaz', 'electricite', 'termites', 'carrez_boutin', 'erp'],
  },
]

interface AddMissionButtonProps {
  dossierId: string
  existingTypes: string[]
}

export function AddMissionButton({ dossierId, existingTypes }: AddMissionButtonProps) {
  const isDesktop = useIsDesktop()
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  function handleAdd(type: string) {
    setAdding(type)
    startTransition(async () => {
      try {
        await addMissionToDossierAction(dossierId, type)
        setSheetOpen(false)
      } finally {
        setAdding(null)
      }
    })
  }

  const triggerLabel = (
    <>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
      Ajouter un diagnostic
    </>
  )

  if (isDesktop) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={pending}>
            {triggerLabel}
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

  // Mobile : bottom sheet
  return (
    <>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => setSheetOpen(true)}>
        {triggerLabel}
      </Button>
      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Ajouter un diagnostic"
        description="Choisissez le type à ajouter au dossier"
      >
        <div className="space-y-4">
          {GROUPS.map((g) => (
            <div key={g.label} className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-2">
                {g.label}
              </p>
              {g.types.map((type) => {
                const already = existingTypes.includes(type)
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={already || adding === type}
                    onClick={() => handleAdd(type)}
                    className="w-full text-left rounded-md px-3 py-3 text-sm hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-between"
                  >
                    <span>{MISSION_TYPE_LABELS[type] ?? type}</span>
                    {already && <span className="text-xs text-muted-foreground">déjà ajouté</span>}
                    {adding === type && <Loader2 className="size-4 animate-spin" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </BottomSheet>
    </>
  )
}
