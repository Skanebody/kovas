'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import type { ChecklistRunItem } from '@/lib/checklists'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import { cn } from '@/lib/utils'
import { ArrowLeft, Camera, CheckCircle2, Mic, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { updateMissionStatusAction } from './actions'
import { MissionChecklist } from './mission-checklist'

interface MissionFocusDrawerProps {
  open: boolean
  onClose: () => void
  mission: {
    id: string
    type: string
    reference: string
    status: string
  }
  checklistItems: ChecklistRunItem[]
  checklistCompletion: number
  checklistRequiredOk: boolean
  /** Rendu serveur de la section pièces (RoomsList déjà filtré) */
  roomsSection: ReactNode
  /** Rendu serveur de la photo capture spécifique mission */
  photoSection: ReactNode
  /** Rendu serveur de la voice notes section spécifique mission */
  voiceSection: ReactNode
  propertyAddress: string
}

/**
 * Mode mission focus — overlay plein écran sur la page dossier.
 * Contexte : terrain, 1 seule mission à la fois, outils contextualisés.
 * Aucune nouvelle route, aucune migration DB : on présente une vue filtrée
 * des données du dossier autour de CETTE mission.
 */
export function MissionFocusDrawer({
  open,
  onClose,
  mission,
  checklistItems,
  checklistCompletion,
  checklistRequiredOk,
  roomsSection,
  photoSection,
  voiceSection,
  propertyAddress,
}: MissionFocusDrawerProps) {
  // ESC pour fermer
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // Bloque scroll body
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  const percentage = Math.round(checklistCompletion * 100)
  const label = MISSION_TYPE_LABELS[mission.type] ?? mission.type
  const canFinish = checklistRequiredOk
  const alreadyDone = mission.status === 'done' || mission.status === 'exported'

  async function handleFinish() {
    if (!canFinish) {
      toast.warning('Items obligatoires manquants — complétez la check-list')
      return
    }
    try {
      await updateMissionStatusAction(mission.id, 'done')
      toast.success(`${label} terminée`)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    }
  }

  function scrollToId(id: string) {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Mode mission ${label}`}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header sticky */}
      <header className="glass-header px-4 py-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="size-4" /> Dossier
        </Button>
        <div className="flex-1 min-w-0 text-center">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{label}</span>
            <Badge variant="muted" className="text-[10px] py-0">
              {percentage}%
            </Badge>
          </div>
          <p className="text-[10px] font-mono text-ink-mute truncate">
            {mission.reference}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
          <X className="size-4" />
        </Button>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-muted shrink-0">
        <div className="h-full bg-cta transition-all" style={{ width: `${percentage}%` }} />
      </div>

      {/* Body scrollable */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-5">
        {propertyAddress && (
          <p className="text-xs text-ink-mute text-center">{propertyAddress}</p>
        )}

        <section id="mission-focus-checklist">
          <MissionChecklist
            missionId={mission.id}
            items={checklistItems}
            completion={checklistCompletion}
            requiredOk={checklistRequiredOk}
          />
        </section>

        <section id="mission-focus-rooms" className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-wider font-semibold text-ink-mute">
            Pièces concernées par cette mission
          </h3>
          {roomsSection}
        </section>

        <section id="mission-focus-photos" className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-wider font-semibold text-ink-mute">
            Photos terrain
          </h3>
          {photoSection}
        </section>

        <section id="mission-focus-voice" className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-wider font-semibold text-ink-mute">
            Notes vocales
          </h3>
          {voiceSection}
        </section>
      </main>

      {/* Floating action bar */}
      <footer className="glass-header fixed bottom-0 inset-x-0 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => scrollToId('mission-focus-photos')}
            aria-label="Aller aux photos"
          >
            <Camera className="size-4" /> <span className="hidden sm:inline">Photo</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => scrollToId('mission-focus-voice')}
            aria-label="Aller aux notes vocales"
          >
            <Mic className="size-4" /> <span className="hidden sm:inline">Note</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => scrollToId('mission-focus-rooms')}
            aria-label="Aller aux pièces"
          >
            <span className="hidden sm:inline">Pièces</span>
          </Button>
        </div>
        <Button
          onClick={handleFinish}
          disabled={alreadyDone}
          className={cn(!canFinish && 'bg-muted text-ink-mute hover:bg-muted')}
        >
          <CheckCircle2 className="size-4" />
          {alreadyDone
            ? 'Déjà terminée'
            : canFinish
              ? 'Terminer la mission'
              : 'Compléter pour terminer'}
        </Button>
      </footer>
    </div>
  )
}
