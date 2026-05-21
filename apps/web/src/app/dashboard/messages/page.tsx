import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { MessagesSquare } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Messages' }

/**
 * Messages v1.5 (placeholder).
 * Spec wireframe v4 §10 : 3 colonnes (conversations | thread | contexte) +
 * suggestion IA en draft (jamais envoi auto). À implémenter post-MVP V1.
 *
 * Pour V1, les messages clients passent par email natif (mailto:) et SMS
 * (sms:) depuis TodayMissionActions sur le dashboard.
 */
export default function MessagesPage() {
  return (
    <EmptyState
      icon={MessagesSquare}
      title="Boîte vide. Bonne nouvelle."
      description="La messagerie centralisée arrive en V1.5 : conversations clients, suggestions IA en draft, notifications consolidées. Pour l'instant, utilisez email et SMS depuis vos missions du jour."
      action={
        <Button asChild>
          <Link href="/dashboard/dossiers">Voir mes dossiers</Link>
        </Button>
      }
    />
  )
}
