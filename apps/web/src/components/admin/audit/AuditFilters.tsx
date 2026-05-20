'use client'

/**
 * Filtres de la page /admin/audit.
 *
 * Met à jour les query params URL (server component recharge automatiquement).
 * 6 filtres + recherche + reset + bouton Export CSV.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ACTION_SOURCE_OPTIONS, type AuditFilters } from '@/lib/admin/audit-types'
import { Download, RotateCcw, Search } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

interface AuditFiltersProps {
  initial: AuditFilters
  adminOptions: Array<{ user_id: string; email: string }>
  actionTypeOptions: string[]
  targetTypeOptions: string[]
}

export function AuditFiltersBar({
  initial,
  adminOptions,
  actionTypeOptions,
  targetTypeOptions,
}: AuditFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [adminUserId, setAdminUserId] = useState(initial.adminUserId)
  const [actionTypes, setActionTypes] = useState<string[]>(initial.actionTypes)
  const [actionSources, setActionSources] = useState<string[]>(initial.actionSources)
  const [succeeded, setSucceeded] = useState<'all' | 'true' | 'false'>(initial.succeeded)
  const [targetType, setTargetType] = useState(initial.targetType)
  const [q, setQ] = useState(initial.q)
  const [dateFrom, setDateFrom] = useState(initial.dateFrom)
  const [dateTo, setDateTo] = useState(initial.dateTo)

  const apply = () => {
    const params = new URLSearchParams()
    if (adminUserId) params.set('admin_user_id', adminUserId)
    if (actionTypes.length > 0) params.set('action_types', actionTypes.join(','))
    if (actionSources.length > 0) params.set('action_sources', actionSources.join(','))
    if (succeeded !== 'all') params.set('succeeded', succeeded)
    if (targetType) params.set('target_type', targetType)
    if (q) params.set('q', q)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    startTransition(() => {
      router.push(`/admin/audit${params.toString() ? `?${params.toString()}` : ''}`)
    })
  }

  const reset = () => {
    setAdminUserId('')
    setActionTypes([])
    setActionSources([])
    setSucceeded('all')
    setTargetType('')
    setQ('')
    setDateFrom('')
    setDateTo('')
    startTransition(() => {
      router.push('/admin/audit')
    })
  }

  const exportCsvUrl = `/api/admin/audit/export.csv?${searchParams.toString()}`

  const toggleActionType = (t: string) => {
    setActionTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }
  const toggleSource = (s: string) => {
    setActionSources((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label
            htmlFor="f-admin"
            className="text-[11px] font-mono uppercase tracking-wider text-ink-mute"
          >
            Admin
          </label>
          <Select
            id="f-admin"
            value={adminUserId}
            onChange={(e) => setAdminUserId(e.target.value)}
            className="mt-1"
          >
            <option value="">Tous</option>
            {adminOptions.map((a) => (
              <option key={a.user_id} value={a.user_id}>
                {a.email}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label
            htmlFor="f-success"
            className="text-[11px] font-mono uppercase tracking-wider text-ink-mute"
          >
            Statut
          </label>
          <Select
            id="f-success"
            value={succeeded}
            onChange={(e) => setSucceeded(e.target.value as 'all' | 'true' | 'false')}
            className="mt-1"
          >
            <option value="all">Tous</option>
            <option value="true">Succès</option>
            <option value="false">Échec</option>
          </Select>
        </div>
        <div>
          <label
            htmlFor="f-target"
            className="text-[11px] font-mono uppercase tracking-wider text-ink-mute"
          >
            Target type
          </label>
          <Select
            id="f-target"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            className="mt-1"
          >
            <option value="">Tous</option>
            {targetTypeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label
            htmlFor="f-date-from"
            className="text-[11px] font-mono uppercase tracking-wider text-ink-mute"
          >
            Du
          </label>
          <Input
            id="f-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <label
            htmlFor="f-date-to"
            className="text-[11px] font-mono uppercase tracking-wider text-ink-mute"
          >
            Au
          </label>
          <Input
            id="f-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <label
            htmlFor="f-search"
            className="text-[11px] font-mono uppercase tracking-wider text-ink-mute"
          >
            Recherche
          </label>
          <div className="relative mt-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-ink-faint" />
            <Input
              id="f-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="target_label / error…"
              className="pl-7"
            />
          </div>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-mono uppercase tracking-wider text-ink-mute mb-1.5">
          Action types
        </p>
        <div className="flex flex-wrap gap-1.5">
          {actionTypeOptions.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleActionType(t)}
              className={`text-[10px] px-2 py-0.5 rounded-pill border transition-colors ${
                actionTypes.includes(t)
                  ? 'bg-navy text-paper border-navy'
                  : 'bg-paper text-ink-mute border-rule hover:border-navy/40'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-mono uppercase tracking-wider text-ink-mute mb-1.5">
          Sources
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ACTION_SOURCE_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => toggleSource(s.value)}
              className={`text-[10px] px-2 py-0.5 rounded-pill border transition-colors ${
                actionSources.includes(s.value)
                  ? 'bg-navy text-paper border-navy'
                  : 'bg-paper text-ink-mute border-rule hover:border-navy/40'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="default" size="sm" onClick={apply} disabled={isPending}>
          {isPending ? 'Application…' : 'Appliquer les filtres'}
        </Button>
        <Button variant="ghost" size="sm" onClick={reset} disabled={isPending}>
          <RotateCcw className="size-3.5" aria-hidden />
          Reset
        </Button>
        <a
          href={exportCsvUrl}
          className="inline-flex items-center gap-2 rounded-pill border border-rule bg-paper px-3.5 py-1.5 text-[11px] font-display font-medium text-ink hover:border-navy/40 transition-colors min-h-[36px]"
        >
          <Download className="size-3.5" aria-hidden />
          Export CSV
        </a>
      </div>
    </div>
  )
}
