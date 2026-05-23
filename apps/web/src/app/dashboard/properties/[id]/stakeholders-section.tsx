'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { ArrowRightLeft, Loader2, UserPlus, Users } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useId, useState, useTransition } from 'react'
import {
  type AddStakeholderState,
  type DeclareReventeState,
  PROPERTY_ROLE_LABEL,
  type PropertyRelationshipRole,
  addPropertyStakeholderAction,
  declareReventeAction,
  endPropertyStakeholderAction,
} from './stakeholders-actions'

export interface StakeholderRelationship {
  id: string
  client_id: string
  client_name: string | null
  role: PropertyRelationshipRole
  is_current: boolean
  started_at: string
  ended_at: string | null
  ownership_share: number | null
}

interface PropertyStakeholdersSectionProps {
  propertyId: string
  relationships: ReadonlyArray<StakeholderRelationship>
  clients: ReadonlyArray<{ id: string; display_name: string }>
  ownershipHistory: ReadonlyArray<{
    id: string
    transaction_date: string
    previous_owner_name: string | null
    new_owner_name: string | null
    transaction_amount_eur: number | null
  }>
}

const ROLES_LIST: PropertyRelationshipRole[] = [
  'owner',
  'co_owner',
  'tenant',
  'seller',
  'buyer',
  'property_manager',
  'syndic',
  'notary',
  'agency',
]

/**
 * Chantier C + D (FIX-KK §C, §D) — Section "Propriétaires et parties prenantes".
 */
