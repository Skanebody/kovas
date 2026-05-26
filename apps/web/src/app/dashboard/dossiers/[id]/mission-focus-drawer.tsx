'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MissionTour } from '@/components/ui/mission-tour'
import { toast } from '@/components/ui/toaster'
import type { ChecklistRunItem } from '@/lib/checklists'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import { cn } from '@/lib/utils'
import { ArrowLeft, Camera, CheckCircle2, Mic, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useTransition } from 'react'
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
  roomsSection: ReactNode
  photoSection: ReactNode
  voiceSection: ReactNode
  propertyAddress: string
}

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
  const [isPending, startTransition] = useTransition()
  const label = MISSION_TYPE_LABELS[mission.type] ?? mission.type
  const percentage = Math.round(checklistCompletion * 100)
  const canFinish = checklistRequiredOk
  const alreadyDone = mission.status === 'done' || mission.status === 'exported'

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  function handleFinish() {
    if (!canFinish || alreadyDone || isPending) return
    startTransition(async () => {
      try {
        await updateMissionStatusAction(mission.id, 'done')
        toast.success('Mission terminée')
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur')
      }
    })
  }

  function scrollToId(id: string) {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: drawer mission plein écran non-modal HTML natif (z-index custom + animation)
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Mode mission ${label}`}
      className="fixed inset-0 z-50 flex flex-col bg-fluid-navy text-paper"
    >
      {/* Tour guidé 1ère visite — Sprint 3 */}
      <MissionTour />
      <header className="glass-dark px-4 py-3 flex items-center gap-3 shrink-0 border-b border-paper/10">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="border-paper/20 bg-paper/10 text-paper hover:bg-paper/15"
        >
          <ArrowLeft className="size-4" /> Dossier
        </Button>
        <div className="flex-1 min-w-0 text-center">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate text-paper">{label}</span>
            <Badge
              variant="muted"
              className="text-[10px] py-0 bg-paper/15 text-paper border-paper/20"
            >
              {percentage}%
            </Badge>
          </div>
          <p className="text-[10px] font-mono text-paper/60 truncate">{mission.reference}</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={onClose}
          aria-label="Fermer"
          className="border-paper/20 bg-paper/10 text-paper hover:bg-paper/15"
        >
          <X className="size-4" />
        </Button>
      </header>

      <div className="h-1 bg-paper/10 shrink-0" aria-hidden>
        <div
          className="h-full bg-chartreuse transition-all duration-base ease-spring"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-5">
        {propertyAddress ? (
          <p className="text-xs text-paper/70 text-center font-mono uppercase tracking-wider">
            {propertyAddress}
          </p>
        ) : null}

        <section id="mission-focus-checklist">
          <MissionChecklist
            missionId={mission.id}
            items={checklistItems}
            completion={checklistCompletion}
            requiredOk={checklistRequiredOk}
          />
        </section>

        <section id="mission-focus-rooms" className="space-y-2">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.08em] text-paper/60">
            Pièces concernées
          </h3>
          {roomsSection}
        </section>

        <section id="mission-focus-photos" className="space-y-2">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.08em] text-paper/60">
            Photos terrain
          </h3>
          {photoSection}
        </section>

        <section id="mission-focus-voice" className="space-y-2">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.08em] text-paper/60">
            Notes vocales
          </h3>
          {voiceSection}
        </section>
      </main>

      <footer className="glass-dark fixed bottom-[max(env(safe-area-inset-bottom),16px)] inset-x-4 mx-auto max-w-lg rounded-pill px-3 py-2 flex items-center justify-between gap-2 border border-paper/15 shadow-lg">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrollToId('mission-focus-photos')}
            className="border-paper/20 bg-paper/10 text-paper hover:bg-paper/15 min-h-[44px]"
            aria-label="Aller aux photos"
          >
            <Camera className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrollToId('mission-focus-voice')}
            className="border-paper/20 bg-paper/10 text-paper hover:bg-paper/15 min-h-[44px]"
            aria-label="Notes vocales"
          >
            <Mic className="size-4" />
          </Button>
        </div>
        <Button
          onClick={handleFinish}
          disabled={alreadyDone || !canFinish || isPending}
          variant={canFinish && !alreadyDone ? 'default' : 'glass'}
          className={cn('min-h-[44px]', !canFinish && !alreadyDone && 'opacity-60')}
        >
          <CheckCircle2 className="size-4" />
          {alreadyDone ? 'Terminée' : canFinish ? 'Terminer la mission' : 'Checklist incomplète'}
        </Button>
      </footer>
    </div>
  )
}
