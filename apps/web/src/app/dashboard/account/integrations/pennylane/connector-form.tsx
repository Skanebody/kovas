'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { AlertCircle, CheckCircle2, KeyRound, Loader2, PlugZap, Trash2 } from 'lucide-react'
import { useActionState, useEffect, useState, useTransition } from 'react'
import {
  type ConnectorFormState,
  deactivateConnectorAction,
  deleteConnectorAction,
  saveConnectorAction,
} from './actions'

interface ConnectorFormProps {
  initial: {
    status: 'inactive' | 'active' | 'error' | null
    tokenMasked: string | null
    lastTestAt: string | null
    lastTestStatus: 'success' | 'failure' | null
    lastTestError: string | null
    lastSyncAt: string | null
  }
}

type TestState = {
  state: 'idle' | 'running' | 'success' | 'error'
  message?: string
}

export function ConnectorForm({ initial }: ConnectorFormProps) {
  const [saveState, saveAction, savePending] = useActionState<ConnectorFormState, FormData>(
    saveConnectorAction,
    undefined,
  )
  const [tokenDraft, setTokenDraft] = useState('')
  const [testState, setTestState] = useState<TestState>({ state: 'idle' })
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (saveState?.success) toast.success(saveState.message ?? 'Enregistré.')
    else if (saveState?.error) toast.error(saveState.error)
  }, [saveState])

  const isActive = initial.status === 'active'

  async function handleTest() {
    if (tokenDraft.trim().length < 10) {
      toast.error('Saisissez d’abord un token Pennylane valide.')
      return
    }
    setTestState({ state: 'running' })
    try {
      const res = await fetch('/api/integrations/pennylane/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiToken: tokenDraft.trim() }),
      })
      const data: { ok: boolean; message?: string } = await res.json()
      if (data.ok) {
        setTestState({ state: 'success', message: data.message ?? 'Connexion réussie.' })
      } else {
        setTestState({ state: 'error', message: data.message ?? 'Échec de connexion.' })
      }
    } catch (err) {
      setTestState({
        state: 'error',
        message: err instanceof Error ? err.message : 'Erreur réseau.',
      })
    }
  }

  async function handleDeactivate() {
    startTransition(async () => {
      const res = await deactivateConnectorAction()
      if (res?.error) toast.error(res.error)
      else toast.success(res?.message ?? 'Désactivé.')
    })
  }

  async function handleDelete() {
    if (!confirm('Supprimer définitivement la configuration Pennylane ?')) return
    startTransition(async () => {
      const res = await deleteConnectorAction()
      if (res?.error) toast.error(res.error)
      else toast.success(res?.message ?? 'Supprimé.')
    })
  }

  return (
    <div className="space-y-6">
      {/* Statut actuel */}
      <div className="rounded-xl border border-[#0F1419]/[0.08] bg-paper p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <PlugZap className="size-4 text-[#0F1419]/72" />
            <span className="text-sm font-semibold text-[#0F1419]">Statut</span>
          </div>
          <Badge variant={isActive ? 'green' : 'muted'}>
            {isActive ? 'Actif' : initial.status === 'error' ? 'Erreur' : 'Non configuré'}
          </Badge>
        </div>
        {initial.tokenMasked ? (
          <p className="text-xs text-[#0F1419]/72">
            Token enregistré :{' '}
            <span className="font-mono text-[#0F1419]">{initial.tokenMasked}</span>
          </p>
        ) : (
          <p className="text-xs text-[#0F1419]/72">
            Aucun token enregistré. Saisis le token Pennylane de ton compte ci-dessous.
          </p>
        )}
        {initial.lastSyncAt ? (
          <p className="text-[11px] text-[#0F1419]/55">
            Dernière synchronisation : {new Date(initial.lastSyncAt).toLocaleString('fr-FR')}
          </p>
        ) : null}
      </div>

      {/* Formulaire token + test */}
      <form action={saveAction} className="space-y-4">
        <FormField
          label="Token API Pennylane"
          htmlFor="apiToken"
          hint="Récupérable dans Pennylane → Paramètres → API → Générer un token. Stocké chiffré AES-256-GCM."
          required
        >
          <div className="flex gap-2 items-start">
            <div className="relative flex-1">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#0F1419]/55" />
              <Input
                id="apiToken"
                name="apiToken"
                type="password"
                required
                minLength={10}
                maxLength={500}
                placeholder="pl_live_xxx…"
                autoComplete="off"
                value={tokenDraft}
                onChange={(e) => setTokenDraft(e.target.value)}
                className="pl-9 font-mono text-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleTest}
              disabled={testState.state === 'running' || tokenDraft.trim().length < 10}
            >
              {testState.state === 'running' && <Loader2 className="size-4 animate-spin" />}
              Tester
            </Button>
          </div>
        </FormField>

        {testState.state === 'success' && (
          <div className="flex items-start gap-2 rounded-md border border-[#34C759]/30 bg-[#34C759]/5 p-3 text-xs">
            <CheckCircle2 className="size-4 text-[#34C759] shrink-0 mt-0.5" />
            <span>{testState.message}</span>
          </div>
        )}
        {testState.state === 'error' && (
          <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-xs">
            <AlertCircle className="size-4 text-danger shrink-0 mt-0.5" />
            <span>{testState.message}</span>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="activate"
            defaultChecked
            className="size-4 rounded border-[#0F1419]/[0.08]"
          />
          <span>Activer la synchronisation Pennylane immédiatement après enregistrement</span>
        </label>

        <div className="flex items-center justify-end gap-2 flex-wrap">
          {isActive && (
            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={handleDeactivate}
              disabled={isPending}
            >
              Désactiver
            </Button>
          )}
          {initial.tokenMasked && (
            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={handleDelete}
              disabled={isPending}
              className="text-danger hover:text-danger"
            >
              <Trash2 className="size-4" /> Supprimer
            </Button>
          )}
          <Button type="submit" disabled={savePending}>
            {savePending && <Loader2 className="size-4 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </form>
    </div>
  )
}
