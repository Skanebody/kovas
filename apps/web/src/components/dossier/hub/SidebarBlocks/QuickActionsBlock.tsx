'use client'

import { Card } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { Camera, Download, Mail, Mic, Phone, Share2 } from 'lucide-react'
import Link from 'next/link'

interface QuickActionsBlockProps {
  dossierId: string
  clientPhone: string | null
  clientEmail: string | null
}

const ICON_MAP = { Mic, Camera, Mail, Phone, Download, Share2 }

interface QuickAction {
  id: string
  label: string
  icon: keyof typeof ICON_MAP
  href?: string
  onClickToast?: string
}

/**
 * Bloc sidebar — Actions rapides (4-6 boutons icônes carrés ~80px).
 * Branche sur les actions les plus fréquentes du diagnostiqueur.
 */
export function QuickActionsBlock({
  dossierId,
  clientPhone,
  clientEmail,
}: QuickActionsBlockProps) {
  const actions: QuickAction[] = [
    {
      id: 'voice',
      label: 'Notes vocales',
      icon: 'Mic',
      href: `/app/dossiers/${dossierId}#capture`,
    },
    {
      id: 'photo',
      label: 'Photos',
      icon: 'Camera',
      href: `/app/dossiers/${dossierId}#capture`,
    },
    clientEmail
      ? {
          id: 'email',
          label: 'Email',
          icon: 'Mail',
          href: `mailto:${clientEmail}`,
        }
      : { id: 'email', label: 'Email', icon: 'Mail', onClickToast: 'Aucun email client.' },
    clientPhone
      ? { id: 'call', label: 'Appeler', icon: 'Phone', href: `tel:${clientPhone}` }
      : { id: 'call', label: 'Appeler', icon: 'Phone', onClickToast: 'Aucun téléphone client.' },
    {
      id: 'share',
      label: 'Partager',
      icon: 'Share2',
      onClickToast: 'Partage 3 modes — bientôt.',
    },
    {
      id: 'download',
      label: 'Exporter',
      icon: 'Download',
      onClickToast: 'Exports disponibles après validation.',
    },
  ]

  return (
    <Card variant="flat" padding="sm" className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
        Actions rapides
      </p>
      <div className="grid grid-cols-3 gap-2">
        {actions.map((a) => {
          const Icon = ICON_MAP[a.icon]
          const content = (
            <>
              <Icon className="size-4 text-ink" />
              <span className="text-[10px] font-medium text-ink-soft mt-1.5 leading-tight text-center">
                {a.label}
              </span>
            </>
          )
          const className =
            'flex aspect-square flex-col items-center justify-center rounded-md border border-rule/60 bg-paper hover:border-ink/30 transition-all duration-fast'
          if (a.href) {
            return (
              <Link key={a.id} href={a.href} className={className}>
                {content}
              </Link>
            )
          }
          return (
            <button
              key={a.id}
              type="button"
              className={className}
              onClick={() => a.onClickToast && toast.info(a.onClickToast)}
            >
              {content}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
