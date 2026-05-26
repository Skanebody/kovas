'use client'

/**
 * KOVAS — GC2 Mission Flow Continu : sélecteur multi-mission (Lot B92 polish).
 *
 * Segmented control horizontal pour basculer entre les missions d'un même
 * dossier (DPE + amiante + plomb…). N'apparaît que si le dossier a > 1 mission.
 *
 * Pattern V5 sobre :
 *   - Container border 0.08 + bg-paper, rounded-pill
 *   - Bouton actif : bg-[#0F1419] (navy plein) + text-paper, ombre légère
 *   - Bouton inactif : transparent + text-[#0F1419]/65 + hover bg-[#0F1419]/[0.04]
 *   - Animation 200ms ease-out sur switch
 *
 * Authority : CLAUDE.md Design System v5 + REFONTE-ACQUI-TARGET-V2 §6.2 (GC2).
 */

import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

export interface MissionPickerEntry {
  id: string
  type: string
  label: string
}

interface MissionPickerProps {
  /** ID du dossier (pour construire les URLs) */
  dossierId: string
  /** Toutes les missions du dossier */
  missions: ReadonlyArray<MissionPickerEntry>
  /** ID de la mission actuellement sélectionnée */
  currentMissionId: string
}

export function MissionPicker({ dossierId, missions, currentMissionId }: MissionPickerProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  // Garde-fou : si 0 ou 1 mission, ne rien afficher (le caller filtre déjà
  // côté composer, mais sécurité défensive).
  if (missions.length <= 1) {
    return null
  }

  function handleSelect(missionId: string) {
    if (missionId === currentMissionId) return
    startTransition(() => {
      router.push(`/dashboard/dossiers/${dossierId}/mission/flow?missionId=${missionId}`, {
        scroll: false,
      })
    })
  }

  return (
    <div
      role="tablist"
      aria-label="Mission active"
      className={cn(
        'inline-flex max-w-full flex-wrap items-center gap-1 rounded-pill border border-[#0F1419]/[0.08] bg-paper p-1 shadow-glass-xs',
        pending && 'opacity-80',
      )}
    >
      {missions.map((mission) => {
        const isActive = mission.id === currentMissionId
        return (
          <button
            key={mission.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls="mission-flow-content"
            disabled={pending}
            onClick={() => handleSelect(mission.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-pill px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-all duration-200 ease-out motion-reduce:transition-none',
              isActive
                ? 'bg-[#0F1419] text-paper shadow-[0_1px_2px_rgba(15,20,25,0.18)]'
                : 'text-[#0F1419]/65 hover:bg-[#0F1419]/[0.04] hover:text-[#0F1419]',
              pending && 'cursor-wait',
            )}
          >
            {mission.label}
          </button>
        )
      })}
    </div>
  )
}
