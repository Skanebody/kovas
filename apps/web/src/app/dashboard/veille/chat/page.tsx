/**
 * /app/veille/chat — Assistant IA réglementaire plein écran.
 *
 * Server component qui monte le client RegulatoryAIChat (gère lui-même
 * sessionId + streaming SSE).
 */

import { RegulatoryAIChat } from '@/components/regulatory/RegulatoryAIChat'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Assistant veille',
}

export default function VeilleChatPage() {
  return (
    <div className="space-y-5 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/veille">
            <ChevronLeft className="size-3.5" /> Retour
          </Link>
        </Button>
      </div>
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Assistant · Réglementation
        </p>
        <h1 className="font-serif italic font-normal text-3xl md:text-4xl tracking-tight text-ink leading-[1.05]">
          Une question ?
        </h1>
        <p className="text-sm text-ink-mute max-w-xl">
          L'assistant cite les documents qu'il consulte. Vous pouvez ouvrir chaque
          citation pour lire le détail.
        </p>
      </div>
      <RegulatoryAIChat variant="page" />
    </div>
  )
}
