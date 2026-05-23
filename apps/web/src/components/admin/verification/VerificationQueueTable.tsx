'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Eye } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { VerificationReviewModal } from './VerificationReviewModal'

/**
 * Tableau client de la file de modération.
 *
 * Filtres : all | pending | in_review | rejected | signalement_threshold
 *   (le filtre est appliqué côté serveur via le query param ?filter=).
 *
 * Action "Examiner" : ouvre une modal qui fetch les détails (4 phases +
 * historique + signalements) sur demande côté serveur.
 */

interface RowProps {
  id: string
  fullName: string
  city: string | null
  overallStatus: string | null
  badgeLevel: string | null
  identityStatus: string | null
  cofracStatus: string | null
  rcproStatus: string | null
  sireneStatus: string | null
  signalementsCount: number
  priority: number
  lastActivity: string | null
}

interface VerificationQueueTableProps {
  rows: RowProps[]
  currentFilter: 'all' | 'pending' | 'in_review' | 'rejected' | 'signalement_threshold'
}

interface ModalDetailsResponse {
  diagId: string
  fullName: string
  city: string | null
  email: string | null
  overallStatus: string | null
  badgeLevel: string | null
  signalementsCount: number
  identity: {
    status: string | null
    rejectionReason?: string | null
    verifiedAt?: string | null
    fields?: Record<string, string | number | null>
  }
  cofrac: {
    status: string | null
    rejectionReason?: string | null
    verifiedAt?: string | null
    fields?: Record<string, string | number | null>
  }
  rcpro: {
    status: string | null
    rejectionReason?: string | null
    verifiedAt?: string | null
    fields?: Record<string, string | number | null>
  }
  sirene: {
    status: string | null
    rejectionReason?: string | null
    verifiedAt?: string | null
    fields?: Record<string, string | number | null>
  }
  history: Array<{
    id: string
    checkType: string
    checkSource: string
    status: string
    performedAt: string
    resultSummary?: string
  }>
  signalements: Array<{
    id: string
    reason: string
    description: string | null
    status: string
    createdAt: string
  }>
}

const FILTERS: Array<{
  value: VerificationQueueTableProps['currentFilter']
  label: string
}> = [
  { value: 'all', label: 'Tous' },
  { value: 'pending', label: 'En attente' },
  { value: 'in_review', label: 'À examiner' },
  { value: 'rejected', label: 'Rejetés' },
  { value: 'signalement_threshold', label: 'Signalements (≥3)' },
]

function statusBadge(status: string | null): string {
  switch (status) {
    case 'verified':
      return 'bg-lime-mist text-[#2D4015]'
    case 'rejected':
    case 'suspended':
    case 'radiated':
    case 'liquidation':
      return 'bg-coral-mist text-[#8B1414]'
    case 'expired':
      return 'bg-orange-mist text-[#7C3F0A]'
    case 'in_review':
      return 'bg-blue-mist text-[#1E3A8A]'
    default:
      return 'bg-cream-deep text-ink-mute'
  }
}

function PhaseDot({ status }: { status: string | null }) {
  return (
    <span
      title={status ?? 'pending'}
      className={cn(
        'inline-block size-2.5 rounded-full',
        status === 'verified'
          ? 'bg-[#2D4015]'
          : status === 'rejected' ||
              status === 'suspended' ||
              status === 'radiated' ||
              status === 'liquidation'
            ? 'bg-[#8B1414]'
            : status === 'expired'
              ? 'bg-[#7C3F0A]'
              : status === 'in_review'
                ? 'bg-[#1E3A8A]'
                : 'bg-ink-faint',
      )}
    />
  )
}

export function VerificationQueueTable({ rows, currentFilter }: VerificationQueueTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [selectedDiagId, setSelectedDiagId] = useState<string | null>(null)
  const [details, setDetails] = useState<ModalDetailsResponse | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  useEffect(() => {
    if (!selectedDiagId) {
      setDetails(null)
      return
    }
    setLoadingDetails(true)
    fetch(`/api/admin/verifications/${selectedDiagId}`, {
      headers: { 'Content-Type': 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ModalDetailsResponse | null) => {
        setDetails(data)
        setLoadingDetails(false)
      })
      .catch(() => {
        setDetails(null)
        setLoadingDetails(false)
      })
  }, [selectedDiagId])

  const filterChips = useMemo(() => FILTERS, [])

  function setFilter(value: VerificationQueueTableProps['currentFilter']) {
    const sp = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      sp.delete('filter')
    } else {
      sp.set('filter', value)
    }
    router.push(`${pathname}?${sp.toString()}`)
  }

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {filterChips.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              'inline-flex items-center rounded-pill px-3 py-1 text-[12px] font-display font-medium transition-colors',
              currentFilter === f.value
                ? 'bg-navy text-paper'
                : 'bg-paper border border-rule text-ink-mute hover:text-ink hover:bg-cream-deep',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-rule bg-paper">
        <table className="w-full text-[12px]">
          <thead className="bg-cream-deep border-b border-rule">
            <tr className="text-ink-mute">
              <th className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider">
                Diagnostiqueur
              </th>
              <th className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider">
                Ville
              </th>
              <th className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider">
                Statut global
              </th>
              <th className="px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-wider">
                Id.
              </th>
              <th className="px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-wider">
                COFRAC
              </th>
              <th className="px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-wider">
                RC Pro
              </th>
              <th className="px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-wider">
                SIRENE
              </th>
              <th className="px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-wider">
                Signal.
              </th>
              <th className="px-3 py-2.5 text-right font-mono text-[10px] uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-ink-faint">
                  Aucun diagnostiqueur ne correspond à ce filtre.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-rule/50 last:border-0 hover:bg-cream-deep/40"
                >
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/verifications/queue?focus=${row.id}`}
                      className="font-medium text-ink hover:underline"
                    >
                      {row.fullName}
                    </Link>
                    {row.priority > 0 ? (
                      <span className="ml-2 inline-flex items-center rounded-pill bg-coral-mist text-[#8B1414] px-1.5 py-0.5 text-[9px] font-display font-bold">
                        P{row.priority}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-ink-mute">{row.city ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-display font-semibold',
                        statusBadge(row.overallStatus),
                      )}
                    >
                      {row.overallStatus ?? 'pending'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <PhaseDot status={row.identityStatus} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <PhaseDot status={row.cofracStatus} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <PhaseDot status={row.rcproStatus} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <PhaseDot status={row.sireneStatus} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {row.signalementsCount > 0 ? (
                      <span className="font-display font-bold text-coral-mist-foreground">
                        {row.signalementsCount}
                      </span>
                    ) : (
                      <span className="text-ink-faint">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDiagId(row.id)}
                    >
                      <Eye className="size-3.5" aria-hidden />
                      Examiner
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {selectedDiagId && details ? (
        <VerificationReviewModal
          diagId={details.diagId}
          fullName={details.fullName}
          city={details.city}
          email={details.email}
          overallStatus={details.overallStatus}
          badgeLevel={details.badgeLevel}
          signalementsCount={details.signalementsCount}
          identity={details.identity}
          cofrac={details.cofrac}
          rcpro={details.rcpro}
          sirene={details.sirene}
          history={details.history}
          signalements={details.signalements}
          onClose={() => setSelectedDiagId(null)}
        />
      ) : null}
      {selectedDiagId && !details && loadingDetails ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm">
          <div className="bg-paper rounded-xl p-6 text-ink-mute">Chargement…</div>
        </div>
      ) : null}
    </div>
  )
}
