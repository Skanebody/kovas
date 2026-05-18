'use client'

import { Button } from '@/components/ui/button'
import type { ChecklistRunItem } from '@/lib/checklists'
import { PlayCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { MissionCardCollapsible } from './mission-card-collapsible'
import { MissionFocusDrawer } from './mission-focus-drawer'

export interface MissionDrawerItem {
  id: string
  type: string
  typeLabel: string
  reference: string
  status: string
  percentage: number
  missingRequiredCount: number
  checklistItems: ChecklistRunItem[]
  checklistCompletion: number
  checklistRequiredOk: boolean
  /** Rendu serveur — actions header (Resume, Status, Share, Remove) */
  headerActions: ReactNode
  /** Rendu serveur — contenu de la card expanded (MissionChecklist) */
  checklistContent: ReactNode
  /** Rendu serveur — sections embarquées dans le drawer focus */
  roomsSection: ReactNode
  photoSection: ReactNode
  voiceSection: ReactNode
}

interface MissionsWithDrawerProps {
  missions: MissionDrawerItem[]
  propertyAddress: string
}

/**
 * Wrapper client autour de la liste de missions :
 *  - Rend les MissionCardCollapsible avec un bouton 'Mode mission' au header
 *  - Maintient l'état du drawer ouvert (une seule mission à la fois)
 *  - Le drawer réutilise les sections serveur (checklist, rooms, photos, voice)
 */
export function MissionsWithDrawer({ missions, propertyAddress }: MissionsWithDrawerProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const openMission = openId ? missions.find((m) => m.id === openId) : null

  return (
    <>
      <div className="space-y-3">
        {missions.map((m) => (
          <MissionCardCollapsible
            key={m.id}
            missionId={m.id}
            typeLabel={m.typeLabel}
            reference={m.reference}
            percentage={m.percentage}
            missingRequiredCount={m.missingRequiredCount}
            headerActions={
              <>
                <Button size="sm" onClick={() => setOpenId(m.id)}>
                  <PlayCircle className="size-4" /> Mode mission
                </Button>
                {m.headerActions}
              </>
            }
          >
            {m.checklistContent}
          </MissionCardCollapsible>
        ))}
      </div>
      {openMission && (
        <MissionFocusDrawer
          open
          onClose={() => setOpenId(null)}
          mission={{
            id: openMission.id,
            type: openMission.type,
            reference: openMission.reference,
            status: openMission.status,
          }}
          checklistItems={openMission.checklistItems}
          checklistCompletion={openMission.checklistCompletion}
          checklistRequiredOk={openMission.checklistRequiredOk}
          roomsSection={openMission.roomsSection}
          photoSection={openMission.photoSection}
          voiceSection={openMission.voiceSection}
          propertyAddress={propertyAddress}
        />
      )}
    </>
  )
}
