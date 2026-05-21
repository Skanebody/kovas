'use client'

/**
 * Boutons d'action sur la page publique /c/<token> :
 *   - Ajouter aux contacts (download .vcf)
 *   - Apple Wallet (.pkpass) — masqué si pas configuré
 *   - Partager (Web Share API si supporté, sinon copie lien)
 *
 * Tous les downloads passent par window.location pour garder l'UX simple
 * (pas de fetch + Blob — l'API renvoie déjà les bons headers).
 */

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Download, Share2, Wallet } from 'lucide-react'

interface PublicCardActionsProps {
  vcardUrl: string
  walletUrl: string | null
  shareTitle: string
}

export function PublicCardActions({ vcardUrl, walletUrl, shareTitle }: PublicCardActionsProps) {
  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: shareTitle, url })
        return
      } catch {
        // user cancel → fallback copy
      }
    }
    if (typeof navigator !== 'undefined' && 'clipboard' in navigator) {
      try {
        await navigator.clipboard.writeText(url)
        toast.success('Lien copié dans le presse-papiers')
      } catch {
        toast.error('Impossible de copier le lien')
      }
    }
  }

  return (
    <div className="grid grid-cols-1 gap-2.5">
      <Button asChild size="lg" className="w-full">
        <a href={vcardUrl}>
          <Download className="size-4" />
          Ajouter à mes contacts
        </a>
      </Button>
      {walletUrl ? (
        <Button asChild variant="outline" size="lg" className="w-full">
          <a href={walletUrl}>
            <Wallet className="size-4" />
            Ajouter à Apple Wallet
          </a>
        </Button>
      ) : null}
      <Button variant="ghost" size="lg" onClick={handleShare} className="w-full">
        <Share2 className="size-4" />
        Partager
      </Button>
    </div>
  )
}
