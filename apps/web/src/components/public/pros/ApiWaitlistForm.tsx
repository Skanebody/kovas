'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

type Status = 'idle' | 'submitting' | 'success' | 'error'

interface FormState {
  fullName: string
  email: string
  useCase: string
}

const INITIAL_STATE: FormState = { fullName: '', email: '', useCase: '' }

export function ApiWaitlistForm() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setStatus('submitting')
    setErrorMessage(null)

    try {
      const response = await fetch('/api/api-publique-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        setStatus('error')
        setErrorMessage(data.error ?? 'Une erreur est survenue. Merci de réessayer.')
        return
      }

      setStatus('success')
      setForm(INITIAL_STATE)
    } catch {
      setStatus('error')
      setErrorMessage('Connexion impossible. Merci de réessayer dans un instant.')
    }
  }

  if (status === 'success') {
    return (
      <output className="block space-y-3 text-center" aria-live="polite">
        <CheckCircle2 className="mx-auto size-9 text-chartreuse-deep" />
        <h2 className="text-xl font-semibold tracking-tight">Inscription confirmée</h2>
        <p className="text-ink-mute">
          Vous serez prévenu(e) en priorité lors de l&apos;ouverture des accès anticipés API.
        </p>
      </output>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold tracking-tight">
          Rejoindre la liste d&apos;attente API
        </h2>
        <p className="text-sm text-ink-mute">
          Accès anticipé prévu Phase 2 (M10+). Notification dès l&apos;ouverture.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nom complet</Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            value={form.fullName}
            onChange={(e) => updateField('fullName', e.target.value)}
            disabled={status === 'submitting'}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            disabled={status === 'submitting'}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="useCase">Usage prévu (facultatif)</Label>
        <textarea
          id="useCase"
          name="useCase"
          rows={3}
          value={form.useCase}
          onChange={(e) => updateField('useCase', e.target.value)}
          disabled={status === 'submitting'}
          placeholder="Intégration cabinet, outil interne, ETL comptable, etc."
          className="flex w-full rounded-md border border-rule bg-paper px-4 py-3 text-[13px] text-ink transition-all duration-fast ease-spring placeholder:text-ink-faint focus-visible:border-[1.5px] focus-visible:border-navy focus-visible:outline-none focus-visible:ring-[5px] focus-visible:ring-navy/10 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {status === 'error' && errorMessage && (
        <p role="alert" className="text-sm text-[#8B1414]">
          {errorMessage}
        </p>
      )}

      <div className="flex justify-center pt-2">
        <Button type="submit" size="lg" variant="accent" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Envoi…' : 'Rejoindre la liste'}
        </Button>
      </div>
    </form>
  )
}
