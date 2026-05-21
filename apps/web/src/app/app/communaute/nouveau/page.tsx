/**
 * /app/communaute/nouveau — formulaire de soumission d'un cas.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { CommunityCaseForm } from '@/components/community/CommunityCaseForm'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Partager un cas — Communauté' }

export default async function NewCommunityCasePage() {
  // Auth gate.
  await getCurrentUser()

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        title="Partager"
        accent="un cas"
        description="Anonymisation automatique avant publication — votre cas sera modéré sous 24-48h."
        eyebrow="Communauté"
      />
      <CommunityCaseForm />
    </div>
  )
}
