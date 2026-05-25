'use client'

/**
 * Panneau d'actions admin destructives sur un user.
 *
 * Dropdown principal qui ouvre des dialogs spécifiques par action :
 *   - Suspendre / Réactiver (raison facultative)
 *   - Accorder crédit (montant + raison, confirmation > 100€)
 *   - Modifier caps IA (daily/monthly cents, null = défaut plan)
 *   - Changer plan (decouverte/standard/volume/founder/cabinet)
 *   - Envoyer email custom (subject + body)
 *
 * Toutes les actions appellent les routes /api/admin/users/[id]/<action>.
 * Sur succès → router.refresh() pour recharger les données server-side.
 */

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { UserDetail } from '@/lib/admin/users-types'
import { Banknote, Gauge, Mail, MoreHorizontal, Pause, Play, Wallet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

type DialogKey = null | 'suspend' | 'unsuspend' | 'credit' | 'cap' | 'upgrade' | 'email'

interface UserActionsPanelProps {
  user: UserDetail
}

interface ApiError {
  error?: string
  retry_with_confirmation?: boolean
  threshold_eur?: number
}

async function postJson<T = unknown>(
  url: string,
  body: Record<string, unknown>,
  method = 'POST',
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: ApiError }> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as ApiError
    return { ok: false, status: res.status, error: err }
  }
  const data = (await res.json().catch(() => ({}))) as T
  return { ok: true, data }
}

