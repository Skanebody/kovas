'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ScanQuota } from '@/lib/documents/types'
import { ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'

interface ScanQuotaLimitModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quota: ScanQuota | null
}

/**
 * Modal affiché quand le user tente un scan alors que le quota mensuel est épuisé.
 * Plan Découverte : 20 scans/mois → CTA upgrade Standard.
 */
export function ScanQuotaLimitModal({ open, onOpenChange, quota }: ScanQuotaLimitModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif italic font-normal text-2xl text-ink">
            Limite de scans atteinte
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-mute">
            Vous avez utilisé l'intégralité de vos scans documents ce mois-ci
            {quota ? ` (${quota.used}/${quota.included})` : null}. Passez au plan supérieur pour
            scanner sans limite.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 rounded-md bg-sage-alt/60 p-4 text-sm">
          <p className="flex items-start gap-2 text-ink">
            <Sparkles className="size-4 text-chartreuse-deep shrink-0 mt-0.5" aria-hidden />
            <span>
              Le plan <strong>Standard</strong> inclut <strong>60 missions</strong> et
              <strong> 200 scans documents</strong> mensuels, avec extraction Vision IA illimitée
              sur 8 diagnostics.
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button asChild variant="accent" size="lg">
            <Link href="/dashboard/account#subscription">
              Passer au plan Standard
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Plus tard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
