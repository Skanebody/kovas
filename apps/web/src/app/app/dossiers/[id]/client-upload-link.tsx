'use client'

import { Check, Copy, Link2, Loader2, X } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { generateClientUploadLinkAction, revokeClientUploadLinkAction } from './actions'

interface ClientUploadLinkProps {
  dossierId: string
  token: string | null
  expiresAt: string | null
}

export function ClientUploadLink({ dossierId, token, expiresAt }: ClientUploadLinkProps) {
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  const fullUrl = typeof window !== 'undefined' && token
    ? `${window.location.origin}/upload/${token}`
    : null

  const expired = expiresAt && new Date(expiresAt) < new Date()

  function copyUrl() {
    if (!fullUrl) return
    navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function generate() {
    startTransition(async () => {
      await generateClientUploadLinkAction(dossierId)
    })
  }

  function revoke() {
    if (!confirm('Révoquer le lien ? Le client ne pourra plus uploader.')) return
    startTransition(async () => {
      await revokeClientUploadLinkAction(dossierId)
    })
  }

  if (!token) {
    return (
      <div className="rounded-lg bg-sage-alt/60 p-4 space-y-3">
        <p className="text-sm text-ink-mute">
          Aucun lien d'upload actif. Générez-en un pour permettre au client d'envoyer factures
          énergie, plans, anciens DPE…
        </p>
        <Button size="sm" onClick={generate} disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
          Générer un lien
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-sage-alt/60 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="size-4 text-ink-mute" />
        <span className="text-sm font-semibold">Lien d'upload client</span>
        {expired ? (
          <Badge variant="red">Expiré</Badge>
        ) : (
          <Badge variant="green">
            Valide jusqu'au {expiresAt ? new Date(expiresAt).toLocaleDateString('fr-FR') : '—'}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md bg-paper border border-rule px-3 py-2 text-xs font-mono">
          {fullUrl ?? `/upload/${token}`}
        </code>
        <Button size="icon" variant="outline" onClick={copyUrl} aria-label="Copier le lien">
          {copied ? <Check className="size-4 text-accent-green" /> : <Copy className="size-4" />}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={revoke} disabled={isPending}>
          <X className="size-4" /> Révoquer
        </Button>
        <p className="text-xs text-ink-faint">
          Envoyez ce lien par email ou SMS à votre client.
        </p>
      </div>
    </div>
  )
}
