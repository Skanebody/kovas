'use client'

import { DossierAIAssistantSheet } from '@/components/dossier/v5simp/DossierAIAssistantSheet'
import { DossierAriane } from '@/components/dossier/v5simp/DossierAriane'
import { DossierContextBar } from '@/components/dossier/v5simp/DossierContextBar'
import { DossierFABRadial } from '@/components/dossier/v5simp/DossierFABRadial'
import {
  DossierMainContent,
  type DossierMainContentMission,
  type PreparationItem,
} from '@/components/dossier/v5simp/DossierMainContent'
import {
  type DossierSectionItem,
  DossierSectionsDrawer,
} from '@/components/dossier/v5simp/DossierSectionsDrawer'
import {
  DossierVerificationSheet,
  type VerificationChecklistItem,
} from '@/components/dossier/v5simp/DossierVerificationSheet'
import { toast } from '@/components/ui/toaster'
import type { CoherenceWarning } from '@/lib/coherence-validation'
import { useDossierSimpShortcuts } from '@/lib/hooks/use-dossier-simp-shortcuts'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

interface DossierSimpLayoutClientProps {
  /** Identifiants pour ariane / titre. */
  dossierId: string
  dossierTitle: string
  dossierSubtitle: string
  arianeItems: { label: string; href?: string }[]
  propertyAddressLine: string | null

  /** Sections nav (00 préparation, 01..N diagnostics, 99 documents). */
  sections: DossierSectionItem[]

  /** Missions indexées par section.id pour rendre le contenu du diagnostic. */
  missionsBySectionId: Record<string, DossierMainContentMission>

  /** Items pour Préparation (00). */
  preparationItems: PreparationItem[]

  /** Slot pour section 99 — Documents. */
  documentsSection: ReactNode

  /** Slots partagés pour toutes les sections diagnostic. */
  roomsSection: ReactNode
  photosSection: ReactNode
  voiceSection: ReactNode

  /** Bilan agrégé pour Vérifier. */
  verificationChecklist: VerificationChecklistItem[]
  coherenceWarnings: CoherenceWarning[]
  eeatScore: number
}

/**
 * Layout client de la page Dossier V5 simplifiée.
 *
 * Orchestrateur unique : maintient `activeSectionId` (synchronisé avec URL hash
 * `#section=01-dpe`), gère les ouvertures drawer/sheets, câble les raccourcis
 * clavier, et fournit les actions FAB.
 *
 * Toute la logique data (queries Supabase) reste dans le server component
 * parent (`page.tsx`) — ce client ne fait que du rendu et de l'état UI.
 */
export function DossierSimpLayoutClient(props: DossierSimpLayoutClientProps) {
  const {
    dossierId,
    dossierTitle,
    dossierSubtitle,
    arianeItems,
    propertyAddressLine,
    sections,
    missionsBySectionId,
    preparationItems,
    documentsSection,
    roomsSection,
    photosSection,
    voiceSection,
    verificationChecklist,
    coherenceWarnings,
    eeatScore,
  } = props

  const defaultSectionId = sections[0]?.id ?? '00-preparation'

  const [activeSectionId, setActiveSectionId] = useState<string>(defaultSectionId)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [verifySheetOpen, setVerifySheetOpen] = useState(false)
  const [aiSheetOpen, setAiSheetOpen] = useState(false)

  // Sync URL hash <-> activeSectionId (chargement initial + back/forward).
  useEffect(() => {
    function parseHashSection(): string | null {
      if (typeof window === 'undefined') return null
      const hash = window.location.hash.replace(/^#/, '')
      if (!hash) return null
      const params = new URLSearchParams(hash)
      return params.get('section')
    }

    const hashSection = parseHashSection()
    if (hashSection && sections.some((s) => s.id === hashSection)) {
      setActiveSectionId(hashSection)
    }

    function onHashChange() {
      const next = parseHashSection()
      if (next && sections.some((s) => s.id === next)) {
        setActiveSectionId(next)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [sections])

  const handleSelectSection = useCallback((sectionId: string) => {
    setActiveSectionId(sectionId)
    setDrawerOpen(false)
    // Met à jour hash sans scroll
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#section=${sectionId}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  // FAB actions (V1 stubs — branchage réel ultérieurement)
  const handlePhoto = useCallback(() => {
    toast.info('Photo : utilisez la galerie dans la section diagnostic.')
  }, [])
  const handleVoice = useCallback(() => {
    toast.info('Vocal : utilisez le recorder dans la section diagnostic.')
  }, [])
  const handleMeasure = useCallback(() => {
    toast.info('Mesure : module disponible en V1.5.')
  }, [])
  const handleOpenAI = useCallback(() => {
    setAiSheetOpen(true)
  }, [])

  // Raccourcis clavier
  useDossierSimpShortcuts({
    onSave: () => toast.success('Sauvegarde automatique active.'),
    onPhoto: handlePhoto,
    onVoice: handleVoice,
    onAI: handleOpenAI,
    onSubmit: () => setVerifySheetOpen(true),
    onHelp: () =>
      toast.info(
        'Raccourcis : Cmd+S (sauver), Cmd+P (photo), Cmd+M (vocal), Cmd+I (IA), Cmd+Entrée (envoyer).',
      ),
  })

  const activeMission = missionsBySectionId[activeSectionId] ?? null

  // Ariane finale = ariane parent + label section active
  const activeSectionLabel = sections.find((s) => s.id === activeSectionId)?.label
  const arianeFull = activeSectionLabel
    ? [...arianeItems, { label: activeSectionLabel }]
    : arianeItems

  return (
    <div className="-m-4 md:-mx-6 md:-my-4 min-h-[calc(100dvh-7rem)] bg-paper flex flex-col">
      <DossierContextBar
        title={dossierTitle}
        subtitle={dossierSubtitle}
        onOpenSectionsDrawer={() => setDrawerOpen(true)}
        onVerify={() => setVerifySheetOpen(true)}
      />

      <DossierAriane items={arianeFull} />

      <DossierMainContent
        activeSectionId={activeSectionId}
        preparationItems={preparationItems}
        activeMission={activeMission}
        documentsSection={documentsSection}
        roomsSection={roomsSection}
        photosSection={photosSection}
        voiceSection={voiceSection}
        propertyAddressLine={propertyAddressLine}
      />

      <DossierSectionsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        sections={sections}
        activeSectionId={activeSectionId}
        onSelect={handleSelectSection}
      />

      <DossierVerificationSheet
        open={verifySheetOpen}
        onOpenChange={setVerifySheetOpen}
        checklistItems={verificationChecklist}
        warnings={coherenceWarnings}
        eeatScore={eeatScore}
        onSendReport={() => {
          toast.info('Envoi du rapport : action disponible dès la section diagnostic prête.')
          setVerifySheetOpen(false)
        }}
        onContinueWriting={() => setVerifySheetOpen(false)}
      />

      <DossierAIAssistantSheet
        open={aiSheetOpen}
        onOpenChange={setAiSheetOpen}
        dossierId={dossierId}
      />

      <DossierFABRadial
        onPhoto={handlePhoto}
        onVoice={handleVoice}
        onMeasure={handleMeasure}
        onAI={handleOpenAI}
      />

      {/* dossierId réservé pour intégrations futures (auto-save, realtime, etc.) */}
      <span data-dossier-id={dossierId} className="sr-only" />
    </div>
  )
}
