'use client'

import { reviewSignalementAction } from '@/app/admin/(gated)/verifications/actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

interface SignalementUiRow {
  id: string
  diagnosticianId: string
  diagnosticianName: string | null
  diagnosticianCity: string | null
  reporterEmail: string | null
  reason: string
  description: string | null
  status: 'new' | 'investigating' | 'confirmed_fraud' | 'dismissed' | 'resolved'
  createdAt: string
}

const FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'new', label: 'Nouveaux' },
  { value: 'investigating', label: 'En cours' },
  { value: 'confirmed_fraud', label: 'Fraude confirmée' },
  { value: 'dismissed', label: 'Écartés' },
] as const

function statusBadge(status: SignalementUiRow['status']): string {
  switch (status) {
    case 'new':
      return 'bg-coral-mist text-[#8B1414]'
    case 'investigating':
      return 'bg-orange-mist text-[#7C3F0A]'
    case 'confirmed_fraud':
      return 'bg-navy text-paper'
    case 'dismissed':
      return 'bg-cream-deep text-ink-mute'
    case 'resolved':
      return 'bg-lime-mist text-[#2D4015]'
    default:
      return 'bg-cream-deep text-ink-mute'
  }
}

interface Props {
  rows: SignalementUiRow[]
  currentFilter: 'all' | 'new' | 'investigating' | 'confirmed_fraud' | 'dismissed'
}

export function SignalementsTable({ rows, currentFilter }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [openId, setOpenId] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<string>('investigating')

  function setFilter(value: Props['currentFilter']) {
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
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
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

      <div className="overflow-x-auto rounded-lg border border-rule bg-paper">
        <table className="w-full text-[12px]">
          <thead className="bg-cream-deep border-b border-rule">
            <tr className="text-ink-mute">
              <th className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider">
                Date
              </th>
              <th className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider">
                Diagnostiqueur
              </th>
              <th className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider">
                Raison
              </th>
              <th className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider">
                Reporter
              </th>
              <th className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider">
                Statut
              </th>
              <th className="px-3 py-2.5 text-right font-mono text-[10px] uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-ink-faint">
                  Aucun signalement sur ce filtre.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-rule/50 last:border-0 hover:bg-cream-deep/40 align-top"
                >
                  <td className="px-3 py-2.5 font-mono text-[10px] text-ink-mute whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-ink">{row.diagnosticianName ?? '—'}</div>
                    {row.diagnosticianCity ? (
                      <div className="text-ink-faint text-[11px]">{row.diagnosticianCity}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-ink">
                    {row.reason}
                    {row.description ? (
                      <div className="text-ink-mute text-[11px] mt-1 max-w-md whitespace-pre-line">
                        {row.description.slice(0, 200)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-ink-mute">
                    {row.reporterEmail ?? <span className="italic">anonyme</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-display font-semibold',
                        statusBadge(row.status),
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {openId !== row.id ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenId(row.id)}
                      >
                        Investiguer
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setOpenId(null)}
                      >
                        Fermer
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
            {openId
              ? (() => {
                  const row = rows.find((r) => r.id === openId)
                  if (!row) return null
                  return (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 bg-sage/40 border-t border-rule">
                        <form action={reviewSignalementAction} className="space-y-3 max-w-2xl">
                          <input type="hidden" name="signalementId" value={row.id} />
                          <div>
                            <label
                              htmlFor={`outcome-${row.id}`}
                              className="block font-mono text-[10px] uppercase tracking-wider text-ink-mute mb-1"
                            >
                              Décision
                            </label>
                            <select
                              id={`outcome-${row.id}`}
                              name="outcome"
                              value={outcome}
                              onChange={(e) => setOutcome(e.target.value)}
                              className="rounded-md border border-rule bg-paper px-3 py-2 text-[13px] text-ink"
                            >
                              <option value="investigating">Mettre en investigation</option>
                              <option value="confirmed_fraud">Confirmer la fraude</option>
                              <option value="dismissed">Écarter (sans suite)</option>
                              <option value="resolved">Résolu (action prise)</option>
                            </select>
                          </div>
                          <div>
                            <label
                              htmlFor={`notes-${row.id}`}
                              className="block font-mono text-[10px] uppercase tracking-wider text-ink-mute mb-1"
                            >
                              Notes (audit interne)
                            </label>
                            <textarea
                              id={`notes-${row.id}`}
                              name="notes"
                              rows={2}
                              placeholder="Justification de la décision"
                              className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-[13px] text-ink"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" variant="default" size="sm">
                              Enregistrer la décision
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setOpenId(null)}
                            >
                              Annuler
                            </Button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )
                })()
              : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
