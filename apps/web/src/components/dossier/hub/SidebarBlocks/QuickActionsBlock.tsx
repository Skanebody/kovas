'use client'

import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { Camera, Download, Link2, Mail, Mic, Phone, Share2 } from 'lucide-react'
import Link from 'next/link'
import type { ComponentType } from 'react'
import { useState } from 'react'

interface QuickActionsBlockProps {
  dossierId: string
  clientPhone: string | null
  clientEmail: string | null
}

/**
 * Bloc sidebar — Actions rapides (6 boutons icônes carrés ~80px).
 *
 * Branchements (refonte 2026-05-23 — 3e tentative, root cause :
 * les ancres `#capture` / `#exports` pointaient vers des sections cachées par
 * `getVisibleSections(state)` quand le dossier était en `brouillon`/`confirme`/
 * `paye`/`archive`. Donc cliquer ne faisait rien). On route maintenant vers des
 * pages dédiées qui existent TOUJOURS quel que soit l'état du dossier :
 *
 * - Mic     : `/dashboard/dossiers/[id]/mission` (mode terrain capture-first
 *             voice + photos + scans, ALWAYS rendered)
 * - Camera  : idem mission (sub-route dédiée capture)
 * - Mail    : `mailto:` si email client présent, sinon toast d'info
 * - Phone   : `tel:` si téléphone client présent, sinon toast d'info
 * - Share   : ouvre Dialog "Partager le dossier" (3 modes : lien copiable,
 *             email pré-rempli, téléchargement ZIP)
 * - Download: `/dashboard/dossiers/[id]/prevalidation` (export/validation
 *             ADEME + génération PDF — ALWAYS rendered)
 */
export function QuickActionsBlock({ dossierId, clientPhone, clientEmail }: QuickActionsBlockProps) {
  const missionUrl = `/dashboard/dossiers/${dossierId}/mission`
  const prevalidationUrl = `/dashboard/dossiers/${dossierId}/prevalidation`
  return (
    <Card variant="flat" padding="sm" className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
        Actions rapides
      </p>
      <div className="grid grid-cols-3 gap-2">
        <ActionLink href={missionUrl} label="Notes vocales" icon={Mic} />
        <ActionLink href={missionUrl} label="Photos" icon={Camera} />
        <ActionMail clientEmail={clientEmail} dossierId={dossierId} />
        <ActionPhone clientPhone={clientPhone} />
        <ActionShare dossierId={dossierId} clientEmail={clientEmail} />
        <ActionLink href={prevalidationUrl} label="Exporter" icon={Download} />
      </div>
    </Card>
  )
}

const BASE_CLASS =
  'flex aspect-square flex-col items-center justify-center rounded-md border border-rule/60 bg-paper hover:border-ink/30 hover:bg-cream-deep/30 transition-all duration-fast cursor-pointer'

interface IconProps {
  className?: string
}

function ActionLink({
  href,
  label,
  icon: Icon,
}: {
  href: string
  label: string
  icon: ComponentType<IconProps>
}) {
  return (
    <Link href={href} prefetch={false} className={BASE_CLASS} aria-label={label}>
      <Icon className="size-4 text-ink" />
      <span className="text-[10px] font-medium text-ink-soft mt-1.5 leading-tight text-center">
        {label}
      </span>
    </Link>
  )
}

function ActionMail({
  clientEmail,
  dossierId: _dossierId,
}: {
  clientEmail: string | null
  dossierId: string
}) {
  if (clientEmail) {
    return (
      <a
        href={`mailto:${clientEmail}`}
        className={BASE_CLASS}
        aria-label={`Envoyer un email à ${clientEmail}`}
      >
        <Mail className="size-4 text-ink" />
        <span className="text-[10px] font-medium text-ink-soft mt-1.5 leading-tight text-center">
          Email
        </span>
      </a>
    )
  }
  return (
    <button
      type="button"
      className={BASE_CLASS}
      onClick={() =>
        toast.info('Aucun email client', {
          description: 'Ajoutez une adresse email au client pour activer ce raccourci.',
        })
      }
    >
      <Mail className="size-4 text-ink-faint" />
      <span className="text-[10px] font-medium text-ink-faint mt-1.5 leading-tight text-center">
        Email
      </span>
    </button>
  )
}

