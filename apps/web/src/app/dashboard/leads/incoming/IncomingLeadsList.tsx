'use client'

/**
 * IncomingLeadsList — liste verticale des assignments leads pour le diag.
 *
 * Filtre status : pending (par defaut) / accepted / declined / expired.
 * Au clic Accepter / Refuser : appel des Server Actions
 * `acceptLeadAssignment` / `declineLeadAssignment`.
 */

import { EmptyState } from '@/components/ui/empty-state'
import { Inbox } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { acceptLeadAssignment, declineLeadAssignment } from '../actions'
import { LeadCard } from './LeadCard'

export type AssignmentStatus = 'pending' | 'accepted' | 'declined' | 'expired'

export interface IncomingLeadAssignment {
  id: string
  quoteRequestId: string
  status: AssignmentStatus
  expiresAt: string | null
  respondedAt: string | null
  createdAt: string | null
  assignmentType: string | null
  routingStrategy: string | null
  diagnosticianId: string
  requesterFirstName: string | null
  /** Nom masque (initiale uniquement) tant que status != 'accepted'. */
  requesterLastNameMasked: string | null
  /** Email/Phone debloque uniquement si status === 'accepted'. */
  requesterEmail: string | null
  requesterPhone: string | null
  propertyAddress: string | null
  message: string | null
  city: string | null
  postalCode: string | null
  surfaceM2: number | null
  propertyType: string | null
  diagnosticsRequested: readonly string[]
  urgency: string | null
}

type StatusFilter = 'pending' | 'accepted' | 'declined' | 'expired'

interface IncomingLeadsListProps {
  initialAssignments: readonly IncomingLeadAssignment[]
}

export function IncomingLeadsList({ initialAssignments }: IncomingLeadsListProps) {
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [assignments, setAssignments] =
    useState<readonly IncomingLeadAssignment[]>(initialAssignments)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      pending: 0,
      accepted: 0,
      declined: 0,
      expired: 0,
    }
    for (const a of assignments) {
      c[a.status] = (c[a.status] ?? 0) + 1
    }
    return c
  }, [assignments])

  const filtered = assignments.filter((a) => a.status === filter)

  function handleAccept(id: string) {
    setFeedback(null)
    startTransition(async () => {
      const res = await acceptLeadAssignment(id)
      if (res.ok && res.assignment) {
        setAssignments((prev) =>
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status: 'accepted',
                  respondedAt: new Date().toISOString(),
                  requesterEmail: res.assignment?.requesterEmail ?? null,
                  requesterPhone: res.assignment?.requesterPhone ?? null,
                  propertyAddress: res.assignment?.propertyAddress ?? null,
                  message: res.assignment?.message ?? null,
                  requesterLastNameMasked:
                    res.assignment?.requesterLastName ?? a.requesterLastNameMasked,
                }
              : a,
          ),
        )
        setFeedback({ kind: 'ok', text: 'Lead accepte. Coordonnees debloquees.' })
      } else {
        setFeedback({ kind: 'error', text: res.error ?? 'Impossible d accepter ce lead.' })
      }
    })
  }

  function handleDecline(id: string, reason?: string) {
    setFeedback(null)
    startTransition(async () => {
      const res = await declineLeadAssignment(id, reason)
      if (res.ok) {
        setAssignments((prev) =>
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status: 'declined',
                  respondedAt: new Date().toISOString(),
                }
              : a,
          ),
        )
        setFeedback({ kind: 'ok', text: 'Lead refuse.' })
      } else {
        setFeedback({ kind: 'error', text: res.error ?? 'Impossible de refuser ce lead.' })
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Filtres status */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterTab
          active={filter === 'pending'}
          onClick={() => setFilter('pending')}
          label={`A repondre (${counts.pending})`}
        />
        <FilterTab
          active={filter === 'accepted'}
          onClick={() => setFilter('accepted')}
          label={`Acceptes (${counts.accepted})`}
        />
        <FilterTab
          active={filter === 'declined'}
          onClick={() => setFilter('declined')}
          label={`Refuses (${counts.declined})`}
        />
        <FilterTab
          active={filter === 'expired'}
          onClick={() => setFilter('expired')}
          label={`Expires (${counts.expired})`}
        />
      </div>

      {/* Feedback */}
      {feedback ? (
        <div
          className={
            feedback.kind === 'ok'
              ? 'rounded-lg bg-lime-mist/40 border border-lime-mist px-4 py-2 text-sm text-[#2D4015]'
              : 'rounded-lg bg-coral-mist/40 border border-coral-mist px-4 py-2 text-sm text-[#8B1414]'
          }
        >
          {feedback.text}
        </div>
      ) : null}

      {/* Liste */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            filter === 'pending'
              ? 'Aucun lead en attente.'
              : `Aucun lead ${labelForFilter(filter)}.`
          }
          description={
            filter === 'pending'
              ? "Profitez-en pour mettre à jour votre fiche annuaire — c'est elle qui amène les prochains prospects."
              : 'Changez de filtre pour retrouver vos autres assignments.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => (
            <li key={a.id}>
              <LeadCard
                assignment={a}
                disabled={isPending}
                onAccept={() => handleAccept(a.id)}
                onDecline={(reason) => handleDecline(a.id, reason)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FilterTab({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-pill bg-navy text-paper px-4 py-1.5 text-sm font-medium'
          : 'rounded-pill bg-paper border border-rule text-ink-mute px-4 py-1.5 text-sm hover:text-ink transition-colors'
      }
    >
      {label}
    </button>
  )
}

function labelForFilter(f: StatusFilter): string {
  switch (f) {
    case 'pending':
      return 'a repondre'
    case 'accepted':
      return 'accepte'
    case 'declined':
      return 'refuse'
    case 'expired':
      return 'expire'
  }
}
