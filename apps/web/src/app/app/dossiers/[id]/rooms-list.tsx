'use client'

import { DoorOpen, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useActionState, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ROOM_TEMPLATES } from '@/lib/room-templates'
import { addRoomAction, applyRoomTemplateAction, deleteRoomAction, type RoomFormState } from './actions'

const ROOM_TYPE_LABELS: Record<string, string> = {
  salon: 'Salon',
  sejour: 'Séjour',
  cuisine: 'Cuisine',
  chambre: 'Chambre',
  salle_de_bain: 'Salle de bain',
  wc: 'WC',
  entree: 'Entrée',
  couloir: 'Couloir',
  buanderie: 'Buanderie',
  cave: 'Cave',
  grenier: 'Grenier',
  garage: 'Garage',
  balcon: 'Balcon',
  terrasse: 'Terrasse',
  autre: 'Autre',
}

interface Room {
  id: string
  name: string
  room_type: string | null
  surface_m2: number | null
}

interface RoomsListProps {
  dossierId: string
  rooms: Room[]
}

export function RoomsList({ dossierId, rooms }: RoomsListProps) {
  const [showForm, setShowForm] = useState(rooms.length === 0)
  const [state, formAction, pending] = useActionState<RoomFormState, FormData>(
    addRoomAction,
    undefined,
  )
  const [, startTransition] = useTransition()

  // Hide form after success
  if (state === undefined && pending === false && showForm && rooms.length > 0) {
    // noop — state stays undefined unless error
  }

  function handleDelete(roomId: string) {
    if (!confirm('Supprimer cette pièce ? Les photos associées seront orphelines.')) return
    startTransition(async () => {
      await deleteRoomAction(dossierId, roomId)
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">Pièces ({rooms.length})</h2>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Sparkles className="size-4" /> Template
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Appartements</DropdownMenuLabel>
              {ROOM_TEMPLATES.filter((t) => t.id.startsWith('appt_')).map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => {
                    startTransition(async () => {
                      await applyRoomTemplateAction(dossierId, t.id)
                    })
                  }}
                >
                  <div className="flex flex-col items-start">
                    <span>{t.label}</span>
                    <span className="text-xs text-muted-foreground">{t.rooms.length} pièces · {t.description}</span>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Maisons</DropdownMenuLabel>
              {ROOM_TEMPLATES.filter((t) => t.id.startsWith('maison_')).map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => {
                    startTransition(async () => {
                      await applyRoomTemplateAction(dossierId, t.id)
                    })
                  }}
                >
                  <div className="flex flex-col items-start">
                    <span>{t.label}</span>
                    <span className="text-xs text-muted-foreground">{t.rooms.length} pièces · {t.description}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant={showForm ? 'ghost' : 'outline'}
            size="sm"
            onClick={() => setShowForm((s) => !s)}
          >
            {showForm ? 'Annuler' : <><Plus className="size-4" /> Ajouter</>}
          </Button>
        </div>
      </div>

      {showForm && (
        <form
          action={(fd) => {
            fd.append('dossierId', dossierId)
            formAction(fd)
            // Hide form after submit — useActionState will reset
            requestAnimationFrame(() => setShowForm(rooms.length === 0))
          }}
          className="rounded-xl border border-border p-4 space-y-3 bg-card/50"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Nom" htmlFor="name" required>
              <Input id="name" name="name" required placeholder="Salon, Chambre 1…" />
            </FormField>
            <FormField label="Type" htmlFor="roomType">
              <Select id="roomType" name="roomType" defaultValue="">
                <option value="">— Non précisé —</option>
                {Object.entries(ROOM_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField label="Surface (m²)" htmlFor="surfaceM2">
            <Input id="surfaceM2" name="surfaceM2" type="number" min={0} step="0.01" placeholder="35" />
          </FormField>
          {state?.error && <p className="text-sm text-accent-red">{state.error}</p>}
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Ajouter
          </Button>
        </form>
      )}

      {rooms.length > 0 ? (
        <ul className="space-y-1">
          {rooms.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <DoorOpen className="size-4 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{r.name}</span>
                {r.room_type && (
                  <span className="text-xs text-muted-foreground">
                    · {ROOM_TYPE_LABELS[r.room_type] ?? r.room_type}
                  </span>
                )}
                {r.surface_m2 && (
                  <span className="text-xs text-muted-foreground">
                    · {r.surface_m2} m²
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(r.id)}
                aria-label={`Supprimer ${r.name}`}
              >
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        !showForm && (
          <p className="text-sm text-muted-foreground">Aucune pièce — ajoutez-en pour organiser vos photos.</p>
        )
      )}
    </div>
  )
}
