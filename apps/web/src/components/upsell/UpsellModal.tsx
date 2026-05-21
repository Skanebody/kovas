'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowRight, Lock, Sparkles, X } from 'lucide-react'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { startTrialAction } from '@/lib/upsell/actions'
import { getUpsellEntry } from '@/lib/upsell/upsell-content'

export interface UpsellModalProps {
  target: string
  trigger?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Affiche un override de titre (ex: "Cette fonctionnalité fait partie de Pro"). */
  contextHeadline?: string
}

/**
 * Modale d'upsell standardisée. Présente la cible avec 3 bullets bénéfices
 * + CTA "Démarrer mon essai 14j" 1 clic (ou redirection checkout pour tier).
 *
 * Toujours présent : bouton "Plus tard" (ghost) pour fermer sans pression.
 * Une seule modale upsell visible à la fois (Radix Dialog gère le focus
 * trap nativement).
 */
export function UpsellModal({
  target,
  trigger,
  open,
  onOpenChange,
  contextHeadline,
}: UpsellModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const entry = getUpsellEntry(target)

  if (!entry) {
    return null
  }

  const handleStartTrial = () => {
    startTransition(async () => {
      const res = await startTrialAction(target, trigger)
      if (res.error) {
        console.warn('[UpsellModal] startTrialAction failed', res.error)
        // Pas de toast intrusif : on garde la modale ouverte avec feedback discret
        return
      }
      onOpenChange(false)
      if (res.redirectTo) {
        router.push(res.redirectTo)
      } else {
        router.refresh()
      }
    })
  }

  const headline =
    contextHeadline ??
    (entry.kind === 'tier_upgrade'
      ? `Cette fonctionnalité fait partie du forfait ${entry.title.replace('Forfait ', '')}`
      : `Cette fonctionnalité fait partie du module ${entry.title}`)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-navy/30 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        />
        <DialogPrimitive.Content
          aria-describedby="upsell-modal-description"
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
            'border border-rule/80 glass-opaque shadow-glass-sm rounded-2xl',
            'p-6 outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          <div className="flex items-start gap-3 mb-5">
            <span
              aria-hidden
              className="size-14 shrink-0 rounded-lg bg-chartreuse/20 flex items-center justify-center"
            >
              <Sparkles className="size-6 text-[#0F1419]" />
            </span>
            <div className="flex-1 min-w-0">
              <DialogPrimitive.Title className="font-serif italic text-xl text-ink leading-tight">
                {headline}
              </DialogPrimitive.Title>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute mt-1">
                {entry.priceLabel} · {entry.trialLabel}
              </p>
            </div>
          </div>

          <DialogPrimitive.Description
            id="upsell-modal-description"
            className="text-[13px] text-ink-mute leading-relaxed mb-4"
          >
            {entry.description}
          </DialogPrimitive.Description>

          <ul className="space-y-2 mb-6">
            {entry.benefits.map((b) => (
              <li key={b} className="flex items-start gap-2 text-[13px] text-ink">
                <span aria-hidden className="text-ink-mute mt-0.5">→</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="ghost"
              size="default"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Plus tard
            </Button>
            <Button
              variant="accent"
              size="default"
              onClick={handleStartTrial}
              disabled={isPending}
            >
              {entry.ctaPrimary}
              <ArrowRight className="size-3.5" />
            </Button>
          </div>

          <DialogPrimitive.Close
            aria-label="Fermer"
            className={cn(
              'absolute right-4 top-4 rounded-sm opacity-70 transition-opacity',
              'hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30',
            )}
          >
            <X className="size-4" />
          </DialogPrimitive.Close>

          <div className="mt-4 pt-3 border-t border-rule/40 flex items-center justify-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute inline-flex items-center gap-1">
              <Lock className="size-3" aria-hidden />
              Activable / désactivable mensuellement
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
