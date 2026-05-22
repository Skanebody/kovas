'use client'

/**
 * RecoveryActions — grille 2x2 desktop affichée sur la page de validation
 * d'une mission pour récupérer un oubli à distance sans revenir sur place.
 *
 * 4 actions :
 *  1. Appeler le client (tel: link direct)
 *  2. Demander une photo (modal ClientPhotoRequest → Edge Function SMS)
 *  3. Visio rapide (modal VideoCallRequest → SMS lien)
 *  4. Re-visite Cal.com (ouvre lien externe Cal.com)
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { CalendarClock, Camera, Phone, Video } from 'lucide-react'
import { useState } from 'react'
import { ClientPhotoRequest } from './ClientPhotoRequest'
import { VideoCallRequest } from './VideoCallRequest'

interface RecoveryActionsProps {
  missionId: string
  organizationId: string
  /** Téléphone client E.164 (+33...). */
  clientPhone: string | null
  /** Nom du client (affichage UX). */
  clientName: string
  /** Lien Cal.com du diagnostiqueur pour booking re-visite. */
  calComLink?: string
  className?: string
}

export function RecoveryActions({
  missionId,
  organizationId,
  clientPhone,
  clientName,
  calComLink,
  className,
}: RecoveryActionsProps) {
  const [photoOpen, setPhotoOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)

  const phoneHref = clientPhone ? `tel:${clientPhone}` : '#'

  return (
    <>
      <Card className={cn('p-5', className)}>
        <div className="mb-4">
          <p className="label-mono text-ink-mute mb-1">Récupération à distance</p>
          <h3 className="text-[16px] font-semibold text-ink leading-snug">
            Un oubli sur le terrain ?
          </h3>
          <p className="text-[13px] text-ink-soft mt-1 leading-snug">
            Récupérez l\'information manquante sans repasser sur place — 4 voies disponibles.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="justify-start flex-col h-auto py-4 items-start"
            asChild={Boolean(clientPhone)}
            disabled={!clientPhone}
          >
            {clientPhone ? (
              <a href={phoneHref}>
                <span className="flex items-center gap-2">
                  <Phone className="size-4" aria-hidden />
                  <span className="text-[14px] font-medium">Appeler {clientName}</span>
                </span>
                <span className="text-[12px] text-ink-mute mt-1 font-mono">{clientPhone}</span>
              </a>
            ) : (
              <>
                <span className="flex items-center gap-2">
                  <Phone className="size-4" aria-hidden />
                  <span className="text-[14px] font-medium">Téléphone manquant</span>
                </span>
                <span className="text-[12px] text-ink-mute mt-1">
                  Ajoutez un numéro sur la fiche client
                </span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="justify-start flex-col h-auto py-4 items-start"
            onClick={() => setPhotoOpen(true)}
            disabled={!clientPhone}
          >
            <span className="flex items-center gap-2">
              <Camera className="size-4" aria-hidden />
              <span className="text-[14px] font-medium">Demander une photo</span>
            </span>
            <span className="text-[12px] text-ink-mute mt-1">SMS avec lien upload</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="justify-start flex-col h-auto py-4 items-start"
            onClick={() => setVideoOpen(true)}
            disabled={!clientPhone}
          >
            <span className="flex items-center gap-2">
              <Video className="size-4" aria-hidden />
              <span className="text-[14px] font-medium">Visio rapide</span>
            </span>
            <span className="text-[12px] text-ink-mute mt-1">Lien Meet/Whereby</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="justify-start flex-col h-auto py-4 items-start"
            asChild={Boolean(calComLink)}
            disabled={!calComLink}
          >
            {calComLink ? (
              <a href={calComLink} target="_blank" rel="noopener noreferrer">
                <span className="flex items-center gap-2">
                  <CalendarClock className="size-4" aria-hidden />
                  <span className="text-[14px] font-medium">Planifier re-visite</span>
                </span>
                <span className="text-[12px] text-ink-mute mt-1">Cal.com créneau client</span>
              </a>
            ) : (
              <>
                <span className="flex items-center gap-2">
                  <CalendarClock className="size-4" aria-hidden />
                  <span className="text-[14px] font-medium">Planifier re-visite</span>
                </span>
                <span className="text-[12px] text-ink-mute mt-1">Lien Cal.com non configuré</span>
              </>
            )}
          </Button>
        </div>
      </Card>

      {photoOpen && clientPhone && (
        <ClientPhotoRequest
          missionId={missionId}
          organizationId={organizationId}
          clientPhone={clientPhone}
          clientName={clientName}
          onClose={() => setPhotoOpen(false)}
        />
      )}
      {videoOpen && clientPhone && (
        <VideoCallRequest
          missionId={missionId}
          organizationId={organizationId}
          clientPhone={clientPhone}
          clientName={clientName}
          onClose={() => setVideoOpen(false)}
        />
      )}
    </>
  )
}
