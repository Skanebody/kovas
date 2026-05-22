'use client'

import { Button } from '@/components/ui/button'
import { Check, Copy, Share2 } from 'lucide-react'
import { useState } from 'react'

export interface CopyShareButtonsProps {
  code: string
  shareUrl: string
}

/**
 * Boutons Copier / Partager pour un code de parrainage.
 * Web Share API si supportée (mobile), sinon clipboard.
 *
 * Ton sobre — feedback discret via une étiquette mono uppercase.
 */
export function CopyShareButtons({ code, shareUrl }: CopyShareButtonsProps) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      // silent
    }
  }

  async function handleShareOrCopyUrl() {
    const shareData = {
      title: 'Découvrez KOVAS',
      text: `Bonjour, je vous invite à essayer KOVAS, l'app diagnostic immobilier que j'utilise. 1 mois offert avec mon code : ${code}`,
      url: shareUrl,
    }
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        // utilisateur a annulé — on bascule sur clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch {
      // silent
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={handleCopyCode}>
        {copiedCode ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copiedCode ? 'Code copié' : 'Copier le code'}
      </Button>
      <Button type="button" variant="default" size="sm" onClick={handleShareOrCopyUrl}>
        {copiedUrl ? <Check className="size-4" /> : <Share2 className="size-4" />}
        {copiedUrl ? 'Lien copié' : 'Partager le lien'}
      </Button>
    </div>
  )
}
