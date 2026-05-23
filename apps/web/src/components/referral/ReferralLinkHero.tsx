'use client'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { Check, Copy, Linkedin, Mail, MessageSquare, QrCode, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'

export interface ReferralLinkHeroProps {
  /** Code parrainage de l'utilisateur courant — ex: `KOV-A4F2G` */
  code: string
  /** URL affiliée complète à partager — ex: `https://kovas.fr/r/KOV-A4F2G` */
  shareUrl: string
  /** Nom complet du parrain pour pré-remplir les messages (sobre, "Pierre Martin") */
  referrerDisplayName: string
}

/**
 * Hero affichant le lien affilié + boutons Copier / Partager multi-canaux.
 *
 * Canaux pris en charge :
 *   - Email (mailto:)
 *   - WhatsApp (https://wa.me/?text=)
 *   - LinkedIn (sharing/share-offsite)
 *   - SMS (sms:?body=)
 *   - QR code modal (généré via /api/referral/qr)
 *   - Web Share API natif (mobile) — fallback clipboard si refus
 *
 * Ton sobre, vouvoiement, pas d'emoji.
 */
export function ReferralLinkHero({ code, shareUrl, referrerDisplayName }: ReferralLinkHeroProps) {
  const [copied, setCopied] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

  // ESC ferme la modale QR
  useEffect(() => {
    if (!qrOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQrOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [qrOpen])

  const message = `Bonjour, je vous invite à essayer KOVAS, l'application diagnostic immobilier que j'utilise au quotidien. Vous bénéficiez d'un mois offert sur invitation : ${shareUrl}`
  const subject = `Une invitation KOVAS de la part de ${referrerDisplayName}`
  const linkedinText = `Je recommande KOVAS aux confrères diagnostiqueurs immobiliers. Application terrain, exports universels, conforme RGPD. Essai 30 jours via mon lien : ${shareUrl}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Lien copié dans le presse-papier')
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      toast.error('Copie impossible · essayez le partage natif')
    }
  }

  async function handleNativeShare() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'Invitation KOVAS',
          text: message,
          url: shareUrl,
        })
        return
      } catch {
        // utilisateur a annulé — silencieux
        return
      }
    }
    await handleCopy()
  }

  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(message)}`
  const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&summary=${encodeURIComponent(linkedinText)}`
  const sms = `sms:?&body=${encodeURIComponent(message)}`

  return (
    <div className="space-y-5">
      {/* Lien affilié + actions principales */}
      <div className="rounded-lg border border-rule/60 bg-sage/60 px-4 py-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
            Votre lien de parrainage
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
            Code · {code}
          </div>
        </div>
        <div
          className="font-mono text-[14px] sm:text-[15px] text-ink break-all leading-relaxed select-all"
          aria-label="Lien de parrainage à copier"
        >
          {shareUrl}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="default" size="sm" onClick={handleCopy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Lien copié' : 'Copier le lien'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleNativeShare}>
          <Share2 className="size-4" />
          Partager
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setQrOpen(true)}
          aria-haspopup="dialog"
        >
          <QrCode className="size-4" />
          QR code
        </Button>
      </div>

      {/* Canaux directs */}
      <div className="pt-4 border-t border-rule/40 space-y-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
          Envoyer en un clic
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ChannelButton href={mailto} icon={<Mail className="size-4" />} label="Email" />
          <ChannelButton
            href={whatsapp}
            icon={<MessageSquare className="size-4" />}
            label="WhatsApp"
            external
          />
          <ChannelButton
            href={linkedin}
            icon={<Linkedin className="size-4" />}
            label="LinkedIn"
            external
          />
          <ChannelButton href={sms} icon={<MessageSquare className="size-4" />} label="SMS" />
        </div>
      </div>

      {/* Modal QR */}
      {qrOpen ? <QrModal shareUrl={shareUrl} code={code} onClose={() => setQrOpen(false)} /> : null}
    </div>
  )
}

function ChannelButton({
  href,
  icon,
  label,
  external = false,
}: {
  href: string
  icon: React.ReactNode
  label: string
  external?: boolean
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="inline-flex items-center justify-center gap-2 rounded-md border border-rule/70 bg-paper px-3 py-2 text-[12px] font-medium text-ink hover:bg-cream-deep transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
    >
      {icon}
      {label}
    </a>
  )
}

function QrModal({
  shareUrl,
  code,
  onClose,
}: {
  shareUrl: string
  code: string
  onClose: () => void
}) {
  // QR servi par /api/referral/qr?url=... (SVG inline, pas de dépendance client)
  const qrSrc = `/api/referral/qr?url=${encodeURIComponent(shareUrl)}`
  return (
    // <dialog> sémantique : fermeture ESC déjà gérée par useEffect parent,
    // backdrop cliquable via <button> sous-jacent.
    <dialog
      open
      className="fixed inset-0 z-[100] bg-ink/40 backdrop-blur-sm m-0 max-w-none max-h-none w-screen h-screen flex items-center justify-center p-4"
      aria-labelledby="qr-modal-title"
    >
      <button
        type="button"
        aria-label="Fermer la fenêtre"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-transparent"
      />
      <div className="relative bg-paper rounded-xl border border-rule p-6 max-w-sm w-full space-y-4 shadow-lg">
        <div className="space-y-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
            Code QR · partage IRL
          </div>
          <h2 id="qr-modal-title" className="font-semibold text-[16px] text-ink">
            Scannez avec un téléphone
          </h2>
          <p className="text-[12px] text-ink-mute">
            Pratique en salon, réunion ou affichage cabinet. Ouvre directement la page d'inscription
            KOVAS avec votre code {code} appliqué.
          </p>
        </div>
        <div className="bg-white rounded-md border border-rule/60 p-4 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt={`QR code menant à ${shareUrl}`}
            width={240}
            height={240}
            className="size-[240px]"
          />
        </div>
        <div className="font-mono text-[11px] text-ink-mute break-all">{shareUrl}</div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={qrSrc} download={`kovas-parrainage-${code}.svg`}>
              Télécharger
            </a>
          </Button>
          <Button type="button" variant="default" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </dialog>
  )
}
