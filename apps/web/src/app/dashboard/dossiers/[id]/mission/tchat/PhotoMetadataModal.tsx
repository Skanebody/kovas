'use client'

/**
 * KOVAS — PhotoMetadataModal : classification rapide d'une photo (MISSION-H).
 *
 * Affichée APRÈS upload d'une photo, dans 2 cas :
 *   - Online + Vision IA confidence < 0.85 → modale pré-remplie avec suggestions
 *   - Offline → modale vide pour saisie manuelle
 *
 * Mobile-first : bottom sheet sur mobile, dialog centré sur desktop.
 * Maximum 200 lignes, sobre, vouvoiement, pas d'emoji.
 *
 * Authority : CLAUDE.md §3 feature 2 + brief MISSION-H lot 3.
 */

import { BottomSheet, BottomSheetBody, BottomSheetTitle } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

/** Suggestion Vision IA (online + confidence faible). */
export interface PhotoVisionSuggestion {
  room: string | null
  equipment: string | null
  /** Question simple à poser au diagnostiqueur ("c'est dans la chaufferie ?"). */
  question: string | null
  confidence: number
}

export interface PhotoMetadata {
  room: string
  equipment: string | null
  note: string | null
}

interface PhotoMetadataModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Suggestion Vision IA si dispo (online). Null en offline. */
  suggestion: PhotoVisionSuggestion | null
  /** Liste rapide des pièces déjà présentes (pour priorité). */
  knownRooms: string[]
  /** Validation : range la photo avec ces métadonnées. */
  onConfirm: (metadata: PhotoMetadata) => void
  /** Skip → la photo va dans "À classer" (badge visible). */
  onSkip: () => void
}

const EQUIPMENT_OPTIONS = [
  'Chaudière',
  'Radiateur',
  'VMC',
  'Cheminée',
  'Plaque cuisson',
  'Compteur électrique',
  'Tableau électrique',
  'Fenêtre',
  'Pièce active',
  'Autre',
] as const

export function PhotoMetadataModal({
  open,
  onOpenChange,
  suggestion,
  knownRooms,
  onConfirm,
  onSkip,
}: PhotoMetadataModalProps): React.ReactElement {
  const [room, setRoom] = useState<string>('')
  const [equipment, setEquipment] = useState<string>('')
  const [note, setNote] = useState<string>('')

  // Bootstrap depuis suggestion Vision IA dès qu'elle arrive
  useEffect(() => {
    if (!open) return
    setRoom(suggestion?.room ?? '')
    setEquipment(suggestion?.equipment ?? '')
    setNote('')
  }, [open, suggestion])

  const handleConfirm = (): void => {
    onConfirm({
      room: room.trim() || 'Non classée',
      equipment: equipment.trim() || null,
      note: note.trim() || null,
    })
    onOpenChange(false)
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} maxHeight="80vh">
      <BottomSheetTitle>Classer cette photo</BottomSheetTitle>

      <BottomSheetBody>
        {suggestion ? (
          <div className="mb-4 rounded-lg border border-[#0F1419]/[0.08] bg-sage-alt/40 px-3 py-2 flex items-start gap-2">
            <Sparkles className="size-4 shrink-0 mt-0.5 text-chartreuse-deep" aria-hidden />
            <div className="text-[13px] text-[#0F1419]/82 leading-relaxed">
              {suggestion.question ?? 'Vérification rapide — confirmez ou corrigez.'}
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          {/* Pièce */}
          <div>
            <label
              htmlFor="photo-meta-room"
              className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[#0F1419]/72 mb-1.5"
            >
              Pièce
            </label>
            <Input
              id="photo-meta-room"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Salon, cuisine, chaufferie…"
              autoComplete="off"
              className="text-[14px]"
            />
            {knownRooms.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {knownRooms.slice(0, 6).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoom(r)}
                    className={cn(
                      'rounded-pill border border-[#0F1419]/[0.08] bg-paper px-2.5 py-1',
                      'text-[11px] font-medium text-[#0F1419]/82',
                      'hover:bg-sage-alt hover:border-[#0F1419]/30 transition-colors',
                      room === r && 'bg-chartreuse/20 border-chartreuse-deep text-[#0F1419]',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Équipement */}
          <div>
            <label
              htmlFor="photo-meta-equipment"
              className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[#0F1419]/72 mb-1.5"
            >
              Équipement (optionnel)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setEquipment(equipment === opt ? '' : opt)}
                  className={cn(
                    'rounded-pill border border-[#0F1419]/[0.08] bg-paper px-2.5 py-1',
                    'text-[11px] font-medium text-[#0F1419]/82',
                    'hover:bg-sage-alt hover:border-[#0F1419]/30 transition-colors',
                    equipment === opt && 'bg-chartreuse/20 border-chartreuse-deep text-[#0F1419]',
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Note libre */}
          <div>
            <label
              htmlFor="photo-meta-note"
              className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[#0F1419]/72 mb-1.5"
            >
              Note (optionnel)
            </label>
            <textarea
              id="photo-meta-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Détail à retenir sur cette photo…"
              rows={2}
              className={cn(
                'w-full resize-none rounded-md border border-[#0F1419]/[0.08] bg-paper px-3 py-2',
                'text-[14px] text-[#0F1419] placeholder:text-[#0F1419]/72',
                'focus:outline-none focus:ring-2 focus:ring-chartreuse/40 focus:border-chartreuse/50',
              )}
            />
          </div>
        </div>
      </BottomSheetBody>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-4 pt-4 pb-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            onSkip()
            onOpenChange(false)
          }}
          className="sm:w-auto w-full"
        >
          Plus tard
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={handleConfirm}
          className="sm:w-auto w-full"
        >
          Ranger la photo
        </Button>
      </div>
    </BottomSheet>
  )
}
