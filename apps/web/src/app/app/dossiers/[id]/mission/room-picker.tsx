'use client'

/**
 * KOVAS — Sélecteur de pièce du mode terrain Capture-First (V1.5 iteration 1).
 *
 * Dropdown des pièces existantes du dossier + option "+ Nouvelle pièce" qui
 * affiche un input inline. Etat purement local (parent gère la sélection).
 *
 * Cette itération ne crée PAS encore la pièce côté serveur — elle remonte juste
 * le nom au parent qui décidera (next iteration : insert dossier_rooms + sync queue).
 */

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export interface RoomOption {
  id: string
  name: string
}

interface RoomPickerProps {
  rooms: RoomOption[]
  currentRoomId: string | null
  /** Sélection d'une pièce existante. */
  onSelectRoom: (room: RoomOption) => void
  /**
   * Création d'une nouvelle pièce — `tempId` est un UUID local généré côté composant
   * pour permettre au parent de l'utiliser tout de suite (sync ultérieure).
   */
  onCreateRoom: (input: { tempId: string; name: string }) => void
}

function genTempId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local-${crypto.randomUUID()}`
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function RoomPicker({ rooms, currentRoomId, onSelectRoom, onCreateRoom }: RoomPickerProps) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Ferme le dropdown au clic externe
  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setNewName('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  // Focus input quand on bascule en mode "création"
  useEffect(() => {
    if (creating && inputRef.current) {
      inputRef.current.focus()
    }
  }, [creating])

  const currentRoom = rooms.find((r) => r.id === currentRoomId) ?? null

  function handleCreateSubmit() {
    const trimmed = newName.trim()
    if (trimmed.length === 0) {
      return
    }
    onCreateRoom({ tempId: genTempId(), name: trimmed })
    setCreating(false)
    setNewName('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="gap-2"
      >
        <span className="text-xs font-mono uppercase tracking-wider text-ink-mute">Pièce</span>
        <span className="font-medium text-ink">{currentRoom ? currentRoom.name : 'Choisir'}</span>
        <ChevronDown
          className={cn('h-4 w-4 text-ink-mute transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </Button>

      {open ? (
        <div
          className={cn(
            'absolute right-0 top-full z-30 mt-2 w-64',
            'rounded-xl border border-rule bg-paper shadow-lg',
            'p-1',
          )}
          role="menu"
        >
          {rooms.length === 0 && !creating ? (
            <p className="px-3 py-3 text-sm text-ink-mute">Aucune pièce pour ce dossier.</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {rooms.map((room) => {
                const selected = room.id === currentRoomId
                return (
                  <li key={room.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectRoom(room)
                        setOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2',
                        'text-left text-sm text-ink',
                        'transition-colors hover:bg-cream-deep/40',
                      )}
                      role="menuitemradio"
                      aria-checked={selected}
                    >
                      <span>{room.name}</span>
                      {selected ? <Check className="h-4 w-4 text-ink-soft" aria-hidden /> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="border-t border-rule/60 pt-1">
            {creating ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleCreateSubmit()
                }}
                className="flex items-center gap-2 px-2 py-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Salon, Chambre 1, Cuisine…"
                  className={cn(
                    'flex-1 rounded-md border border-rule bg-paper px-3 py-1.5',
                    'text-sm text-ink placeholder:text-ink-ghost',
                    'focus:outline-none focus:ring-2 focus:ring-navy/20',
                  )}
                  maxLength={60}
                />
                <Button type="submit" size="sm" disabled={newName.trim().length === 0}>
                  Créer
                </Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2',
                  'text-sm font-medium text-ink',
                  'transition-colors hover:bg-cream-deep/40',
                )}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Nouvelle pièce
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
