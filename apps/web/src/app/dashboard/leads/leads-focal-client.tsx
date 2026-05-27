'use client'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/toaster'
import { History, Inbox } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { LeadFocalCard } from './lead-focal-card'
import { LeadsQueueSheet } from './leads-queue-sheet'
import type { LeadItem, PostCallOutcome } from './leads-types'
import { PostCallSheet } from './post-call-sheet'

interface LeadsFocalClientProps {
  leads: LeadItem[]
}

/**
 * File d'attente focale leads — 1 lead à la fois, plein écran.
 *
 * Flux :
 *  1. Lead courant affiché en card large
 *  2. "Appeler" → tel: ouvre app téléphone système + au retour focus, PostCallSheet
 *  3. "Envoyer un devis" / "Plus tard" → action directe sans appel
 *  4. Soumission compte-rendu → API + déplacement au lead suivant
 *  5. "Voir la file" → BottomSheet liste compacte
 */
export function LeadsFocalClient({ leads }: LeadsFocalClientProps) {
  const pendingLeads = useMemo(() => leads.filter((l) => l.status === 'pending'), [leads])

  const [currentId, setCurrentId] = useState<string | null>(pendingLeads[0]?.id ?? null)
  const [postCallOpen, setPostCallOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  // Marqueur "appel lancé" — au retour focus on ouvre le sheet
  const [pendingCallLeadId, setPendingCallLeadId] = useState<string | null>(null)

  const currentLead = useMemo(
    () => pendingLeads.find((l) => l.id === currentId) ?? null,
    [pendingLeads, currentId],
  )

  // Au retour focus après un appel tel:, ouvre le sheet compte-rendu
  useEffect(() => {
    function handleFocus() {
      if (pendingCallLeadId) {
        setPostCallOpen(true)
        setPendingCallLeadId(null)
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [pendingCallLeadId])

  const moveToNext = useCallback(
    (skipId: string) => {
      const remaining = pendingLeads.filter((l) => l.id !== skipId)
      setCurrentId(remaining[0]?.id ?? null)
    },
    [pendingLeads],
  )

  const handleCall = useCallback(() => {
    if (!currentLead?.clientPhone) return
    setPendingCallLeadId(currentLead.id)
    // Ouvre l'app téléphone système (PWA mobile + desktop fallback href:tel)
    window.location.href = `tel:${currentLead.clientPhone}`
  }, [currentLead])

  const handleSendQuote = useCallback(() => {
    if (!currentLead) return
    toast.success('Devis à envoyer', {
      description: `Préparez le devis pour ${currentLead.clientDisplayName}.`,
    })
    moveToNext(currentLead.id)
  }, [currentLead, moveToNext])

  const handleDefer = useCallback(() => {
    if (!currentLead) return
    toast('Reporté à plus tard', {
      description: 'Le lead réapparaîtra dans 24h.',
    })
    moveToNext(currentLead.id)
  }, [currentLead, moveToNext])

  const handlePostCallSubmit = useCallback(
    async ({
      leadId,
      outcome,
    }: {
      leadId: string
      outcome: PostCallOutcome
      note: string
    }) => {
      // Note : la table `lead_assignments` (Phase E) n'existe pas encore.
      // Quand elle sera déployée, brancher ici l'update :
      //   update lead_assignments set status='responded', responded_at=now(), response_note=note, outcome=outcome
      const label =
        outcome === 'quote_sent'
          ? 'Devis à préparer'
          : outcome === 'callback_later'
            ? 'Rappel programmé'
            : 'Lead clôturé'
      toast.success(label)
      setPostCallOpen(false)
      moveToNext(leadId)
    },
    [moveToNext],
  )

  if (pendingLeads.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Aucun lead en attente. Bien joué."
        description="Tous les leads ont été traités. Consulte l'historique pour revoir tes décisions."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/leads/history">
              <History className="size-4" />
              Voir l&apos;historique
            </Link>
          </Button>
        }
      />
    )
  }

  if (!currentLead) {
    // Cas défensif : aucun lead courant sélectionné alors qu'il y en a en attente
    return (
      <div className="text-center py-12">
        <p className="text-[14px] text-ink-mute">Sélectionnez un lead pour commencer.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setQueueOpen(true)}>
          Voir la file
        </Button>
      </div>
    )
  }

  const remaining = pendingLeads.length - 1

  return (
    <div className="space-y-6">
      <LeadFocalCard
        lead={currentLead}
        onCall={handleCall}
        onSendQuote={handleSendQuote}
        onDeferLater={handleDefer}
      />

      {remaining > 0 ? (
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-[13px] text-ink-mute">
            {remaining} autre{remaining > 1 ? 's' : ''} lead{remaining > 1 ? 's' : ''} en attente
          </span>
          <Button variant="ghost" size="sm" onClick={() => setQueueOpen(true)}>
            Voir la file
          </Button>
        </div>
      ) : null}

      <PostCallSheet
        open={postCallOpen}
        onOpenChange={setPostCallOpen}
        lead={currentLead}
        onSubmit={handlePostCallSubmit}
      />

      <LeadsQueueSheet
        open={queueOpen}
        onOpenChange={setQueueOpen}
        leads={pendingLeads}
        currentLeadId={currentLead.id}
        onSelect={(id) => {
          setCurrentId(id)
          setQueueOpen(false)
        }}
      />
    </div>
  )
}