export function UserActionsPanel({ user }: UserActionsPanelProps) {
  const router = useRouter()
  const [open, setOpen] = useState<DialogKey>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Suspend / Unsuspend
  const [suspendReason, setSuspendReason] = useState('')

  // Credit
  const [creditAmount, setCreditAmount] = useState('')
  const [creditReason, setCreditReason] = useState('')
  const [creditConfirmLarge, setCreditConfirmLarge] = useState(false)

  // Cap IA
  const [capDailyCents, setCapDailyCents] = useState(
    user.organization?.ai_cap_daily_cents !== null &&
      user.organization?.ai_cap_daily_cents !== undefined
      ? String(user.organization.ai_cap_daily_cents)
      : '',
  )
  const [capMonthlyCents, setCapMonthlyCents] = useState(
    user.organization?.ai_cap_monthly_cents !== null &&
      user.organization?.ai_cap_monthly_cents !== undefined
      ? String(user.organization.ai_cap_monthly_cents)
      : '',
  )

  // Upgrade plan
  const [newPlan, setNewPlan] = useState(user.organization?.plan ?? 'decouverte')

  // Email
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')

  const close = () => {
    setOpen(null)
    setError(null)
    setCreditConfirmLarge(false)
  }

  const userId = user.user_id
  const suspended = Boolean(user.organization?.suspended_at)

  const onSuspend = () => {
    setError(null)
    startTransition(async () => {
      const res = await postJson(`/api/admin/users/${userId}/suspend`, { reason: suspendReason })
      if (!res.ok) {
        setError(res.error.error ?? `HTTP ${res.status}`)
        return
      }
      close()
      router.refresh()
    })
  }

  const onUnsuspend = () => {
    setError(null)
    startTransition(async () => {
      const res = await postJson(`/api/admin/users/${userId}/unsuspend`, {})
      if (!res.ok) {
        setError(res.error.error ?? `HTTP ${res.status}`)
        return
      }
      close()
      router.refresh()
    })
  }

  const onCredit = () => {
    setError(null)
    const amount = Number(creditAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Montant invalide')
      return
    }
    if (!creditReason.trim()) {
      setError('Raison obligatoire')
      return
    }
    startTransition(async () => {
      const res = await postJson(`/api/admin/users/${userId}/credit`, {
        amount_eur: amount,
        reason: creditReason.trim(),
        confirm_large: creditConfirmLarge,
      })
      if (!res.ok) {
        if (res.error.retry_with_confirmation) {
          setError(
            `Montant > ${res.error.threshold_eur ?? 100}€. Cochez la case de confirmation pour valider.`,
          )
          return
        }
        setError(res.error.error ?? `HTTP ${res.status}`)
        return
      }
      close()
      router.refresh()
    })
  }

  const onCap = () => {
    setError(null)
    const dailyParsed = capDailyCents === '' ? null : Number(capDailyCents)
    const monthlyParsed = capMonthlyCents === '' ? null : Number(capMonthlyCents)
    if (dailyParsed !== null && (!Number.isFinite(dailyParsed) || dailyParsed < 0)) {
      setError('Cap jour invalide')
      return
    }
    if (monthlyParsed !== null && (!Number.isFinite(monthlyParsed) || monthlyParsed < 0)) {
      setError('Cap mois invalide')
      return
    }
    startTransition(async () => {
      const res = await postJson(
        `/api/admin/users/${userId}/cap`,
        { ai_cap_daily_cents: dailyParsed, ai_cap_monthly_cents: monthlyParsed },
        'PATCH',
      )
      if (!res.ok) {
        setError(res.error.error ?? `HTTP ${res.status}`)
        return
      }
      close()
      router.refresh()
    })
  }

  const onUpgrade = () => {
    setError(null)
    startTransition(async () => {
      const res = await postJson(`/api/admin/users/${userId}/upgrade`, { new_plan: newPlan })
      if (!res.ok) {
        setError(res.error.error ?? `HTTP ${res.status}`)
        return
      }
      close()
      router.refresh()
    })
  }

  const onEmail = () => {
    setError(null)
    if (!emailSubject.trim() || !emailBody.trim()) {
      setError('Sujet et corps requis')
      return
    }
    startTransition(async () => {
      const res = await postJson(`/api/admin/users/${userId}/email`, {
        template: 'custom',
        subject: emailSubject.trim(),
        body: emailBody.trim(),
      })
      if (!res.ok) {
        setError(res.error.error ?? `HTTP ${res.status}`)
        return
      }
      close()
      router.refresh()
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size="default" aria-label="Actions admin">
            Actions
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[220px]">
          {suspended ? (
            <DropdownMenuItem onSelect={() => setOpen('unsuspend')}>
              <Play className="size-3.5" aria-hidden />
              Réactiver l'organisation
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setOpen('suspend')}>
              <Pause className="size-3.5" aria-hidden />
              Suspendre l'organisation
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setOpen('credit')}>
            <Banknote className="size-3.5" aria-hidden />
            Accorder un crédit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpen('cap')}>
            <Gauge className="size-3.5" aria-hidden />
            Modifier les caps IA
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpen('upgrade')}>
            <Wallet className="size-3.5" aria-hidden />
            Changer le plan
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpen('email')}>
            <Mail className="size-3.5" aria-hidden />
            Envoyer un email
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog : Suspend */}
      <Dialog open={open === 'suspend'} onOpenChange={(v) => !v && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspendre l'organisation</DialogTitle>
            <DialogDescription>
              Bloque toutes les missions et exports de{' '}
              {user.organization?.name ?? 'cette organisation'}. Réversible à tout moment.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="Raison de la suspension (facultatif)"
            rows={3}
          />
          {error ? (
            <p className="text-[12px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={close} disabled={isPending}>
              Annuler
            </Button>
            <Button variant="destructive" size="sm" onClick={onSuspend} disabled={isPending}>
              {isPending ? 'Suspension…' : 'Suspendre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : Unsuspend */}
      <Dialog open={open === 'unsuspend'} onOpenChange={(v) => !v && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réactiver l'organisation</DialogTitle>
            <DialogDescription>
              {user.organization?.name ?? 'Cette organisation'} pourra à nouveau créer des missions
              et générer des exports.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-[12px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={close} disabled={isPending}>
              Annuler
            </Button>
            <Button variant="default" size="sm" onClick={onUnsuspend} disabled={isPending}>
              {isPending ? 'Réactivation…' : 'Réactiver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : Credit */}
      <Dialog open={open === 'credit'} onOpenChange={(v) => !v && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accorder un crédit</DialogTitle>
            <DialogDescription>
              Geste commercial · sera reflété sur la prochaine facture (V2 Stripe). V1 : tracé dans
              l'audit log uniquement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label
                htmlFor="credit-amount"
                className="text-[11px] font-mono uppercase tracking-wider text-ink-mute"
              >
                Montant (€)
              </label>
              <Input
                id="credit-amount"
                type="number"
                min="0"
                step="0.01"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="29.00"
                className="mt-1"
              />
            </div>
            <div>
              <label
                htmlFor="credit-reason"
                className="text-[11px] font-mono uppercase tracking-wider text-ink-mute"
              >
                Raison
              </label>
              <Textarea
                id="credit-reason"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="Ex : Geste commercial suite incident…"
                rows={2}
                className="mt-1"
              />
            </div>
            {Number(creditAmount) > 100 ? (
              <label className="flex items-start gap-2 text-[12px] text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={creditConfirmLarge}
                  onChange={(e) => setCreditConfirmLarge(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Je confirme l'octroi d'un crédit supérieur à 100€ (montant inhabituel).</span>
              </label>
            ) : null}
          </div>
          {error ? (
            <p className="text-[12px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={close} disabled={isPending}>
              Annuler
            </Button>
            <Button variant="default" size="sm" onClick={onCredit} disabled={isPending}>
              {isPending ? 'Validation…' : 'Accorder le crédit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : Cap IA */}
      <Dialog open={open === 'cap'} onOpenChange={(v) => !v && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier les caps IA</DialogTitle>
            <DialogDescription>
              Valeurs en centimes (cents). Champ vide = défaut du plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label
                htmlFor="cap-daily"
                className="text-[11px] font-mono uppercase tracking-wider text-ink-mute"
              >
                Cap journalier (cents)
              </label>
              <Input
                id="cap-daily"
                type="number"
                min="0"
                step="1"
                value={capDailyCents}
                onChange={(e) => setCapDailyCents(e.target.value)}
                placeholder="Ex 5000 = 50,00€"
                className="mt-1"
              />
            </div>
            <div>
              <label
                htmlFor="cap-monthly"
                className="text-[11px] font-mono uppercase tracking-wider text-ink-mute"
              >
                Cap mensuel (cents)
              </label>
              <Input
                id="cap-monthly"
                type="number"
                min="0"
                step="1"
                value={capMonthlyCents}
                onChange={(e) => setCapMonthlyCents(e.target.value)}
                placeholder="Ex 100000 = 1000,00€"
                className="mt-1"
              />
            </div>
          </div>
          {error ? (
            <p className="text-[12px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={close} disabled={isPending}>
              Annuler
            </Button>
            <Button variant="default" size="sm" onClick={onCap} disabled={isPending}>
              {isPending ? 'Enregistrement…' : 'Mettre à jour'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : Upgrade plan */}
      <Dialog open={open === 'upgrade'} onOpenChange={(v) => !v && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer le plan</DialogTitle>
            <DialogDescription>
              Modifie le plan de l'organisation primaire. V1 : pas d'ajustement Stripe automatique.
            </DialogDescription>
          </DialogHeader>
          <Select value={newPlan} onChange={(e) => setNewPlan(e.target.value)}>
            <option value="decouverte">Solo (29€/mo)</option>
            <option value="standard">Pro (79€/mo)</option>
            <option value="volume">Cabinet (199€/mo)</option>
            <option value="founder">Founder (49€/mo à vie)</option>
            <option value="cabinet">Cabinet+ (499€/mo)</option>
          </Select>
          {error ? (
            <p className="text-[12px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={close} disabled={isPending}>
              Annuler
            </Button>
            <Button variant="default" size="sm" onClick={onUpgrade} disabled={isPending}>
              {isPending ? 'Application…' : 'Appliquer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : Email custom */}
      <Dialog open={open === 'email'} onOpenChange={(v) => !v && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer un email</DialogTitle>
            <DialogDescription>
              Email custom envoyé à {user.email} via Resend (stub V1 si RESEND_API_KEY absente).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Sujet"
              aria-label="Sujet"
            />
            <Textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Corps du message…"
              rows={6}
              aria-label="Corps du message"
            />
          </div>
          {error ? (
            <p className="text-[12px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={close} disabled={isPending}>
              Annuler
            </Button>
            <Button variant="default" size="sm" onClick={onEmail} disabled={isPending}>
              {isPending ? 'Envoi…' : 'Envoyer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
