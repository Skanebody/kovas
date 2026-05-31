'use client'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/toaster'
import { Inbox } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { acceptLeadAssignment, declineLeadAssignment } from './actions'
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
  const router = useRouter()
  const [, startTransition] = useTransition()
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
    const lead = currentLead
    // "Envoyer un devis" = accepter le lead : on débloque les coordonnées via
    // acceptLeadAssignment (lead.id === lead_assignments.id côté page.tsx).
    startTransition(async () => {
      const res = await acceptLeadAssignment(lead.id)
      if (res.ok) {
        toast.success('Lead accepté', {
          description: `Coordonnées débloquées — préparez le devis pour ${lead.clientDisplayName}.`,
        })
        moveToNext(lead.id)
        router.refresh()
      } else {
        toast.error("Impossible d'accepter ce lead", {
          description: res.error ?? 'Réessayez dans un instant.',
        })
      }
    })
  }, [currentLead, moveToNext, router])

  const handleDefer = useCallback(() => {
    if (!currentLead) return
    // "Plus tard" = simple report local (aucune action DB destructrice :
    // refuser supprimerait définitivement le lead). Le lead réapparaîtra au
    // prochain chargement tant qu'il reste en statut pending.
    toast('Reporté à plus tard', {
      description: 'Le lead réapparaîtra à la prochaine ouverture.',
    })
    moveToNext(currentLead.id)
  }, [currentLead, moveToNext])

  const handlePostCallSubmit = useCallback(
    async ({
      leadId,
      outcome,
      note,
    }: {
      leadId: string
      outcome: PostCallOutcome
      note: string
    }) => {
      // Compte-rendu post-appel branché sur les server actions réelles :
      //  - quote_sent / callback_later → on garde le lead → acceptLeadAssignment
      //  - not_interested → on refuse le lead → declineLeadAssignment (note = motif)
      if (outcome === 'not_interested') {
        const res = await declineLeadAssignment(leadId, note)
        if (res.ok) {
          toast.success('Lead clôturé')
          setPostCallOpen(false)
          moveToNext(leadId)
          router.refresh()
        } else {
          toast.error('Impossible de clôturer ce lead', {
            description: res.error ?? 'Réessayez dans un instant.',
          })
        }
        return
      }

      const res = await acceptLeadAssignment(leadId)
      if (res.ok) {
        toast.success(outcome === 'quote_sent' ? 'Devis à préparer' : 'Rappel programmé')
        setPostCallOpen(false)
        moveToNext(leadId)
        router.refresh()
      } else {
        toast.error("Impossible d'enregistrer le compte-rendu", {
          description: res.error ?? 'Réessayez dans un instant.',
        })
      }
    },
    [moveToNext, router],
  )

  if (pendingLeads.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Aucun lead en attente. Bien joué."
        description="Tous les leads ont été traités. Les prochaines demandes apparaîtront ici dès qu'elles arriveront."
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
