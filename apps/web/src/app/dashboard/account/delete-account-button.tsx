'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { Loader2, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'

/**
 * Bouton "Supprimer mon compte (RGPD)" — ouvre modal de confirmation,
 * input "SUPPRIMER" requis (anti-fat-finger), puis POST /api/rgpd/request
 * avec type='erasure'.
 *
 * La suppression effective passe par le worker `dsar-processor` (90j grâce
 * en `pending` → exécution → 10 ans factures conservées).
 */
export function DeleteAccountButton() {
  const [confirmText, setConfirmText] = useState('')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const canConfirm = confirmText.trim().toUpperCase() === 'SUPPRIMER'

  const handleSubmit = () => {
    if (!canConfirm) return
    startTransition(async () => {
      try {
        const res = await fetch('/api/rgpd/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'erasure' }),
        })
        if (res.status === 409) {
          toast.error('Une demande de suppression est déjà en cours')
          return
        }
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          toast.error(data.error ?? 'Erreur lors de la demande de suppression')
          return
        }
        toast.success(
          'Demande enregistrée. 90 jours de grâce avant suppression. Tu recevras un email de confirmation.',
        )
        setOpen(false)
        setConfirmText('')
      } catch {
        toast.error('Erreur réseau. Réessaie dans quelques instants.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-3 px-4 py-2.5 min-h-[44px] w-full text-left hover:bg-[#FF3B30]/[0.04] active:bg-[#FF3B30]/[0.08] transition-colors cursor-pointer"
        >
          <span
            aria-hidden
            className="size-7 rounded-[7px] flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(15,20,25,0.12)] bg-[#FF3B30]"
          >
            <Trash2 className="size-[15px] text-white" strokeWidth={2.25} />
          </span>
          <span className="flex-1 text-[15px] font-normal text-[#FF3B30]">
            Supprimer mon compte (RGPD)
          </span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer définitivement mon compte ?</DialogTitle>
          <DialogDescription>
            Conformément au RGPD, tes données seront conservées 90 jours en grâce avant suppression
            irréversible. Tes factures restent conservées 10 ans (obligation comptable L.123-22 du
            Code de commerce).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-[#0F1419]">
            Pour confirmer, tape{' '}
            <span className="font-mono font-semibold text-[#FF3B30]">SUPPRIMER</span> :
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="SUPPRIMER"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={!canConfirm || pending}
            className="bg-[#FF3B30] hover:bg-[#FF3B30]/90 text-white"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Confirmer la suppression
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
