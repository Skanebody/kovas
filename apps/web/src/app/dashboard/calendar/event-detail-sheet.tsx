'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MissionTypeTag } from '@/components/ui/mission-type-tag'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import {
  Ban,
  CalendarPlus,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  PenLine,
  Play,
  Tag,
} from 'lucide-react'
import Link from 'next/link'
import { useTransition } from 'react'
import { cancelDossierAction } from './actions'

export interface CalendarEventDetail {
  dossierId: string
  reference: string
  scheduledAt: string
  durationMinutes: number
  clientName: string | null
  address: string | null
  city: string | null
  missionTypes: string[]
  status: string
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  scheduled: 'Planifié',
  on_site: 'Sur place',
  back_office: 'Au bureau',
  done: 'Terminé',
  archived: 'Archivé',
  cancelled: 'Annulé',
}

const STATUS_VARIANT: Record<string, 'muted' | 'blue' | 'green' | 'orange' | 'red'> = {
  draft: 'muted',
  scheduled: 'blue',
  on_site: 'orange',
  back_office: 'orange',
  done: 'green',
  archived: 'muted',
  cancelled: 'red',
}

interface EventDetailSheetProps {
  event: CalendarEventDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Drawer/Dialog d'aperçu d'un RDV calendrier — clic sur une event card.
 *
 * Évite le navigation immédiate vers le dossier : l'utilisateur voit les infos
 * essentielles (heure, durée, statut, adresse, diagnostics) puis choisit son
 * action (ouvrir le dossier, télécharger .ics, modifier le RDV, annuler).
 *
 * Implémenté en Dialog Radix (centré, responsive). Sur mobile petit écran, le
 * Dialog s'étire en pleine largeur.
 */
export function EventDetailSheet({ event, open, onOpenChange }: EventDetailSheetProps) {
  const [isCancelling, startCancel] = useTransition()

  if (!event) return null

  const start = new Date(event.scheduledAt)
  const end = new Date(start.getTime() + event.durationMinutes * 60_000)
  const timeStart = start.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
  const timeEnd = end.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
  const dateLabel = start.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  })

  function handleCancel() {
    if (!event) return
    const ok = window.confirm(
      `Annuler le RDV du ${dateLabel} pour ${event.clientName ?? 'ce client'} ?\n\nLe dossier sera marqué "Annulé". L'événement disparaîtra du calendrier.`,
    )
    if (!ok) return
    startCancel(async () => {
      try {
        await cancelDossierAction(event.dossierId)
        toast.success('RDV annulé')
        onOpenChange(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Impossible d'annuler le RDV")
      }
    })
  }

  const fullAddress = [event.address, event.city].filter(Boolean).join(', ')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="font-serif italic text-2xl text-[#0F1419] truncate">
                {event.clientName ?? 'Sans client'}
              </DialogTitle>
              <DialogDescription className="font-mono text-[11px] uppercase tracking-[0.1em]">
                {event.reference}
              </DialogDescription>
            </div>
            <Badge variant={STATUS_VARIANT[event.status] ?? 'muted'}>
              {STATUS_LABELS[event.status] ?? event.status}
            </Badge>
          </div>
        </DialogHeader>

        {/* Date + heure */}
        <div className="rounded-xl border border-[#0F1419]/[0.08] bg-paper p-3 space-y-2">
          <div className="flex items-start gap-2.5">
            <Clock className="size-4 text-[#0F1419]/72 shrink-0 mt-0.5" aria-hidden />
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="text-sm font-medium text-[#0F1419] capitalize">{dateLabel}</p>
              <p className="text-xs font-mono text-[#0F1419]/82 tabular-nums">
                {timeStart} → {timeEnd}{' '}
                <span className="text-[#0F1419]/72">· {event.durationMinutes} min</span>
              </p>
            </div>
          </div>
          {fullAddress && (
            <div className="flex items-start gap-2.5 pt-1 border-t border-[#0F1419]/[0.08]">
              <MapPin className="size-4 text-[#0F1419]/72 shrink-0 mt-0.5" aria-hidden />
              <p className="text-xs text-[#0F1419]/82">{fullAddress}</p>
            </div>
          )}
        </div>

        {/* Diagnostics */}
        {event.missionTypes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.1em] text-[#0F1419]/72">
              <Tag className="size-3" /> Diagnostics
            </div>
            <div className="flex flex-wrap gap-1.5">
              {event.missionTypes.map((t) => (
                <MissionTypeTag key={t} type={t} size="short" />
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          {/* FIX-JJ multi-accès #3 — Démarrer la mission directement depuis le calendrier */}
          {event.status !== 'done' &&
          event.status !== 'archived' &&
          event.status !== 'cancelled' ? (
            <Button asChild variant="accent" size="sm" className="sm:col-span-2">
              <Link href={`/dashboard/dossiers/${event.dossierId}/mission/tchat`}>
                <Play className="size-3.5" />
                {event.status === 'on_site' ? 'Reprendre la mission' : 'Démarrer la mission'}
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/dossiers/${event.dossierId}`}>
              Voir le dossier <ExternalLink className="size-3.5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={`/api/dossiers/${event.dossierId}/calendar.ics`}
              download
              rel="noopener noreferrer"
            >
              <CalendarPlus className="size-3.5" /> Télécharger .ics
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/dossiers/${event.dossierId}#info`}>
              <PenLine className="size-3.5" /> Modifier le RDV
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={isCancelling || event.status === 'cancelled'}
            className={cn(
              'text-danger hover:text-danger hover:bg-danger/10',
              event.status === 'cancelled' && 'opacity-50',
            )}
          >
            {isCancelling ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Ban className="size-3.5" />
            )}
            {event.status === 'cancelled' ? 'Déjà annulé' : 'Annuler le RDV'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
