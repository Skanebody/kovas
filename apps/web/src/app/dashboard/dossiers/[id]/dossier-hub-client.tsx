'use client'

import { Button } from '@/components/ui/button'
import { useDossierRealtime } from '@/lib/dossier/realtime'
import type { DossierState, VisibleSections } from '@/lib/dossier/states'
import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'

interface DossierHubClientProps {
  dossierId: string
  state: DossierState
  visibleSections: VisibleSections
  header: ReactNode
  identity: ReactNode
  capture: ReactNode | null
  dataQuality: ReactNode | null
  preExport: ReactNode | null
  exports: ReactNode | null
  communication: ReactNode | null
  billing: ReactNode | null
  followup: ReactNode | null
  notes: ReactNode
  /** Chantier B (FIX-KK §B) — scans documents anciens du bien. */
  historicalDocs: ReactNode | null
  /** Chantier E (FIX-KK §E) — timeline activité dossier. */
  activityLog: ReactNode | null
  sidebar: ReactNode
}

type MobileTab = 'overview' | 'details' | 'actions' | 'followup'

/**
 * Orchestrateur client du Hub Dossier.
 * - Branche le hook Realtime (router.refresh débouncé)
 * - Layout responsive 12-cols (desktop) / tabs bottom (mobile)
 * - Keyboard shortcuts (J/K nav, O ouvrir, E édit note, Esc back)
 */
