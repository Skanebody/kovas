'use client'

import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  DoorOpen,
  Mic,
} from 'lucide-react'
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  type DiagType,
  type RoomMatrixContext,
  applicableDiagsForRoom,
  evaluateRoomTasks,
} from '@/lib/diag-room-matrix'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import { toggleRoomTaskAction } from './actions'

interface RoomRow {
  id: string
  name: string
  room_type: string | null
}

interface RoomsMatrixViewProps {
  dossierId: string
  rooms: RoomRow[]
  missionTypes: DiagType[]
  photos: { id: string; room_id: string | null }[]
  voiceNotes: { id: string; room_id: string | null; transcript_structured: unknown }[]
  manualState: Record<string, boolean>
}

export function RoomsMatrixView({
  dossierId,
  rooms,
  missionTypes,
  photos,
  voiceNotes,
  manualState,
}: RoomsMatrixViewProps) {
  const [openRoom, setOpenRoom] = useState<string | null>(rooms[0]?.id ?? null)
  const [, startTransition] = useTransition()

  function handleToggle(itemId: string, checked: boolean) {
    startTransition(async () => {
      await toggleRoomTaskAction(dossierId, itemId, !checked)
    })
  }

  if (rooms.length === 0) {
    return (
      <p className="text-sm text-ink-mute italic">
        Ajoutez d'abord des pièces (section dédiée plus bas) pour voir la matrice par pièce.
      </p>
    )
  }

  const ctx: RoomMatrixContext = { photos, voiceNotes, manualState }

  return (
    <div className="space-y-3">
      {rooms.map((room) => {
        const isOpen = openRoom === room.id
        const applicableDiags = applicableDiagsForRoom(room.room_type, missionTypes)
        const photosInRoom = photos.filter((p) => p.room_id === room.id).length
        const voicesInRoom = voiceNotes.filter((v) => v.room_id === room.id).length

        // Compute completion per diag
        const diagStats = applicableDiags.map((diag) => {
          const tasks = evaluateRoomTasks(room.id, room.room_type, diag, ctx)
          const required = tasks.filter((t) => t.required)
          const requiredDone = required.filter(
            (t) => t.status === 'auto_ok' || (t.status === 'manual' && t.checked),
          )
          const total = tasks.length
          const done = tasks.filter(
            (t) => t.status === 'auto_ok' || (t.status === 'manual' && t.checked),
          ).length
          return {
            diag,
            tasks,
            requiredOk: required.length === 0 || requiredDone.length === required.length,
            progress: total === 0 ? 1 : done / total,
            done,
            total,
          }
        })

        const allReqOk = diagStats.every((s) => s.requiredOk)
        const totalDone = diagStats.reduce((acc, s) => acc + s.done, 0)
        const totalTasks = diagStats.reduce((acc, s) => acc + s.total, 0)
        const roomProgress = totalTasks === 0 ? 0 : Math.round((totalDone / totalTasks) * 100)

        return (
          <Card
            key={room.id}
            id={`room-${room.id}`}
            variant="opaque"
            padding="none"
            className={cn('scroll-mt-20', isOpen ? 'border-[#0F1419]/25' : '')}
          >
            <button
              type="button"
              onClick={() => setOpenRoom(isOpen ? null : room.id)}
              className="w-full"
            >
              <CardHeader className="cursor-pointer p-5 pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <DoorOpen className="size-4 mt-1 text-ink-mute shrink-0" />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base text-left">{room.name}</CardTitle>
                      <div className="flex items-center gap-3 flex-wrap mt-1 text-xs text-ink-mute">
                        <span className="flex items-center gap-1">
                          <Camera className="size-3" /> {photosInRoom} photo{photosInRoom > 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mic className="size-3" /> {voicesInRoom} note{voicesInRoom > 1 ? 's' : ''}
                        </span>
                        <span>{applicableDiags.length} diagnostic{applicableDiags.length > 1 ? 's' : ''} applicable{applicableDiags.length > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {allReqOk ? (
                      <Badge variant="green">
                        <CheckCircle2 className="size-3 mr-1" />
                        Pièce OK
                      </Badge>
                    ) : (
                      <Badge variant="muted">{roomProgress}%</Badge>
                    )}
                    {isOpen ? (
                      <ChevronDown className="size-4 text-ink-mute" />
                    ) : (
                      <ChevronRight className="size-4 text-ink-mute" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </button>

            {isOpen && (
              <CardContent className="p-5 pt-0 space-y-4">
                {diagStats.length === 0 ? (
                  <p className="text-sm text-ink-mute italic">
                    Aucun diagnostic du dossier ne concerne ce type de pièce.
                  </p>
                ) : (
                  diagStats.map((s) => (
                    <div key={s.diag} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">
                          {MISSION_TYPE_LABELS[s.diag] ?? s.diag}
                        </h3>
                        <Badge variant={s.requiredOk ? 'green' : 'orange'} className="text-[10px]">
                          {s.done}/{s.total}
                        </Badge>
                      </div>
                      <ul className="space-y-1">
                        {s.tasks.map((t) => {
                          const isDone =
                            t.status === 'auto_ok' || (t.status === 'manual' && t.checked === true)
                          const isManual = t.status === 'manual'
                          return (
                            <li key={t.id}>
                              <button
                                type="button"
                                onClick={() => isManual && handleToggle(t.id, t.checked ?? false)}
                                disabled={!isManual}
                                className={cn(
                                  'w-full flex items-start gap-2 text-left rounded-md px-2 py-1.5 text-sm transition-colors',
                                  isManual ? 'hover:bg-ink/5 cursor-pointer' : 'cursor-default',
                                )}
                              >
                                {isDone ? (
                                  <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-accent-green" />
                                ) : (
                                  <Circle className="size-4 mt-0.5 shrink-0 text-ink-mute" />
                                )}
                                <span
                                  className={cn(
                                    'flex-1',
                                    isDone ? 'text-ink-mute line-through' : '',
                                    t.required && !isDone ? 'font-medium' : '',
                                  )}
                                >
                                  {t.label}
                                  {t.required && !isDone && (
                                    <span className="text-accent-red ml-1">*</span>
                                  )}
                                </span>
                                {t.status === 'auto_ok' && (
                                  <Badge variant="muted" className="text-[10px] shrink-0">
                                    auto
                                  </Badge>
                                )}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))
                )}
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
