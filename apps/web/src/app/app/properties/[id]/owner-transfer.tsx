'use client'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ArrowRightLeft, Check, Loader2, User } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { transferPropertyOwnerAction } from '../actions'

interface OwnerTransferProps {
  propertyId: string
  currentOwner: { id: string; display_name: string } | null
  clients: { id: string; display_name: string }[]
}

/**
 * Section "Propriétaire" sur la fiche bien.
 *
 * - Affiche le propriétaire actuel (ou « non rattaché »)
 * - Permet de transférer à un autre client (changement de propriétaire)
 * - Dissociation possible (« — Aucun propriétaire — »)
 *
 * Sémantique : un bien peut changer de propriétaire. Pour V1, on écrase
 * `properties.client_id` (propriétaire actuel). L'historique des transferts
 * est prévu V1.5 (table d'audit ou metadata jsonb).
 */
export function OwnerTransfer({ propertyId, currentOwner, clients }: OwnerTransferProps) {
  const [editing, setEditing] = useState(false)
  const [newOwnerId, setNewOwnerId] = useState<string>(currentOwner?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await transferPropertyOwnerAction(propertyId, newOwnerId || null)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setEditing(false)
        setTimeout(() => setSuccess(false), 2500)
      }
    })
  }

  function handleCancel() {
    setNewOwnerId(currentOwner?.id ?? '')
    setEditing(false)
    setError(null)
  }

  // Filtre : exclure le propriétaire actuel du select (on ne se transfère pas à soi-même)
  const transferOptions = clients.filter((c) => c.id !== currentOwner?.id)

  return (
    <div className="space-y-3">
      {!editing ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <User className="size-4 text-ink-mute shrink-0" />
            {currentOwner ? (
              <Link
                href={`/app/clients/${currentOwner.id}`}
                className="font-medium text-ink hover:underline truncate"
              >
                {currentOwner.display_name}
              </Link>
            ) : (
              <span className="text-ink-mute italic">Aucun propriétaire rattaché</span>
            )}
            {success && (
              <span className="inline-flex items-center gap-1 text-xs text-accent-green font-medium">
                <Check className="size-3.5" /> Transféré
              </span>
            )}
          </div>
          <Button variant="glass" size="sm" onClick={() => setEditing(true)}>
            <ArrowRightLeft className="size-4" />{' '}
            {currentOwner ? 'Transférer / changer' : 'Lier un propriétaire'}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Select
            value={newOwnerId}
            onChange={(e) => setNewOwnerId(e.target.value)}
            disabled={pending}
          >
            <option value="">— Aucun propriétaire —</option>
            {currentOwner && (
              <option value={currentOwner.id}>{currentOwner.display_name} (actuel)</option>
            )}
            {transferOptions.length > 0 && (
              <optgroup label="Transférer à">
                {transferOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
          {error && (
            <p className={cn('text-xs text-accent-red')} role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] text-ink-mute">
              Le bien sera dorénavant rattaché à ce propriétaire pour les futurs dossiers. Pas de
              propriétaire dans la liste ?{' '}
              <Link href="/app/clients/new" className="underline hover:text-ink">
                Créer un client
              </Link>
              .
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={pending}>
                Annuler
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={handleSave}
                disabled={pending || newOwnerId === (currentOwner?.id ?? '')}
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Confirmer le transfert
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
