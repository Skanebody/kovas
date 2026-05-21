/**
 * Modale de réactivation — affichée quand l'utilisateur arrive sur
 * /app/account avec un query param `?reactivate=COMEBACK50-XXXXXXXX` valide
 * (vérifié côté server par la page wrapper).
 *
 * Sur acceptation : POST /api/cancellation/reactivate → reactivate subscription
 * + UPDATE cancellations.reactivated_at + winback_code_used_at.
 */

'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

interface ReactivationModalProps {
  code: string
  discountPercent: number
  discountDurationMonths: number
  expiresAt: string
  initialOpen?: boolean
}

interface ReactivateResponse {
  ok: boolean
  error?: string
}

function formatExpiry(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return 'prochainement'
  }
}

export function ReactivationModal({
  code,
  discountPercent,
  discountDurationMonths,
  expiresAt,
  initialOpen = true,
}: ReactivationModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(initialOpen)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function accept() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/cancellation/reactivate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ winbackCode: code }),
        })
        const data = (await res.json().catch(() => ({}))) as ReactivateResponse
        if (!res.ok || !data.ok) {
          setError(data.error ?? `Erreur (${res.status})`)
          return
        }
        // Refresh page sans query param
        router.replace('/dashboard/account?reactivated=1')
        router.refresh()
        setOpen(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur réseau')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <div className="size-12 rounded-full bg-amber/20 flex items-center justify-center mb-2">
            <Sparkles className="size-6 text-amber" />
          </div>
          <DialogTitle className="text-xl">
            Réactivez votre compte avec{' '}
            <span className="font-serif italic font-normal">-{discountPercent}%</span>
          </DialogTitle>
          <DialogDescription>
            Bon retour ! Votre code <strong>{code}</strong> applique{' '}
            <strong>-{discountPercent}% sur vos {discountDurationMonths} prochains mois</strong>.
            Vos données sont intactes, vous retrouvez tout là où vous l&apos;aviez laissé.
          </DialogDescription>
        </DialogHeader>

        <div className="text-xs text-ink-mute">
          Code valide jusqu&apos;au {formatExpiry(expiresAt)}. Utilisable une seule fois.
        </div>

        {error && (
          <p className="text-xs text-accent-red bg-accent-red/5 border border-accent-red/20 rounded-md p-3">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Plus tard
          </Button>
          <Button
            variant="default"
            className="flex-1"
            onClick={accept}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Réactiver maintenant
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
