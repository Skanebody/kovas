'use client'

import { Check, Loader2, MailCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface VerifyEmailFormProps {
  trackingToken: string
}

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string; attemptsRemaining: number | null }
  | { kind: 'expired' }
  | { kind: 'success'; recipientCount: number; trackingToken: string }

const RESEND_COOLDOWN_SEC = 60

export function VerifyEmailForm({ trackingToken }: VerifyEmailFormProps) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendStatus, setResendStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'sending' }
    | { kind: 'sent' }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Décompte cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = code.trim()
      if (!/^\d{6}$/.test(trimmed)) {
        setState({
          kind: 'error',
          message: 'Le code doit comporter exactement 6 chiffres.',
          attemptsRemaining: null,
        })
        return
      }

      setState({ kind: 'submitting' })
      try {
        const res = await fetch('/api/quote-requests/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackingToken, code: trimmed }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          verified?: boolean
          error?: string
          recipientCount?: number
          attemptsRemaining?: number
          expired?: boolean
          trackingToken?: string
        }

        if (res.status === 410 || data.expired) {
          setState({ kind: 'expired' })
          return
        }
        if (!res.ok || !data.verified) {
          setState({
            kind: 'error',
            message: data.error ?? 'Code incorrect.',
            attemptsRemaining: data.attemptsRemaining ?? null,
          })
          return
        }
        setState({
          kind: 'success',
          recipientCount: data.recipientCount ?? 0,
          trackingToken: data.trackingToken ?? trackingToken,
        })
        // Redirect après 2.5s
        setTimeout(() => {
          router.push(`/mes-demandes/${data.trackingToken ?? trackingToken}`)
        }, 2500)
      } catch {
        setState({
          kind: 'error',
          message: 'Erreur réseau. Réessayez.',
          attemptsRemaining: null,
        })
      }
    },
    [code, trackingToken, router],
  )

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return
    setResendStatus({ kind: 'sending' })
    try {
      const res = await fetch('/api/quote-requests/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingToken }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        message?: string
        error?: string
      }
      if (!res.ok) {
        setResendStatus({
          kind: 'error',
          message: data.error ?? 'Échec de l’envoi.',
        })
        return
      }
      setResendStatus({ kind: 'sent' })
      setResendCooldown(RESEND_COOLDOWN_SEC)
      // Reset state if was expired
      setState({ kind: 'idle' })
    } catch {
      setResendStatus({ kind: 'error', message: 'Erreur réseau.' })
    }
  }, [resendCooldown, trackingToken])

  if (state.kind === 'success') {
    return (
      <Card variant="opaque" padding="lg" className="text-center">
        <div className="mx-auto size-14 rounded-full bg-pastel-lime flex items-center justify-center mb-4">
          <Check className="size-7 text-ink" aria-hidden />
        </div>
        <h1 className="text-[22px] font-bold text-ink mb-2">Demande confirmée</h1>
        <p className="text-[14px] text-ink-mute leading-relaxed mb-6">
          Votre demande a bien été transmise{' '}
          {state.recipientCount > 0 ? `à ${state.recipientCount} diagnostiqueurs` : ''}.
          Vous recevrez leurs réponses sous 24-48 heures.
        </p>
        <p className="text-[12px] text-ink-faint inline-flex items-center gap-2">
          <Loader2 className="size-3 animate-spin" aria-hidden />
          Redirection vers votre suivi…
        </p>
      </Card>
    )
  }

  return (
    <Card variant="opaque" padding="lg">
      <div className="size-12 rounded-full bg-pastel-sky flex items-center justify-center mb-4">
        <MailCheck className="size-6 text-navy" aria-hidden />
      </div>
      <h1 className="text-[22px] font-bold text-ink mb-2">
        Confirmez votre demande
      </h1>
      <p className="text-[13px] text-ink-mute leading-relaxed mb-6">
        Nous venons de vous envoyer un code à 6 chiffres par email. Saisissez-le ci-dessous
        pour finaliser l’envoi de votre demande aux diagnostiqueurs.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="verification-code">Code de vérification</Label>
          <Input
            ref={inputRef}
            id="verification-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className="text-center text-[24px] tracking-[0.5em] font-mono"
            aria-invalid={state.kind === 'error'}
          />
        </div>

        {state.kind === 'error' && (
          <div className="rounded-md border border-danger/40 bg-danger/5 p-3 text-[12px] text-danger">
            {state.message}
            {state.attemptsRemaining !== null && state.attemptsRemaining > 0 && (
              <span className="block mt-1 text-ink-mute">
                {state.attemptsRemaining} tentative{state.attemptsRemaining > 1 ? 's' : ''} restante
                {state.attemptsRemaining > 1 ? 's' : ''}.
              </span>
            )}
          </div>
        )}

        {state.kind === 'expired' && (
          <div className="rounded-md border border-amber/40 bg-amber/10 p-3 text-[12px] text-ink-soft">
            Ce code a expiré. Demandez un nouveau code ci-dessous.
          </div>
        )}

        <Button
          type="submit"
          disabled={state.kind === 'submitting' || code.length !== 6}
          className="w-full"
          size="lg"
        >
          {state.kind === 'submitting' ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Vérification…
            </>
          ) : (
            'Confirmer ma demande'
          )}
        </Button>
      </form>

      <div className="mt-6 pt-6 border-t border-rule/40 text-center">
        <p className="text-[12px] text-ink-mute mb-2">
          Vous n’avez pas reçu le code ?
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown > 0 || resendStatus.kind === 'sending'}
          className="text-[12px] font-medium text-navy underline disabled:text-ink-faint disabled:no-underline"
        >
          {resendStatus.kind === 'sending'
            ? 'Envoi…'
            : resendCooldown > 0
              ? `Renvoyer un code dans ${resendCooldown}s`
              : 'Renvoyer un code'}
        </button>
        {resendStatus.kind === 'sent' && (
          <p className="mt-2 text-[11px] text-success">Un nouveau code vous a été envoyé.</p>
        )}
        {resendStatus.kind === 'error' && (
          <p className="mt-2 text-[11px] text-danger">{resendStatus.message}</p>
        )}
      </div>
    </Card>
  )
}
