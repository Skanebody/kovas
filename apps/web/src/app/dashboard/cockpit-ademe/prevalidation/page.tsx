/**
 * KOVAS — Page Pré-validation DPE (cockpit ADEME).
 *
 * Server component qui rend le formulaire client (`PrevalidationForm`) +
 * le header de page. Le formulaire gère seul son état + le POST vers
 * `/api/ademe/prevalidate` puis l'affichage du résultat.
 */

import type { Metadata } from 'next'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { AppPageHeader } from '@/components/app-page-header'
import { PrevalidationForm } from '@/components/ademe/PrevalidationForm'
import { Button } from '@/components/ui/button'

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