export function DossierHubClient({
  dossierId,
  state: _state,
  visibleSections,
  header,
  identity,
  capture,
  dataQuality,
  preExport,
  exports,
  communication,
  billing,
  followup,
  notes,
  historicalDocs,
  activityLog,
  sidebar,
}: DossierHubClientProps) {
  const router = useRouter()
  const { pulse } = useDossierRealtime(dossierId)
  const [mobileTab, setMobileTab] = useState<MobileTab>('overview')
  const [recentPulse, setRecentPulse] = useState(false)

  // Petit feedback visuel sur changement Realtime
  useEffect(() => {
    if (pulse === 0) return
    setRecentPulse(true)
    const id = setTimeout(() => setRecentPulse(false), 250)
    return () => clearTimeout(id)
  }, [pulse])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignorer si on tape dans un input/textarea
      const target = e.target as HTMLElement
      const tag = target.tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key.toLowerCase()) {
        case 'escape':
          router.push('/dashboard/dossiers')
          break
        case 'e': {
          e.preventDefault()
          const el = document.querySelector('#notes textarea') as HTMLTextAreaElement | null
          el?.focus()
          break
        }
        case 'o': {
          e.preventDefault()
          const el = document.getElementById('identity')
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          break
        }
        case 'v': {
          e.preventDefault()
          const el = document.getElementById('data-quality')
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          break
        }
        case 'm': {
          // Raccourci Cmd+M = démarre/reprend la mission via tchat IA (FIX-JJ)
          e.preventDefault()
          router.push(`/dashboard/dossiers/${dossierId}/mission/tchat`)
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dossierId, router])

  // FIX-LL (2026-05-23) — Hash anchor smart fallback :
  // si l'URL contient `#capture` ou `#exports` mais que la section correspondante
  // n'est pas rendue (état dossier brouillon/confirme/archive...), on bascule
  // automatiquement vers la sous-page dédiée qui existe toujours.
  // Évite les liens "morts" qui ont historiquement frustré Benjamin (3 tentatives).
  useEffect(() => {
    if (typeof window === 'undefined') return
    function onHashChangeFallback() {
      const hash = window.location.hash.replace(/^#/, '').toLowerCase()
      if (!hash) return
      // Petit délai pour laisser la page rendre, puis tester si l'ancre existe
      setTimeout(() => {
        if (document.getElementById(hash)) return // OK, l'ancre est dans le DOM
        if (hash === 'capture') {
          router.push(`/dashboard/dossiers/${dossierId}/mission`)
        } else if (hash === 'exports') {
          router.push(`/dashboard/dossiers/${dossierId}/prevalidation`)
        }
      }, 50)
    }
    onHashChangeFallback()
    window.addEventListener('hashchange', onHashChangeFallback)
    return () => window.removeEventListener('hashchange', onHashChangeFallback)
  }, [dossierId, router])

  // ============================================================
  // Mobile tabs : Aperçu / Détails / Actions / Suivi
  // ============================================================
  const overviewBlock = (
    <div className="space-y-3">
      {visibleSections.identity ? identity : null}
      {notes}
    </div>
  )
  const detailsBlock = (
    <div className="space-y-3">
      {visibleSections.capture ? capture : null}
      {visibleSections.dataQuality ? dataQuality : null}
      {visibleSections.preExport ? preExport : null}
      {visibleSections.exports ? exports : null}
      {visibleSections.historicalDocs ? historicalDocs : null}
    </div>
  )
  const actionsBlock = (
    <div className="space-y-3">
      {visibleSections.communication ? communication : null}
      {visibleSections.billing ? billing : null}
    </div>
  )
  const followupBlock = (
    <div className="space-y-3">
      {visibleSections.followup ? followup : null}
      {visibleSections.activityLog ? activityLog : null}
      {sidebar}
    </div>
  )

  return (
    <div
      className={`mx-auto w-full max-w-7xl px-4 py-2 md:px-6 transition-opacity duration-base ${
        recentPulse ? 'opacity-95' : 'opacity-100'
      }`}
    >
      {header}

      {/* Desktop / tablette : grid 12 cols (8+4) */}
      <div className="hidden lg:grid gap-6 lg:grid-cols-12 pb-12">
        <div className="lg:col-span-8 space-y-4">
          {visibleSections.identity ? identity : null}
          {visibleSections.capture ? capture : null}
          {visibleSections.dataQuality ? dataQuality : null}
          {visibleSections.preExport ? preExport : null}
          {visibleSections.exports ? exports : null}
          {visibleSections.historicalDocs ? historicalDocs : null}
          {visibleSections.communication ? communication : null}
          {visibleSections.billing ? billing : null}
          {visibleSections.followup ? followup : null}
          {visibleSections.activityLog ? activityLog : null}
          {notes}
        </div>
        <div className="lg:col-span-4">{sidebar}</div>
      </div>

      {/* Tablette portrait (md) : empilé 1 colonne, sidebar en bas */}
      <div className="hidden md:block lg:hidden space-y-4 pb-24">
        {visibleSections.identity ? identity : null}
        {visibleSections.capture ? capture : null}
        {visibleSections.dataQuality ? dataQuality : null}
        {visibleSections.preExport ? preExport : null}
        {visibleSections.exports ? exports : null}
        {visibleSections.historicalDocs ? historicalDocs : null}
        {visibleSections.communication ? communication : null}
        {visibleSections.billing ? billing : null}
        {visibleSections.followup ? followup : null}
        {visibleSections.activityLog ? activityLog : null}
        {notes}
        <div className="pt-4 border-t border-[#0F1419]/[0.08]">{sidebar}</div>
      </div>

      {/* Mobile : tabs bottom */}
      <div className="md:hidden space-y-4 pb-24">
        {mobileTab === 'overview' ? overviewBlock : null}
        {mobileTab === 'details' ? detailsBlock : null}
        {mobileTab === 'actions' ? actionsBlock : null}
        {mobileTab === 'followup' ? followupBlock : null}
      </div>

      {/* Bottom nav mobile */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[#0F1419]/[0.08] bg-paper"
        role="tablist"
        aria-label="Navigation dossier"
      >
        <div className="grid grid-cols-4">
          <MobileTabBtn
            label="Aperçu"
            active={mobileTab === 'overview'}
            onClick={() => setMobileTab('overview')}
          />
          <MobileTabBtn
            label="Détails"
            active={mobileTab === 'details'}
            onClick={() => setMobileTab('details')}
          />
          <MobileTabBtn
            label="Actions"
            active={mobileTab === 'actions'}
            onClick={() => setMobileTab('actions')}
          />
          <MobileTabBtn
            label="Suivi"
            active={mobileTab === 'followup'}
            onClick={() => setMobileTab('followup')}
          />
        </div>
      </nav>
    </div>
  )
}

function MobileTabBtn({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-none h-12 ${
        active ? 'text-[#0F1419] border-t-2 border-t-[#0F1419]' : 'text-[#0F1419]/72'
      }`}
    >
      {label}
    </Button>
  )
}
