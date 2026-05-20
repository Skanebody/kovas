'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface VerifyResponseOk {
  ok: true
  redirect: string
}
interface VerifyResponseError {
  ok: false
  error: string
  attempts_remaining?: number
  retry_after_seconds?: number
}
type VerifyResponse = VerifyResponseOk | VerifyResponseError

export function VerifyTwoFaForm() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = (await response.json()) as VerifyResponse

      if (data.ok) {
        router.replace(data.redirect)
        router.refresh()
        return
      }

      setError(data.error)
      if (typeof data.attempts_remaining === 'number') {
        setAttemptsRemaining(data.attempts_remaining)
      }
      setToken('')
    } catch {
      setError('Erreur réseau. Réessayez.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="token">Code à 6 chiffres</Label>
        <Input
          id="token"
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          minLength={6}
          required
          autoFocus
          placeholder="123 456"
          value={token}
          onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))}
          className="text-center font-mono text-lg tracking-[0.4em]"
        />
      </div>

      {error && (
        <p className="text-sm text-accent-red" role="alert">
          {error}
          {attemptsRemaining !== null && attemptsRemaining > 0
            ? ` (${attemptsRemaining} tentative${attemptsRemaining > 1 ? 's' : ''} restante${attemptsRemaining > 1 ? 's' : ''})`
            : null}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={pending || token.length !== 6}>
        {pending && <Loader2 className="animate-spin" />}
        Vérifier
      </Button>
    </form>
  )
}
