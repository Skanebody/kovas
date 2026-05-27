'use client'

/**
 * KOVAS — <ReportLockToggle>
 *
 * Composant client de la fiche mission : verrou de remise du rapport tant que
 * le paiement n'est pas encaissé (lever du verrou possible manuellement pour
 * "client de confiance" avec justification audit).
 *
 * Actions :
 *   - Switch ON/OFF (PATCH /api/payment-lock/[missionId])
 *   - Envoyer le lien de paiement (POST /api/payment-lock/send-link)
 *   - Débloquer manuellement → modal raison + confirmation (POST override)
 *   - Historique des relances (table compact)
 *
 * Authority : CLAUDE.md §3 — UX anti-friction paiement.
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, History, KeySquare, Loader2, Lock, Send, Unlock } from 'lucide-react'
import { useState } from 'react'

export interface PaymentLockReminder {
  id: string
  sentAt: string // ISO
  channel: 'email' | 'sms'
  recipient: string
  status: 'sent' | 'opened' | 'clicked' | 'failed'
}

export interface PaymentLockState {
  locked: boolean
  amountDueCents: number
  paymentReceivedAt: string | null
  override: { active: boolean; reason: string | null; by: string | null } | null
  reminders: PaymentLockReminder[]
}

export interface ReportLockToggleProps {
  missionId: string
  currentState: PaymentLockState
  /** Notifie le parent après mise à jour (refresh fiche mission). */
  onChange?: (state: PaymentLockState) => void
  disabled?: boolean
  className?: string
}

type Status = 'paid' | 'locked' | 'override'

function deriveStatus(state: PaymentLockState): Status {
  if (state.paymentReceivedAt) return 'paid'
  if (state.override?.active) return 'override'
  return 'locked'
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ReportLockToggle({
  missionId,
  currentState,
  onChange,
  disabled,
  className,
}: ReportLockToggleProps) {
  const [state, setState] = useState<PaymentLockState>(currentState)
  const [pending, setPending] = useState<'toggle' | 'send' | 'override' | null>(null)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const status = deriveStatus(state)

  const updateState = (next: PaymentLockState) => {
    setState(next)
    onChange?.(next)
  }

  const handleToggle = async () => {
    if (disabled || pending) return
    setPending('toggle')
    setError(null)
    try {
      const res = await fetch(`/api/payment-lock/${missionId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locked: !state.locked }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const next = (await res.json()) as PaymentLockState
      updateState(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erreur inconnue')
    } finally {
      setPending(null)
    }
  }

  const handleSendLink = async () => {
    if (disabled || pending) return
    setPending('send')
    setError(null)
    try {
      const res = await fetch('/api/payment-lock/send-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ missionId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const next = (await res.json()) as PaymentLockState
      updateState(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erreur inconnue')
    } finally {
      setPending(null)
    }
  }

  const handleOverride = async () => {
    if (disabled || pending) return
    if (overrideReason.trim().length < 10) return
    setPending('override')
    setError(null)
    try {
      const res = await fetch(`/api/payment-lock/${missionId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ override: true, reason: overrideReason.trim() }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const next = (await res.json()) as PaymentLockState
      updateState(next)
      setShowOverrideModal(false)
      setOverrideReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erreur inconnue')
    } finally {
      setPending(null)
    }
  }

  const StatusIcon = status === 'paid' ? CheckCircle2 : status === 'override' ? Unlock : Lock

  return (
    <Card variant="opaque" padding="sm" className={className}>
      <CardHeader className="p-0 pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <StatusIcon className="size-4 text-ink-mute" />
            Verrou de remise du rapport
          </CardTitle>
          {status === 'paid' ? (
            <Badge variant="green">Payé</Badge>
          ) : status === 'override' ? (
            <Badge variant="amber">Débloqué manuellement</Badge>
          ) : state.locked ? (
            <Badge variant="default">Verrouillé</Badge>
          ) : (
            <Badge variant="muted">Désactivé</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[13px] text-ink-soft">
            Montant dû :{' '}
            <span className="font-semibold text-ink">{formatCents(state.amountDueCents)}</span>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <span className="text-[12px] text-ink-mute">Activer le verrou</span>
            <span
              role="switch"
              aria-checked={state.locked}
              tabIndex={0}
              onClick={handleToggle}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  void handleToggle()
                }
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-pill transition-colors ${
                state.locked ? 'bg-chartreuse' : 'bg-cream-deep'
              } ${disabled || pending === 'toggle' ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <span
                className={`inline-block size-4 rounded-full bg-paper transition-transform shadow-sm ${
                  state.locked ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </span>
          </label>
        </div>

        {status === 'override' && state.override?.reason ? (
          <div className="rounded-md border border-amber/20 bg-orange-mist/40 px-3 py-2 text-[12px] text-ink-soft">
            <strong className="font-semibold">Justification : </strong>
            {state.override.reason}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="accent"
            size="sm"
            onClick={handleSendLink}
            disabled={disabled || pending !== null || status === 'paid'}
          >
            {pending === 'send' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            Envoyer le lien de paiement
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowOverrideModal(true)}
            disabled={disabled || pending !== null || status !== 'locked'}
          >
            <KeySquare className="size-3.5" />
            Débloquer manuellement
          </Button>
        </div>

        {state.reminders.length > 0 ? (
          <div className="mt-2">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-mute font-mono">
              <History className="size-3" /> Historique des relances
            </p>
            <ul className="divide-y divide-rule/60 border border-rule/60 rounded-md overflow-hidden">
              {state.reminders.slice(0, 5).map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-1.5 text-[12px] bg-paper"
                >
                  <span className="font-mono text-ink-mute">{formatDate(r.sentAt)}</span>
                  <span className="truncate text-ink-soft">{r.recipient}</span>
                  <Badge
                    variant={
                      r.status === 'clicked' ? 'green' : r.status === 'failed' ? 'red' : 'muted'
                    }
                  >
                    {r.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? <p className="text-[12px] text-accent-red">{error}</p> : null}
      </CardContent>

      <Dialog
        open={showOverrideModal}
        onOpenChange={(open) => {
          setShowOverrideModal(open)
          if (!open) setOverrideReason('')
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Débloquer manuellement</DialogTitle>
            <DialogDescription>
              Vous allez remettre le rapport avant encaissement. Cette action est tracée dans
              l&apos;audit (RGPD §10).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Raison (ex: client de confiance, paiement reçu hors plateforme)"
            rows={4}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowOverrideModal(false)}
              disabled={pending === 'override'}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleOverride}
              disabled={overrideReason.trim().length < 10 || pending === 'override'}
            >
              {pending === 'override' ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Confirmer le déblocage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
