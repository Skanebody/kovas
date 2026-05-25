/**
 * KOVAS — Page Pré-validation DPE (cockpit ADEME).
 *
 * Server component qui rend le formulaire client (`PrevalidationForm`) +
 * le header de page. Le formulaire gère seul son état + le POST vers
 * `/api/ademe/prevalidate` puis l'affichage du résultat.
 */

import type { Metadata } from 'next'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

import { PrevalidationForm } from '@/components/ademe/PrevalidationForm'
import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'

// Note REFONTE acqui-target : pour brancher le nouveau PrevalidationPanel (GC1)
// sur une mission existante, importer + utiliser :
//   import { PrevalidationPanel } from '@/components/cockpit-ademe/PrevalidationPanel'
//   <PrevalidationPanel missionId={missionId} />
// Le composant consomme /api/missions/[id]/prevalidation-score (A1.3.3 + A1.3.4).

export const metadata: Metadata = { title: 'Pré-validation DPE' }

export default function PrevalidationPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/cockpit-ademe">
          <ArrowLeft className="size-4" /> Retour au cockpit
        </Link>
      </Button>

      <AppPageHeader
        eyebrow="Cockpit ADEME"
        title="Pré-valider"
        accent="un DPE"
        description="Saisissez 10 caractéristiques clés — KOVAS évalue le risque de contrôle ADEME avant publication."
      />

      <PrevalidationForm />
    </div>
  )
}
