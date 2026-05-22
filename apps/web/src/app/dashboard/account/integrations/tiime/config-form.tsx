'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface Props {
  initial: {
    workspaceId: string
    isActive: boolean
  }
}

/**
 * Formulaire de configuration Tiime (token + companyId).
 * Le token est jamais réaffiché — on demande à l'utilisateur de le saisir à
 * chaque modification (pattern security-first).
 */
export function TiimeConfigForm({ initial }: Props) {
  const [workspaceId, setWorkspaceId] = useState(initial.workspaceId)
  const [accessToken, setAccessToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/api/connectors/tiime/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, accessToken }),
      })
      const data = (await res.json()) as { ok: boolean; message?: string }
      if (!data.ok) {
        setError(data.message ?? 'Erreur lors de la configuration.')
      } else {
        setSuccess(true)
        setAccessToken('')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-rule glass-opaque p-5 space-y-4">
      <div className="space-y-2">
        <h3 className="font-bold text-base text-ink">
          {initial.isActive ? 'Mettre à jour le connecteur' : 'Activer le connecteur'}
        </h3>
        <p className="text-xs text-ink-mute leading-relaxed">
          Vos identifiants sont chiffrés et stockés de manière sécurisée. Le token API n'est jamais
          réaffiché par la suite.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-ink-mute uppercase tracking-wider">
          Identifiant société (companyId)
        </span>
        <input
          type="text"
          required
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          placeholder="ex : 12345"
          className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-ink-mute uppercase tracking-wider">
          Token API
        </span>
        <input
          type="password"
          required
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          autoComplete="off"
          placeholder={
            initial.isActive ? 'Saisissez à nouveau pour modifier' : 'Bearer token Tiime'
          }
          className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 font-mono"
        />
      </label>

      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      {success && <output className="text-xs text-info block">Connecteur Tiime configuré.</output>}

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  )
}
