'use client'

/**
 * Tableau utilisateurs admin : entêtes triables + pagination.
 *
 * Le tri / pagination passent par l'URL (les filtres aussi, cf. UsersFilters).
 * La row est wrappée dans un Link "stretched" pour qu'un clic n'importe où
 * navigue vers /admin/users/[id].
 */

import type { UserListItem, UsersSort } from '@/lib/admin/users-types'
import { cn } from '@/lib/utils'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { UserRow } from './UserRow'

interface UsersListTableProps {
  users: UserListItem[]
  total: number
  page: number
  limit: number
  sort: UsersSort
}

interface HeaderCol {
  label: string
  sortKey?: UsersSort | { asc: UsersSort; desc: UsersSort }
  className?: string
}

const COLS: HeaderCol[] = [
  {
    label: 'Utilisateur',
    sortKey: { asc: 'created_at_asc', desc: 'created_at_desc' },
  },
  { label: 'Organisation', className: 'hidden lg:table-cell' },
  { label: 'Plan', sortKey: 'mrr_desc' },
  { label: 'Statut' },
  { label: 'Missions / mois', sortKey: 'missions_desc', className: 'hidden sm:table-cell' },
  { label: 'Revenue total', className: 'hidden lg:table-cell' },
  { label: 'Dernière activité', sortKey: 'last_activity_desc', className: 'hidden md:table-cell' },
]

function SortIndicator({
  active,
  direction,
}: {
  active: boolean
  direction: 'asc' | 'desc' | null
}) {
  if (!active) return <ArrowUpDown className="size-3 text-ink-faint" aria-hidden />
  if (direction === 'asc') return <ArrowUp className="size-3 text-ink" aria-hidden />
  return <ArrowDown className="size-3 text-ink" aria-hidden />
}

export function UsersListTable({ users, total, page, limit, sort }: UsersListTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const updateUrl = useCallback(
    (patches: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(patches)) {
        if (v === null || v === '') next.delete(k)
        else next.set(k, v)
      }
      router.push(`/admin/users?${next.toString()}`)
    },
    [router, searchParams],
  )

  const handleSort = (col: HeaderCol) => {
    if (!col.sortKey) return
    if (typeof col.sortKey === 'string') {
      updateUrl({ sort: col.sortKey, page: null })
      return
    }
    // toggle asc/desc
    const next = sort === col.sortKey.asc ? col.sortKey.desc : col.sortKey.asc
    updateUrl({ sort: next, page: null })
  }

  return (
    <div className="rounded-xl border border-rule bg-paper overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-cream-deep/40 border-b border-rule">
            <tr>
              {COLS.map((col) => {
                const isSortable = Boolean(col.sortKey)
                const sortDir =
                  col.sortKey && typeof col.sortKey !== 'string'
                    ? sort === col.sortKey.asc
                      ? 'asc'
                      : sort === col.sortKey.desc
                        ? 'desc'
                        : null
                    : col.sortKey === sort
                      ? 'desc'
                      : null
                const isActive = sortDir !== null

                return (
                  <th
                    key={col.label}
                    scope="col"
                    className={cn(
                      'px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium',
                      col.className,
                    )}
                  >
                    {isSortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col)}
                        className="inline-flex items-center gap-1.5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/20 rounded-sm"
                        aria-label={`Trier par ${col.label}`}
                      >
                        {col.label}
                        <SortIndicator active={isActive} direction={sortDir} />
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">{col.label}</span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="px-4 py-12 text-center text-ink-mute text-sm">
                  Aucun utilisateur ne correspond aux filtres.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.user_id}
                  className="border-b border-rule/40 last:border-0 hover:bg-cream-deep/30 transition-colors relative"
                >
                  {/* Stretched link sur la ligne entière */}
                  <td className="absolute inset-0 p-0">
                    <Link
                      href={`/admin/users/${u.user_id}`}
                      className="block size-full"
                      aria-label={`Voir le profil de ${u.full_name ?? u.email}`}
                    />
                  </td>
                  <UserRow user={u} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-rule bg-cream-deep/20">
          <p className="text-[11px] text-ink-mute font-mono">
            Page {page} / {totalPages} · {total} utilisateurs
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-rule px-2.5 py-1.5 text-[12px] text-ink hover:bg-paper disabled:opacity-40 disabled:pointer-events-none"
              disabled={page <= 1}
              onClick={() => updateUrl({ page: String(page - 1) })}
              aria-label="Page précédente"
            >
              <ChevronLeft className="size-3.5" aria-hidden />
              Précédent
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-rule px-2.5 py-1.5 text-[12px] text-ink hover:bg-paper disabled:opacity-40 disabled:pointer-events-none"
              disabled={page >= totalPages}
              onClick={() => updateUrl({ page: String(page + 1) })}
              aria-label="Page suivante"
            >
              Suivant
              <ChevronRight className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
