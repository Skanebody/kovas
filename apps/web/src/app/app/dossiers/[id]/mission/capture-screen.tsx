'use client'

/**
 * KOVAS — Coquille principale du mode terrain Capture-First (V1.5 iteration 1).
 *
 * Architecture mobile/iPad portrait :
 *   - Toolbar fixe top (retour dossier + nom pièce courante + picker pièce)
 *   - Carrousel photos pièce courante (placeholder pour iteration 1)
 *   - PhotoButton géant centré
 *   - CTA « + Pièce suivante »
 *
 * Layout iPad paysage / desktop (xl+) :
 *   - 2 colonnes : capture (col-span-7) | cockpit progression (col-span-5)
 *   - Cockpit = placeholder « à venir itération 2 »
 *
 * Pas d'appel API à cette itération — juste le squelette UI + état local.
 * IndexedDB connexion + Vision IA + consolidation viendront aux itérations suivantes.
 */

import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ImageOff, Plus } from 'lucide-react'
import { useState } from 'react'
import { MissionToolbar } from './mission-toolbar'
import { PhotoButton } from './photo-button'
import { type RoomOption, RoomPicker } from './room-picker'

interface CaptureScreenProps {
  dossier: {
    id: string
    reference: string
  }
  rooms: RoomOption[]
}

interface LocalPhoto {
  localId: string
  blobUrl: string
  capturedAt: number
}

function genLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local-${crypto.randomUUID()}`
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function CaptureScreen({ dossier, rooms: initialRooms }: CaptureScreenProps) {
  const [rooms, setRooms] = useState<RoomOption[]>(initialRooms)
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(initialRooms[0]?.id ?? null)
  // Map<roomId, LocalPhoto[]> — état strictement local (pas d'IndexedDB encore).
  const [photosByRoom, setPhotosByRoom] = useState<Record<string, LocalPhoto[]>>({})

  const currentRoom = rooms.find((r) => r.id === currentRoomId) ?? null
  const currentPhotos = currentRoomId ? (photosByRoom[currentRoomId] ?? []) : []
  const photoButtonVariant: 'default' | 'empty' = currentPhotos.length === 0 ? 'empty' : 'default'

  function handleSelectRoom(room: RoomOption) {
    setCurrentRoomId(room.id)
  }

  function handleCreateRoom(input: { tempId: string; name: string }) {
    const newRoom: RoomOption = { id: input.tempId, name: input.name }
    setRooms((prev) => [...prev, newRoom])
    setCurrentRoomId(input.tempId)
  }

  function handlePhotoCaptured(file: File) {
    if (!currentRoomId) {
      // Garde-fou : le bouton est désactivé tant qu'aucune pièce n'est sélectionnée,
      // mais on protège quand même le state (iteration 2 = toast utilisateur explicite).
      return
    }
    const localId = genLocalId()
    const blobUrl = URL.createObjectURL(file)
    const photo: LocalPhoto = {
      localId,
      blobUrl,
      capturedAt: Date.now(),
    }
    setPhotosByRoom((prev) => ({
      ...prev,
      [currentRoomId]: [...(prev[currentRoomId] ?? []), photo],
    }))
    // TODO iteration 2 : enqueuePhoto({ dossierId: dossier.id, roomId: currentRoomId, blob: file, ... })
  }

  function handleNextRoom() {
    // Iteration 1 : ouvre simplement le picker en suggérant la création d'une nouvelle pièce.
    // Une vraie UX "next room" viendra avec la sync IndexedDB.
    setCurrentRoomId(null)
  }

  return (
    <AppShell background="light">
      <MissionToolbar
        dossierId={dossier.id}
        dossierReference={dossier.reference}
        currentRoomName={currentRoom?.name ?? null}
        roomPickerSlot={
          <RoomPicker
            rooms={rooms}
            currentRoomId={currentRoomId}
            onSelectRoom={handleSelectRoom}
            onCreateRoom={handleCreateRoom}
          />
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:gap-8">
          {/* Colonne capture */}
          <section className={cn('space-y-6', 'xl:col-span-7')} aria-label="Capture terrain">
            {/* Carrousel photos pièce courante */}
            <Card variant="opaque" padding="default" className="space-y-4">
              <header className="flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
                  Photos pièce courante
                </p>
                <span className="text-sm text-ink-soft">
                  {currentPhotos.length} photo{currentPhotos.length > 1 ? 's' : ''}
                </span>
              </header>

              {currentPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-ink-mute">
                  <ImageOff className="h-8 w-8" aria-hidden />
                  <p className="text-sm">Aucune photo pour cette pièce</p>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {currentPhotos.map((photo) => (
                    <div
                      key={photo.localId}
                      className={cn(
                        'shrink-0 overflow-hidden rounded-xl border border-rule',
                        'h-24 w-24 bg-cream-deep/40',
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.blobUrl}
                        alt="Capture terrain"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* PhotoButton géant */}
            <div className="flex flex-col items-center gap-6 py-6">
              <PhotoButton
                variant={photoButtonVariant}
                disabled={currentRoomId === null}
                onPhotoCaptured={handlePhotoCaptured}
              />

              {currentRoomId === null ? (
                <p className="max-w-xs text-center text-sm text-ink-mute">
                  Sélectionnez ou créez une pièce pour commencer à capturer.
                </p>
              ) : null}
            </div>

            {/* CTA pièce suivante */}
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleNextRoom}
                className="gap-2"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Pièce suivante
              </Button>
            </div>
          </section>

          {/* Colonne cockpit (xl+) */}
          <aside className="hidden xl:col-span-5 xl:block" aria-label="Cockpit progression">
            <Card variant="opaque" padding="lg" className="h-full">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
                Cockpit progression
              </p>
              <h2 className="mt-2 font-serif text-2xl italic text-ink">À venir — itération 2</h2>
              <p className="mt-4 text-sm text-ink-soft">
                Vue temps réel du remplissage des champs DPE / Amiante, propositions IA et conflits
                à valider apparaîtront ici une fois la consolidation Vision IA branchée.
              </p>
            </Card>
          </aside>
        </div>
      </main>
    </AppShell>
  )
}
