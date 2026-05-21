'use client'

/**
 * KOVAS — Barre d'actions du détail devis (client component).
 *
 * Boutons affichés selon le statut :
 *   - draft    → Modifier (lien) · Envoyer · Supprimer
 *   - sent     → Marquer accepté · Marquer refusé · Télécharger PDF
 *   - accepted → Convertir en facture (→ /app/factures/nouveau?from_quote=…)
 *   - refused / expired → (lecture seule)
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CreateFollowUpDialog } from '@/components/followup/CreateFollowUpDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Bell,
  Check,
  Download,
  FileText,
  Loader2,
  Pencil,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  deleteQuoteDraftAction,
  markQuoteAcceptedAction,
  markQuoteRefusedAction,
  sendQuoteAction,
} from '../actions'

interface QuoteDetailActionsProps {
  quoteId: string
  quoteReference: string
  status: string
  hasPdf: boolean
  pdfUrl: string | null
  /** True si une séquence active/paused existe déjà pour ce devis. */
  hasActiveFollowUp: boolean
}

export function QuoteDetailActions({
  quoteId,
  quoteReference,
  status,
  hasPdf,
  pdfUrl,
  hasActiveFollowUp,
}: QuoteDetailActionsProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [followUpOpen, setFollowUpOpen] = useState(false)

  function handleSend() {
    startTransition(async () => {
      const res = await sendQuoteAction(quoteId)
      if (!res.success) {
        toast.error(res.error ?? 'Envoi impossible.')
        return
      }
      toast.success('Devis envoyé.')
      router.refresh()
    })
  }

  function handleAccept() {
    startTransition(async () => {
      const res = await markQuoteAcceptedAction(quoteId)
      if (!res.success) {
        toast.error(res.error ?? 'Action impossible.')
        return
      }
      toast.success('Devis marqué accepté.')
      router.refresh()
    })
  }

  function handleRefuse() {
    startTransition(async () => {
      const res = await markQuoteRefusedAction(quoteId)
      if (!res.success) {
        toast.error(res.error ?? 'Action impossible.')
        return
      }
      toast.success('Devis marqué refusé.')
      router.refresh()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteQuoteDraftAction(quoteId)
      if (!res.success) {
        toast.error(res.error ?? 'Suppression impossible.')
        return
      }
      toast.success('Brouillon supprimé.')
      setDeleteOpen(false)
      router.push('/dashboard/devis')
    })
  }

  if (status === 'draft') {
    return (
      <Card variant="opaque" padding="sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" disabled>
            {/* Édition d'un brouillon : V1 retour wizard (TODO V1.1 réutiliser wizard avec id) */}
            <span aria-disabled="true" className="opacity-60 cursor-not-allowed">
              <Pencil className="size-4" /> Modifier (V1.1)
            </span>
          </Button>
          <Button variant="accent" size="sm" onClick={handleSend} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Envoyer au client
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            disabled={pending}
          >
            <Trash2 className="size-4" /> Supprimer le brouillon
          </Button>
        </div>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer ce brouillon ?</DialogTitle>
              <DialogDescription>
                Cette action est irréversible. Le brouillon sera archivé (soft delete).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    )
  }

  if (status === 'sent') {
    return (
      <>
        <Card variant="opaque" padding="sm">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="accent" size="sm" onClick={handleAccept} disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Marquer accepté
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefuse} disabled={pending}>
              <X className="size-4" /> Marquer refusé
            </Button>
            {hasPdf && pdfUrl ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="size-4" /> Télécharger PDF
                </Link>
              </Button>
            ) : null}
            {hasActiveFollowUp ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/relances?tab=pending_quote">
                  <Bell className="size-4" /> Séquence active
                </Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFollowUpOpen(true)}
                disabled={pending}
              >
                <Bell className="size-4" /> Créer une séquence de relance
              </Button>
            )}
          </div>
        </Card>

        <CreateFollowUpDialog
          open={followUpOpen}
          onOpenChange={setFollowUpOpen}
          targetType="quote"
          targetId={quoteId}
          targetReference={quoteReference}
        />
      </>
    )
  }

  if (status === 'accepted') {
    return (
      <Card variant="opaque" padding="sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="accent" size="sm">
            <Link href={`/dashboard/factures/nouveau?from_quote=${quoteId}`}>
              <FileText className="size-4" /> Convertir en facture
            </Link>
          </Button>
          {hasPdf && pdfUrl ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <Download className="size-4" /> Télécharger PDF
              </Link>
            </Button>
          ) : null}
        </div>
      </Card>
    )
  }

  // refused / expired → lecture seule + PDF
  return (
    <Card variant="opaque" padding="sm">
      <div className="flex flex-wrap items-center gap-2">
        {hasPdf && pdfUrl ? (
          <Button asChild variant="outline" size="sm">
            <Link href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <Download className="size-4" /> Télécharger PDF
            </Link>
          </Button>
        ) : (
          <p className="text-[13px] text-ink-mute italic">
            Aucune action disponible — devis {status}.
          </p>
        )}
      </div>
    </Card>
  )
}
