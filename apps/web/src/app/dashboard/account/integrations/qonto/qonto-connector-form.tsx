'use client'

import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Unlink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

type InitialState =
  | { connected: false }
  | {
      connected: true
      status: 'active' | 'inactive' | 'error'
      lastSyncAt: string | null
      lastError: string | null
    }

interface Props {
  initial: InitialState
}

export function QontoConnectorForm({ initial }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [resyncing, setResyncing] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [login, setLogin] = useState('')
  const [secret, setSecret] = useState('')

  async function handleConnect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/account/integrations/qonto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, secretKey: secret }),
      })
      const json = (await res.json()) as { ok?: boolean; legalName?: string; message?: string }
      if (!res.ok || !json.ok) {
        toast.error(json.message ?? 'Connexion Qonto refusée')
        return
      }
      toast.success(`Compte Qonto « ${json.legalName ?? 'Connecté'} » synchronisé`)
      setLogin('')
      setSecret('')
      router.refresh()
    } catch {
      toast.error('Erreur réseau vers Qonto')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResync() {
    setResyncing(true)
    try {
      const res = await fetch('/api/account/integrations/qonto/resync', { method: 'POST' })
      const json = (await res.json()) as { ok?: boolean; synced?: number; total?: number; lastError?: string }
      if (!res.ok || !json.ok) {
        toast.error(json.lastError ?? 'Resynchronisation échouée')
        return
      }
      toast.success(
        `${json.synced ?? 0} facture${(json.synced ?? 0) > 1 ? 's' : ''} synchronisée${(json.synced ?? 0) > 1 ? 's' : ''}`,
      )
      router.refresh()
    } finally {
      setResyncing(false)
    }
  }

  async function handleToggle(next: 'active' | 'inactive') {
    setToggling(true)
    try {
      const res = await fetch('/api/account/integrations/qonto', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        toast.error('Impossible de modifier le statut')
        return
      }
      toast.success(next === 'active' ? 'Connecteur réactivé' : 'Connecteur désactivé')
      router.refresh()
    } finally {
      setToggling(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Supprimer la connexion Qonto ? Le token chiffré sera effacé.')) return
    setToggling(true)
    try {
      const res = await fetch('/api/account/integrations/qonto', { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Suppression échouée')
        return
      }
      toast.success('Connecteur Qonto supprimé')
      router.refresh()
    } finally {
      setToggling(false)
    }
  }

  if (initial.connected) {
    const isActive = initial.status === 'active'
    const isError = initial.status === 'error'
    return (
      <div className="space-y-4">
        <div
          className={`flex items-start gap-3 rounded-lg border p-3 ${
            isError
              ? 'border-danger/30 bg-danger/5'
              : isActive
                ? 'border-accent-green/30 bg-accent-green/5'
                : 'border-rule bg-cream-deep/40'
          }`}
        >
          {isError ? (
            <AlertCircle className="size-5 mt-0.5 text-danger shrink-0" />
          ) : (
            <CheckCircle2
              className={`size-5 mt-0.5 shrink-0 ${isActive ? 'text-accent-green' : 'text-ink-mute'}`}
            />
          )}
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-sm font-medium text-ink">
              {isError
                ? 'Erreur de connexion Qonto'
                : isActive
                  ? 'Connecté à Qonto'
                  : 'Connecteur Qonto désactivé'}
            </p>
            <p className="text-xs text-ink-mute">
              {initial.lastSyncAt
                ? `Dernière synchronisation : ${new Date(initial.lastSyncAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}`
                : 'Aucune synchronisation effectuée pour le moment.'}
            </p>
            {initial.lastError && (
              <p className="text-xs text-danger font-mono break-all">{initial.lastError}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isActive && (
            <Button
              type="button"
              variant="accent"
              size="sm"
              onClick={handleResync}
              disabled={resyncing}
            >
              {resyncing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Resynchroniser tout
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleToggle(isActive ? 'inactive' : 'active')}
            disabled={toggling}
          >
            {toggling ? <Loader2 className="size-4 animate-spin" /> : null}
            {isActive ? 'Désactiver' : 'Réactiver'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            disabled={toggling}
          >
            <Unlink className="size-4" /> Supprimer la connexion
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleConnect} className="space-y-4">
      <FormField
        label="Identifiant API (login)"
        htmlFor="qonto_login"
        hint="Affiché dans Qonto → Paramètres → Intégrations → Clés API."
        required
      >
        <Input
          id="qonto_login"
          name="login"
          required
          autoComplete="off"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="kovas-1993-xxxx"
        />
      </FormField>

      <FormField
        label="Clé secrète"
        htmlFor="qonto_secret"
        hint="Stockée chiffrée AES-256-GCM. Visible une seule fois côté Qonto."
        required
      >
        <Input
          id="qonto_secret"
          name="secretKey"
          required
          autoComplete="off"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="••••••••••••"
        />
      </FormField>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" variant="accent" disabled={submitting || !login || !secret}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Tester et activer
        </Button>
        <p className="text-xs text-ink-mute">
          Un test de lecture sur votre organisation Qonto est effectué avant stockage.
        </p>
      </div>
    </form>
  )
}
