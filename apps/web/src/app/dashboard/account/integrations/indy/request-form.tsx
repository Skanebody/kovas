'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface Props {
  defaultEmail: string
}

/**
 * Formulaire de demande d'accès API Indy.
 * Server action via fetch — création d'une ligne `connector_api_access_requests`.
 */
export function RequestApiAccessForm({ defaultEmail }: Props) {
  const [email, setEmail] = useState(defaultEmail)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/connectors/api-access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'indy', email, message }),
      })
      const data = (await res.json()) as { ok: boolean; message?: string }
      if (!data.ok) {
        setError(data.message ?? 'Erreur lors de la demande.')
      } else {
        setSubmitted(true)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-rule glass-opaque p-5">
        <p className="text-sm text-ink">
          Demande enregistrée. Nous vous recontactons dès qu'Indy nous ouvre l'accès.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-rule glass-opaque p-5 space-y-4">
      <div className="space-y-2">
        <h3 className="font-bold text-base text-ink">Demander l'accès API</h3>
        <p className="text-xs text-ink-mute leading-relaxed">
          Nous transmettrons votre demande à Indy et activerons votre connecteur dès qu'il sera
          disponible.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-ink-mute uppercase tracking-wider">
          Email de contact
        </span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-ink-mute uppercase tracking-wider">
          Message (optionnel)
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Volume de factures mensuel, contexte d'usage…"
          className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
        />
      </label>

      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Envoi…' : "Demander l'accès"}
      </Button>
    </form>
  )
}
