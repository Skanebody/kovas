'use client'

import { Mic, Sparkles, Trash2 } from 'lucide-react'
import { useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { VoiceParsedData } from '@/lib/voice-parser'
import { deleteVoiceNoteAction } from './actions'

interface VoiceNote {
  id: string
  storage_path: string
  duration_seconds: number | null
  transcript_raw: string | null
  transcript_structured: VoiceParsedData | null
  ai_confidence: number | null
  parser_used: string | null
  room_id: string | null
  created_at: string
}

interface VoiceNotesListProps {
  dossierId: string
  notes: VoiceNote[]
  rooms: { id: string; name: string }[]
}

const KIND_LABELS: Record<string, string> = {
  chaudiere: 'Chaudière',
  pac: 'PAC',
  chauffe_eau: 'Chauffe-eau',
  radiateur: 'Radiateurs',
  isolation: 'Isolation',
  ventilation: 'Ventilation',
  fenetre: 'Menuiseries',
  tableau_elec: 'Tableau élec.',
  climatisation: 'Climatisation',
  autre: 'Autre',
}

export function VoiceNotesList({ dossierId, notes, rooms }: VoiceNotesListProps) {
  const [, startTransition] = useTransition()

  if (notes.length === 0) {
    return (
      <p className="text-sm text-ink-mute">
        Aucune note vocale. Utilisez le bouton ci-dessus pour enregistrer.
      </p>
    )
  }

  const roomName = (id: string | null) => rooms.find((r) => r.id === id)?.name ?? 'Note libre'

  function handleDelete(noteId: string, storagePath: string) {
    if (!confirm('Supprimer cette note vocale ?')) return
    startTransition(async () => {
      await deleteVoiceNoteAction(dossierId, noteId, storagePath)
    })
  }

  const fmt = (s: number | null) => {
    if (s == null) return '—'
    return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, '0')}s`
  }

  return (
    <ul className="space-y-3">
      {notes.map((n) => {
        const parsed = n.transcript_structured
        const confidence = n.ai_confidence ?? 0
        const isHighConf = confidence >= 0.7

        return (
          <li
            key={n.id}
            className="rounded-xl border border-border bg-paper/50 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Mic className="size-4 text-ink-mute" />
                <span className="font-medium">{roomName(n.room_id)}</span>
                <Badge variant="muted">{fmt(n.duration_seconds)}</Badge>
                {confidence > 0 && (
                  <Badge variant={isHighConf ? 'green' : 'orange'}>
                    <Sparkles className="size-3 mr-1" />
                    {Math.round(confidence * 100)}% confiance
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(n.id, n.storage_path)}
                aria-label="Supprimer"
              >
                <Trash2 className="size-4 text-ink-mute" />
              </Button>
            </div>

            {n.transcript_raw && (
              <p className="text-sm whitespace-pre-wrap">{n.transcript_raw}</p>
            )}

            {parsed && (parsed.surface_m2 || parsed.year_built || parsed.equipment.length > 0) && (
              <div className="rounded-md bg-muted/40 p-3 space-y-2 text-xs">
                <div className="font-semibold text-foreground">Données extraites</div>
                <div className="flex flex-wrap gap-2">
                  {parsed.surface_m2 && (
                    <Badge variant="blue">Surface : {parsed.surface_m2} m²</Badge>
                  )}
                  {parsed.year_built && (
                    <Badge variant="blue">Année : {parsed.year_built}</Badge>
                  )}
                  {parsed.ceiling_height_m && (
                    <Badge variant="blue">H.s.p. : {parsed.ceiling_height_m} m</Badge>
                  )}
                  {parsed.equipment.map((eq, i) => (
                    <Badge key={i} variant="muted">
                      {KIND_LABELS[eq.kind] ?? eq.kind}
                      {eq.brand ? ` · ${eq.brand}` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
