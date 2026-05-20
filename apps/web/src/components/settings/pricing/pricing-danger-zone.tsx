/**
 * KOVAS — PricingDangerZone
 *
 * Permet de réappliquer un template (écrasement de la config diagnostics)
 * ou de tout effacer (POST median template + nettoyage côté user — ici on
 * réapplique median par sécurité car la config est obligatoire à l'usage).
 */

'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

interface PricingDangerZoneProps {
  appliedTemplate: string | null
}

export function PricingDangerZone({ appliedTemplate }: PricingDangerZoneProps) {
  const router = useRouter()
  const [templateId, setTemplateId] = useState<string>(appliedTemplate ?? 'median')
  const [pending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)

  function reapply() {
    startTransition(async () => {
      const res = await fetch(`/api/pricing/templates/${templateId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(error ?? 'Erreur réapplication template')
        return
      }
      toast.success('Template réappliqué — tes ajustements précédents sont écrasés')
      setConfirmOpen(false)
      router.refresh()
    })
  }

  return (
    <Card variant="opaque" padding="default" className="border-danger/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-accent-red">
          <AlertTriangle className="size-4" /> Zone sensible
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        <p className="text-sm text-ink-mute">
          Réappliquer un template écrase l'intégralité de ta grille tarifaire (diagnostics,
          modulations, déplacement, majorations). Tes packs custom sont conservés.
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px] space-y-1">
            <label htmlFor="reapply-template" className="block text-[11px] font-semibold text-ink">
              Template à réappliquer
            </label>
            <Select
              id="reapply-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="economique">Économique</option>
              <option value="median">Médian (recommandé)</option>
              <option value="premium">Premium</option>
            </Select>
          </div>
          {!confirmOpen ? (
            <Button variant="glass" size="sm" onClick={() => setConfirmOpen(true)}>
              <RotateCcw className="size-4 text-accent-red" />
              Réappliquer
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={reapply}
                disabled={pending}
                className="bg-accent-red hover:bg-accent-red/80"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                Confirmer
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
              >
                Annuler
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