export function PropertyStakeholdersSection({
  propertyId,
  relationships,
  clients,
  ownershipHistory,
}: PropertyStakeholdersSectionProps) {
  const [openAdd, setOpenAdd] = useState(false)
  const [openRevente, setOpenRevente] = useState(false)

  const current = relationships.filter((r) => r.is_current)
  const past = relationships.filter((r) => !r.is_current)

  return (
    <Card variant="flat" padding="default" className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <Users className="size-4 text-ink-mute" /> Propriétaires et parties prenantes
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">
          {current.length} actif·s · {past.length} historique·s
        </p>
      </div>

      {current.length === 0 ? (
        <p className="rounded-md border border-dashed border-rule/60 bg-cream-deep/30 px-3 py-3 text-[13px] text-ink-mute">
          Aucune partie prenante active. Ajoutez-en au moins une pour ce bien.
        </p>
      ) : (
        <ul className="divide-y divide-rule/60 rounded-md border border-rule/60">
          {current.map((r) => (
            <RelationshipRow key={r.id} relationship={r} />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpenAdd(true)}>
          <UserPlus className="size-4" /> Ajouter une partie prenante
        </Button>
        <Button variant="outline" size="sm" onClick={() => setOpenRevente(true)}>
          <ArrowRightLeft className="size-4" /> Déclarer une revente
        </Button>
      </div>

      {past.length > 0 ? (
        <details className="rounded-md border border-rule/60 bg-cream-deep/20">
          <summary className="cursor-pointer px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
            Historique des parties prenantes · {past.length}
          </summary>
          <ul className="divide-y divide-rule/60 border-t border-rule/60">
            {past.map((r) => (
              <RelationshipRow key={r.id} relationship={r} historical />
            ))}
          </ul>
        </details>
      ) : null}

      {ownershipHistory.length > 0 ? (
        <details className="rounded-md border border-rule/60 bg-cream-deep/20">
          <summary className="cursor-pointer px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
            Historique des reventes · {ownershipHistory.length}
          </summary>
          <ul className="divide-y divide-rule/60 border-t border-rule/60">
            {ownershipHistory.map((h) => (
              <li key={h.id} className="px-3 py-2.5 text-[12px]">
                <p className="text-ink">
                  <span className="font-mono">
                    {new Date(h.transaction_date).toLocaleDateString('fr-FR')}
                  </span>
                  {' — '}
                  {h.previous_owner_name ?? 'Ancien propriétaire'} →{' '}
                  <strong>{h.new_owner_name ?? 'Nouveau propriétaire'}</strong>
                </p>
                {h.transaction_amount_eur ? (
                  <p className="font-mono text-[11px] text-ink-mute">
                    Montant :{' '}
                    {new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: 'EUR',
                    }).format(h.transaction_amount_eur)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {openAdd ? (
        <AddStakeholderModal
          propertyId={propertyId}
          clients={clients}
          onClose={() => setOpenAdd(false)}
        />
      ) : null}

      {openRevente ? (
        <DeclareReventeModal
          propertyId={propertyId}
          clients={clients}
          onClose={() => setOpenRevente(false)}
        />
      ) : null}
    </Card>
  )
}

function RelationshipRow({
  relationship,
  historical,
}: {
  relationship: StakeholderRelationship
  historical?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleEnd() {
    if (!confirm('Marquer cette relation comme ancienne ?')) return
    setError(null)
    startTransition(async () => {
      const today = new Date().toISOString().slice(0, 10)
      const r = await endPropertyStakeholderAction(relationship.id, today)
      if (r?.error) setError(r.error)
    })
  }

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <Link
            href={`/dashboard/clients/${relationship.client_id}`}
            className="text-[13px] font-medium text-ink truncate hover:underline"
          >
            {relationship.client_name ?? 'Client'}
          </Link>
          <p className="font-mono text-[10px] text-ink-faint">
            Depuis le {new Date(relationship.started_at).toLocaleDateString('fr-FR')}
            {relationship.ended_at
              ? ` · jusqu'au ${new Date(relationship.ended_at).toLocaleDateString('fr-FR')}`
              : null}
            {relationship.ownership_share ? ` · ${relationship.ownership_share}%` : null}
          </p>
          {error ? <p className="text-[11px] text-accent-red">{error}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={historical ? 'muted' : 'blue'}>
          {PROPERTY_ROLE_LABEL[relationship.role]}
        </Badge>
        {!historical ? (
          <Button variant="ghost" size="sm" onClick={handleEnd} disabled={pending}>
            {pending ? <Loader2 className="size-3 animate-spin" /> : 'Marquer ancienne'}
          </Button>
        ) : null}
      </div>
    </li>
  )
}

function ModalShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      // biome-ignore lint/a11y/useSemanticElements: <dialog> requires showModal() imperative API which conflicts with React state-driven mounting.
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  )
}

function FieldRow({
  label,
  htmlFor,
  children,
}: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <label
        htmlFor={htmlFor}
        className="block font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function AddStakeholderModal({
  propertyId,
  clients,
  onClose,
}: {
  propertyId: string
  clients: ReadonlyArray<{ id: string; display_name: string }>
  onClose: () => void
}) {
  const [state, formAction, pending] = useActionState<AddStakeholderState, FormData>(
    addPropertyStakeholderAction,
    undefined,
  )
  const formId = useId()

  if (state?.success) {
    setTimeout(onClose, 200)
  }

  return (
    <ModalShell>
      <Card variant="flat" padding="default" className="w-full max-w-md space-y-4">
        <h3 className="text-[15px] font-semibold text-ink">Ajouter une partie prenante</h3>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="propertyId" value={propertyId} />

          <FieldRow label="Client" htmlFor={`${formId}-client`}>
            <Select id={`${formId}-client`} name="clientId" required disabled={pending}>
              <option value="">— Choisir un client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-ink-mute">
              Pas trouvé ?{' '}
              <Link href="/dashboard/clients/new" className="underline">
                Créer un client
              </Link>
            </p>
          </FieldRow>

          <FieldRow label="Rôle" htmlFor={`${formId}-role`}>
            <Select
              id={`${formId}-role`}
              name="role"
              required
              disabled={pending}
              defaultValue="owner"
            >
              {ROLES_LIST.map((r) => (
                <option key={r} value={r}>
                  {PROPERTY_ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </FieldRow>

          <FieldRow label="Quote-part (%) — indivision" htmlFor={`${formId}-share`}>
            <input
              id={`${formId}-share`}
              type="number"
              name="ownershipShare"
              min="0.01"
              max="100"
              step="0.01"
              className="block w-full rounded-md border border-rule/60 bg-paper px-3 py-2 text-[13px]"
              disabled={pending}
              placeholder="50.00"
            />
          </FieldRow>

          <FieldRow label="Date de début" htmlFor={`${formId}-started`}>
            <input
              id={`${formId}-started`}
              type="date"
              name="startedAt"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="block w-full rounded-md border border-rule/60 bg-paper px-3 py-2 text-[13px]"
              disabled={pending}
            />
          </FieldRow>

          {state?.error ? (
            <p className="text-[12px] text-accent-red" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" variant="default" size="sm" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Ajouter
            </Button>
          </div>
        </form>
      </Card>
    </ModalShell>
  )
}

function DeclareReventeModal({
  propertyId,
  clients,
  onClose,
}: {
  propertyId: string
  clients: ReadonlyArray<{ id: string; display_name: string }>
  onClose: () => void
}) {
  const [state, formAction, pending] = useActionState<DeclareReventeState, FormData>(
    declareReventeAction,
    undefined,
  )
  const formId = useId()

  if (state?.success) {
    setTimeout(onClose, 200)
  }

  return (
    <ModalShell>
      <Card variant="flat" padding="default" className="w-full max-w-md space-y-4">
        <h3 className="text-[15px] font-semibold text-ink">Déclarer une revente</h3>
        <p className="text-[12px] text-ink-mute">
          Le bien sera transféré au nouveau propriétaire. Les diagnostics existants restent
          accessibles dans l'historique.
        </p>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="propertyId" value={propertyId} />

          <FieldRow label="Nouveau propriétaire" htmlFor={`${formId}-new-owner`}>
            <Select id={`${formId}-new-owner`} name="newOwnerClientId" required disabled={pending}>
              <option value="">— Choisir un client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-ink-mute">
              Pas trouvé ?{' '}
              <Link href="/dashboard/clients/new" className="underline">
                Créer un client
              </Link>
            </p>
          </FieldRow>

          <FieldRow label="Date de la vente" htmlFor={`${formId}-tx-date`}>
            <input
              id={`${formId}-tx-date`}
              type="date"
              name="transactionDate"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="block w-full rounded-md border border-rule/60 bg-paper px-3 py-2 text-[13px]"
              disabled={pending}
            />
          </FieldRow>

          <FieldRow label="Montant (optionnel)" htmlFor={`${formId}-tx-amount`}>
            <input
              id={`${formId}-tx-amount`}
              type="number"
              name="transactionAmount"
              min="0"
              step="100"
              className="block w-full rounded-md border border-rule/60 bg-paper px-3 py-2 text-[13px]"
              disabled={pending}
              placeholder="320000"
            />
          </FieldRow>

          <FieldRow label="Notes" htmlFor={`${formId}-notes`}>
            <textarea
              id={`${formId}-notes`}
              name="notes"
              rows={2}
              className="block w-full rounded-md border border-rule/60 bg-paper px-3 py-2 text-[13px]"
              disabled={pending}
            />
          </FieldRow>

          {state?.error ? (
            <p className="text-[12px] text-accent-red" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" variant="default" size="sm" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirmer la revente
            </Button>
          </div>
        </form>
      </Card>
    </ModalShell>
  )
}
