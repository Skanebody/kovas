'use client'

/**
 * Aperçu live du QR + boutons de téléchargement / partage.
 *
 * Utilise les routes API `/api/business-card/*` (auth user implicite via
 * cookie session — pas besoin de passer un token).
 */

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useState, useTransition } from 'react'
import { Download, FileText, Link as LinkIcon, Wallet } from 'lucide-react'
import { regeneratePublicTokenAction } from './actions'

interface VCardQrPreviewProps {
  fullName: string
  organization: string
  title: string | null
  /** URL absolue de la carte publique. */
  publicUrl: string
  /** `true` si APPLE_WALLET_CERT_PATH et consorts sont configurés. */
  walletEnabled: boolean
  /** Pour buster le cache QR après update toggles. */
  refreshKey: string
}

export function VCardQrPreview({
  fullName,
  organization,
  title,
  publicUrl,
  walletEnabled,
  refreshKey,
}: VCardQrPreviewProps) {
  const [isRegenerating, startRegenerate] = useTransition()
  const [copied, setCopied] = useState(false)

  const qrSrc = `/api/business-card/qr?format=svg&size=512&logo=true&v=${encodeURIComponent(refreshKey)}`

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      toast.success('Lien copié')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Impossible de copier le lien')
    }
  }

  const regenerate = () => {
    if (
      !confirm(
        'Régénérer le lien public ? L\'ancien lien et ses QR imprimés cesseront de fonctionner.',
      )
    )
      return
    startRegenerate(async () => {
      const res = await regeneratePublicTokenAction()
      if (res?.error) toast.error(res.error)
      else toast.success('Lien public régénéré')
    })
  }

  return (
    <div className="space-y-6">
      {/* QR — grand format */}
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-2xl bg-white p-5 shadow-glass-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt={`QR carte de visite ${fullName}`}
            width={320}
            height={320}
            className="size-[320px]"
          />
        </div>
        <div className="text-center space-y-1">
          <p className="font-serif italic text-[28px] leading-tight text-[#0F1419]">
            {fullName}
          </p>
          <p className="font-sans font-semibold text-[14px] text-[#0F1419]">
            {organization}
          </p>
          {title ? <p className="text-[12px] text-[#0F1419]/60">{title}</p> : null}
        </div>
      </div>

      {/* 4 boutons download */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Button asChild size="sm" variant="default" className="w-full">
          <a
            href="/api/business-card/qr?format=png&size=1024&logo=false"
            download="kovas-qr.png"
          >
            <Download className="size-4" />
            QR PNG (1024 px)
          </a>
        </Button>
        <Button asChild size="sm" variant="outline" className="w-full">
          <a href="/api/business-card/pdf" download="cartes-de-visite.pdf">
            <FileText className="size-4" />
            PDF imprimable A4
          </a>
        </Button>
        {walletEnabled ? (
          <Button asChild size="sm" variant="outline" className="w-full">
            <a href="/api/business-card/wallet" download>
              <Wallet className="size-4" />
              Apple Wallet
            </a>
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled className="w-full" title="Bientôt disponible">
            <Wallet className="size-4" />
            Apple Wallet
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={copyUrl} className="w-full">
          <LinkIcon className="size-4" />
          {copied ? 'Copié' : 'Partager le lien'}
        </Button>
      </div>

      {/* Lien public + régénération */}
      <div className="rounded-lg border border-[#0F1419]/10 p-4 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#0F1419]/60">
          Lien public
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={publicUrl}
            readOnly
            className="flex-1 rounded-md border border-[#0F1419]/10 bg-white px-3 py-2 text-[13px] font-mono text-[#0F1419] focus:outline-none focus:ring-2 focus:ring-[#0F1419]/15"
            onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
          />
          <Button size="sm" variant="ghost" onClick={copyUrl}>
            {copied ? 'Copié' : 'Copier'}
          </Button>
        </div>
        <button
          type="button"
          onClick={regenerate}
          disabled={isRegenerating}
          className="text-[12px] text-[#0F1419]/60 underline underline-offset-2 hover:text-[#0F1419] disabled:opacity-50"
        >
          {isRegenerating ? 'Régénération…' : 'Régénérer le lien'}
        </button>
      </div>
    </div>
  )
}
