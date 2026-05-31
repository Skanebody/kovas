'use client'

/**
 * Barre de filtres pour la liste utilisateurs admin.
 *
 * Tous les filtres sont stockés dans l'URL (?q, ?plan, ?status, ?sort) pour
 * permettre le partage de liens entre admins. Le composant Select de ce projet
 * est un <select> natif HTML (cf. components/ui/select.tsx).
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { UsersPlanFilter, UsersStatusFilter } from '@/lib/admin/users-types'
import { Search, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'

interface UsersFiltersProps {
  initialQ: string
  initialPlan: UsersPlanFilter
  initialStatus: UsersStatusFilter
}

const PLAN_OPTIONS: { value: UsersPlanFilter; label: string }[] = [
  { value: 'all', label: 'Tous les plans' },
  { value: 'decouverte', label: 'Découverte' },
  { value: 'standard', label: 'Standard' },
  { value: 'volume', label: 'Volume' },
  { value: 'founder', label: 'Founder' },
  { value: 'cabinet', label: 'Cabinet' },
]

const STATUS_OPTIONS: { value: UsersStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tous statuts' },
  { value: 'active', label: 'Actif' },
  { value: 'trialing', label: 'Essai' },
  { value: 'past_due', label: 'Impayé' },
  { value: 'cancelled', label: 'Résilié' },
  { value: 'suspended', label: 'Suspendu' },
]

export function UsersFilters({ initialQ, initialPlan, initialStatus }: UsersFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState(initialQ)
  const [plan, setPlan] = useState<UsersPlanFilter>(initialPlan)
  const [status, setStatus] = useState<UsersStatusFilter>(initialStatus)

  const apply = useCallback(
    (overrides?: { q?: string; plan?: UsersPlanFilter; status?: UsersStatusFilter }) => {
      const next = new URLSearchParams(searchParams.toString())
      const nq = overrides?.q ?? q
      const np = overrides?.plan ?? plan
      const ns = overrides?.status ?? status

      if (nq) next.set('q', nq)
      else next.delete('q')
      if (np && np !== 'all') next.set('plan', np)
      else next.delete('plan')
      if (ns && ns !== 'all') next.set('status', ns)
      else next.delete('status')
      next.delete('page') // reset pagination

      router.push(`/admin/users?${next.toString()}`)
    },
    [searchParams, q, plan, status, router],
  )

  const reset = useCallback(() => {
    setQ('')
    setPlan('all')
    setStatus('all')
    router.push('/admin/users')
  }, [router])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        apply()
      }}
      className="flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap"
      aria-label="Filtres utilisateurs"
    >
      {/* Search */}
      <div className="relative w-full md:flex-1 md:min-w-[220px]">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-faint pointer-events-none"
          aria-hidden
        />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Email, nom, organisation…"
          className="pl-9"
          aria-label="Rechercher un utilisateur"
        />
      </div>

      {/* Plan filter (native select) */}
      <Select
        className="md:w-[180px]"
        value={plan}
        onChange={(e) => {
          const nv = e.target.value as UsersPlanFilter
          setPlan(nv)
          apply({ plan: nv })
        }}
        aria-label="Filtrer par plan"
      >
        {PLAN_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>

      {/* Status filter */}
      <Select
        className="md:w-[180px]"
        value={status}
        onChange={(e) => {
          const nv = e.target.value as UsersStatusFilter
          setStatus(nv)
          apply({ status: nv })
        }}
        aria-label="Filtrer par statut"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>

      <Button type="submit" variant="default" size="sm">
        Rechercher
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={reset}>
        <X className="size-3.5" aria-hidden />
        Réinitialiser
      </Button>
    </form>
  )
}
