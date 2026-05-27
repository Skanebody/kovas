/**
 * Cancellation — Step 2 : Alternatives à la résiliation.
 *
 * Client component (3 cards avec actions).
 *
 * Propose 3 alternatives :
 *  - Pause temporaire (1 ou 3 mois) — gratuit
 *  - Réduction -50% sur 3 mois (coupon RETENTION50)
 *  - Downgrade vers forfait moins cher (selon plan_code courant)
 *
 * Conforme décret n°2023-417 : alternatives PROPOSÉES, jamais imposées.
 * Bouton "Non merci, je résilie" toujours visible et accessible (1 clic vers step3).
 */

'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Percent,
  Sparkles,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export type DowngradeTarget = {
  planCode: string
  label: string
  priceMonthlyCents: number
} | null

interface Step2Props {
  cancellationId: string
  currentPlanLabel: string
  downgradeTarget: DowngradeTarget
}

type AlternativeKind = 'pause' | 'discount' | 'downgrade'

interface AlternativeResponse {
  ok: boolean
  redirect?: string
  error?: string
}

export function CancellationStep2({
  cancellationId,
  currentPlanLabel,
  downgradeTarget,
}: Step2Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingKind, setPendingKind] = useState<AlternativeKind | null>(null)
  const [pauseMonths, setPauseMonths] = useState<1 | 3>(1)
  const [error, setError] = useState<string | null>(null)

  function accept(kind: AlternativeKind, extra?: Record<string, unknown>) {
    setError(null)
    setPendingKind(kind)
    startTransition(async () => {
      try {
        const res = await fetch('/api/cancellation/accept-alternative', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cancellationId, type: kind, ...extra }),
        })
        const data = (await res.json().catch(() => ({}))) as AlternativeResponse
        if (!res.ok || !data.ok) {
          setError(data.error ?? `Erreur (${res.status})`)
          setPendingKind(null)
          return
        }
        router.push(data.redirect ?? '/dashboard/account')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur réseau')
        setPendingKind(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Avant de partir, <span className="font-serif italic font-normal">trois options</span>
        </h1>
        <p className="text-sm text-ink-mute">
          Choisissez celle qui vous convient — ou continuez vers la résiliation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* PAUSE */}
        <Card variant="opaque" padding="default" className="space-y-4 flex flex-col">
          <div className="space-y-2">
            <Clock className="size-6 text-navy" />
            <h2 className="text-base font-bold">Mettre en pause</h2>
            <p className="text-xs text-ink-mute">
              Gardez votre compte et vos données, sans paiement pendant 1 ou 3 mois.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-ink-mute font-semibold">
              Durée
            </p>
            <div className="flex gap-2">
              {[1, 3].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPauseMonths(m as 1 | 3)}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors',
                    pauseMonths === m
                      ? 'border-navy bg-navy/5 text-navy'
                      : 'border-rule bg-paper text-ink-mute hover:border-navy/40',
                  )}
                >
                  {m} mois
                </button>
              ))}
            </div>
          </div>
          <div className="font-serif italic text-3xl text-ink leading-none">0€</div>
          <Button
            type="button"
            variant="default"
            className="mt-auto"
            disabled={isPending}
            onClick={() => accept('pause', { pauseMonths })}
          >
            {pendingKind === 'pause' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Mettre en pause {pauseMonths} mois
          </Button>
        </Card>

        {/* DISCOUNT */}
        <Card variant="opaque" padding="default" className="space-y-4 flex flex-col">
          <div className="space-y-2">
            <Percent className="size-6 text-navy" />
            <h2 className="text-base font-bold">Réduire de 50%</h2>
            <p className="text-xs text-ink-mute">
              -50% appliqué pendant 3 mois sur votre formule {currentPlanLabel} actuelle.
            </p>
          </div>
          <ul className="space-y-1 text-[11px] text-ink-mute">
            <li>• Aucun engagement supplémentaire</li>
            <li>• Toutes les fonctionnalités conservées</li>
            <li>• Reprise tarif standard au 4ᵉ mois</li>
          </ul>
          <div className="font-serif italic text-3xl text-ink leading-none">-50%</div>
          <Button
            type="button"
            variant="default"
            className="mt-auto"
            disabled={isPending}
            onClick={() => accept('discount')}
          >
            {pendingKind === 'discount' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Appliquer -50%
          </Button>
        </Card>

        {/* DOWNGRADE */}
        <Card variant="opaque" padding="default" className="space-y-4 flex flex-col">
          <div className="space-y-2">
            <ArrowDown className="size-6 text-navy" />
            <h2 className="text-base font-bold">Forfait plus léger</h2>
            <p className="text-xs text-ink-mute">
              {downgradeTarget
                ? `Passez à ${downgradeTarget.label} pour ${(downgradeTarget.priceMonthlyCents / 100).toFixed(0)}€ HT/mois.`
                : 'Aucun forfait inférieur disponible pour votre formule actuelle.'}
            </p>
          </div>
          {downgradeTarget && (
            <ul className="space-y-1 text-[11px] text-ink-mute">
              <li>• Application au prochain cycle</li>
              <li>• Aucune perte de données</li>
              <li>• Réversible à tout moment</li>
            </ul>
          )}
          {downgradeTarget && (
            <div className="font-serif italic text-3xl text-ink leading-none">
              {(downgradeTarget.priceMonthlyCents / 100).toFixed(0)}€
            </div>
          )}
          <Button
            type="button"
            variant="default"
            className="mt-auto"
            disabled={isPending || !downgradeTarget}
            onClick={() =>
              downgradeTarget && accept('downgrade', { targetPlanCode: downgradeTarget.planCode })
            }
          >
            {pendingKind === 'downgrade' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowDown className="size-4" />
            )}
            {downgradeTarget ? `Passer en ${downgradeTarget.label}` : 'Indisponible'}
          </Button>
        </Card>
      </div>

      {error && (
        <p className="text-xs text-accent-red bg-accent-red/5 border border-accent-red/20 rounded-md p-3">
          {error}
        </p>
      )}

      <div className="border-t border-rule pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-xs text-ink-mute">Aucune de ces options ne vous convient ?</p>
        <Button asChild variant="ghost" size="sm" className="text-ink-mute">
          <a href="/dashboard/account/cancellation?step=3">
            Non merci, je résilie <ArrowRight className="size-4" />
          </a>
        </Button>
      </div>
    </div>
  )
}
