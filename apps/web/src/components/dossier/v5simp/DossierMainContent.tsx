'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MISSION_STATUS_LABELS, MISSION_STATUS_VARIANT } from '@/lib/mission-helpers'
import { Camera, FileText, MapPin, Mic } from 'lucide-react'
import type { ReactNode } from 'react'
import { DossierAutoSave } from './DossierAutoSave'

export interface DossierMainContentMission {
  id: string
  type: string
  typeLabel: string
  reference: string
  status: string
  percentage: number
  checklistContent: ReactNode
  /** Actions (Resume / Status / Share / Remove) — rendu serveur côté page. */
  headerActions: ReactNode
}

export interface PreparationItem {
  id: string
  label: string
  done: boolean
}

interface DossierMainContentProps {
  activeSectionId: string
  /** Items pour la section "Préparation" (00). */
  preparationItems: PreparationItem[]
  /** Mission active si activeSectionId == "XX-{type}". null si autre section. */
  activeMission: DossierMainContentMission | null
  /** Slot section "Documents" (99). */
  documentsSection: ReactNode
  /** Slot section "Pièces" (toujours rendu en bas du diagnostic). */
  roomsSection: ReactNode
  /** Slot pour photos + voice (intégré dans section diagnostic active). */
  photosSection: ReactNode
  voiceSection: ReactNode
  /** Adresse compactée du bien (affichée dans l'entête de section). */
  propertyAddressLine: string | null
}

/**
 * Contenu principal plein largeur (max-w-3xl), centré.
 * Rend dynamiquement la section active depuis l'id ("00-preparation",
 * "01-<type>", …, "99-documents").
 *
 * Sections diagnostic embarquent : checklist + pièces + photos + vocal.
 */
export function DossierMainContent({
  activeSectionId,
  preparationItems,
  activeMission,
  documentsSection,
  roomsSection,
  photosSection,
  voiceSection,
  propertyAddressLine,
}: DossierMainContentProps) {
  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Auto-save sticky en haut à droite */}
        <div className="flex justify-end">
          <DossierAutoSave />
        </div>

        {activeSectionId === '00-preparation' ? (
          <PreparationSection items={preparationItems} addressLine={propertyAddressLine} />
        ) : activeSectionId === '99-documents' ? (
          <DocumentsSection>{documentsSection}</DocumentsSection>
        ) : activeMission ? (
          <DiagnosticSection
            mission={activeMission}
            addressLine={propertyAddressLine}
            roomsSection={roomsSection}
            photosSection={photosSection}
            voiceSection={voiceSection}
          />
        ) : (
          <EmptySection />
        )}
      </div>
    </div>
  )
}

function PreparationSection({
  items,
  addressLine,
}: {
  items: PreparationItem[]
  addressLine: string | null
}) {
  return (
    <section className="space-y-5">
      <header className="space-y-1.5">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          00 — Préparation
        </div>
        <h1 className="font-sans text-2xl font-bold text-ink leading-tight">
          Préparation du dossier
        </h1>
        {addressLine && (
          <p className="text-[13px] text-ink-mute flex items-center gap-1.5">
            <MapPin className="size-3.5" /> {addressLine}
          </p>
        )}
      </header>

      <Card variant="flat" padding="default">
        <CardHeader>
          <CardTitle className="text-base">Checklist préparation</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 pt-2">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-2.5 text-[13px]">
                <span
                  aria-hidden
                  className={
                    it.done
                      ? 'size-4 rounded-full bg-chartreuse'
                      : 'size-4 rounded-full border border-rule'
                  }
                />
                <span className={it.done ? 'text-ink' : 'text-ink-mute'}>{it.label}</span>
              </li>
            ))}
            {items.length === 0 && (
              <li className="text-[13px] text-ink-mute">Aucune préparation requise.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}

function DocumentsSection({ children }: { children: ReactNode }) {
  return (
    <section className="space-y-5">
      <header className="space-y-1.5">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          99 — Documents
        </div>
        <h1 className="font-sans text-2xl font-bold text-ink leading-tight flex items-center gap-2">
          <FileText className="size-6 text-ink-mute" /> Documents du dossier
        </h1>
      </header>
      <div>{children}</div>
    </section>
  )
}

function DiagnosticSection({
  mission,
  addressLine,
  roomsSection,
  photosSection,
  voiceSection,
}: {
  mission: DossierMainContentMission
  addressLine: string | null
  roomsSection: ReactNode
  photosSection: ReactNode
  voiceSection: ReactNode
}) {
  const statusVariant = MISSION_STATUS_VARIANT[mission.status] ?? 'muted'
  const statusLabel = MISSION_STATUS_LABELS[mission.status] ?? mission.status

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          {mission.reference}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-sans text-2xl font-bold text-ink leading-tight">
            {mission.typeLabel}
          </h1>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>
        {addressLine && (
          <p className="text-[13px] text-ink-mute flex items-center gap-1.5">
            <MapPin className="size-3.5" /> {addressLine}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">{mission.headerActions}</div>
      </header>

      {/* Checklist du diagnostic */}
      <div>{mission.checklistContent}</div>

      {/* Pièces */}
      <div className="space-y-3">
        <h2 className="font-sans text-[15px] font-semibold text-ink">Pièces du bien</h2>
        <div>{roomsSection}</div>
      </div>

      {/* Photos */}
      <div className="space-y-3">
        <h2 className="font-sans text-[15px] font-semibold text-ink flex items-center gap-2">
          <Camera className="size-4" /> Photos terrain
        </h2>
        <div>{photosSection}</div>
      </div>

      {/* Vocal */}
      <div className="space-y-3">
        <h2 className="font-sans text-[15px] font-semibold text-ink flex items-center gap-2">
          <Mic className="size-4" /> Notes vocales
        </h2>
        <div>{voiceSection}</div>
      </div>
    </section>
  )
}

function EmptySection() {
  return (
    <Card variant="flat" padding="default">
      <CardContent className="pt-6 text-center text-[13px] text-ink-mute">
        Sélectionnez une section dans le menu pour commencer.
      </CardContent>
    </Card>
  )
}