function ActionPhone({ clientPhone }: { clientPhone: string | null }) {
  if (clientPhone) {
    return (
      <a href={`tel:${clientPhone}`} className={BASE_CLASS} aria-label={`Appeler ${clientPhone}`}>
        <Phone className="size-4 text-ink" />
        <span className="text-[10px] font-medium text-ink-soft mt-1.5 leading-tight text-center">
          Appeler
        </span>
      </a>
    )
  }
  return (
    <button
      type="button"
      className={BASE_CLASS}
      onClick={() =>
        toast.info('Aucun téléphone client', {
          description: 'Ajoutez un numéro au client pour activer ce raccourci.',
        })
      }
    >
      <Phone className="size-4 text-ink-faint" />
      <span className="text-[10px] font-medium text-ink-faint mt-1.5 leading-tight text-center">
        Appeler
      </span>
    </button>
  )
}

function ActionShare({
  dossierId,
  clientEmail,
}: {
  dossierId: string
  clientEmail: string | null
}) {
  const [open, setOpen] = useState(false)
  // URL canonique à partager — V1 : pointe sur le hub interne. V2 : lien
  // public en lecture seule (token signé) via la table dossiers.client_upload_token.
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard/dossiers/${dossierId}`
      : `/dashboard/dossiers/${dossierId}`

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Lien copié', {
        description: 'Le lien du dossier est dans votre presse-papiers.',
      })
      setOpen(false)
    } catch (_e) {
      toast.error('Copie impossible', {
        description: "Votre navigateur a refusé l'accès au presse-papiers.",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={BASE_CLASS} aria-label="Partager le dossier">
          <Share2 className="size-4 text-ink" />
          <span className="text-[10px] font-medium text-ink-soft mt-1.5 leading-tight text-center">
            Partager
          </span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Partager le dossier</DialogTitle>
          <DialogDescription>
            Trois modes de partage. Le lien envoyé renvoie vers votre espace KOVAS — accessible
            uniquement aux comptes autorisés.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void copyLink()}
            className="w-full flex items-center justify-between rounded-md border border-rule/60 bg-paper px-3 py-2.5 text-[13px] text-ink-soft hover:border-ink/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Link2 className="size-4 text-ink-mute" />
              Copier le lien du dossier
            </span>
            <span className="font-mono text-[10px] text-ink-faint">URL</span>
          </button>
          {clientEmail ? (
            <a
              href={`mailto:${clientEmail}?subject=${encodeURIComponent('Votre dossier KOVAS')}&body=${encodeURIComponent(
                `Bonjour,\n\nVoici le lien d'accès à votre dossier :\n${shareUrl}\n\nCordialement,`,
              )}`}
              className="w-full flex items-center justify-between rounded-md border border-rule/60 bg-paper px-3 py-2.5 text-[13px] text-ink-soft hover:border-ink/30 transition-colors"
              onClick={() => setOpen(false)}
            >
              <span className="flex items-center gap-2">
                <Mail className="size-4 text-ink-mute" />
                Envoyer par email au client
              </span>
              <span className="font-mono text-[10px] text-ink-faint">{clientEmail}</span>
            </a>
          ) : (
            <div className="w-full rounded-md border border-dashed border-rule/60 bg-paper/60 px-3 py-2.5 text-[12px] text-ink-faint">
              Aucun email client renseigné — ajoutez-en un dans la fiche client pour activer
              l&apos;envoi direct.
            </div>
          )}
          <a
            href={`/api/dossiers/${dossierId}/export/zip`}
            download
            onClick={() => setOpen(false)}
            className="w-full flex items-center justify-between rounded-md border border-rule/60 bg-paper px-3 py-2.5 text-[13px] text-ink-soft hover:border-ink/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Download className="size-4 text-ink-mute" />
              Télécharger le ZIP complet
            </span>
            <span className="font-mono text-[10px] text-ink-faint">ZIP</span>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
