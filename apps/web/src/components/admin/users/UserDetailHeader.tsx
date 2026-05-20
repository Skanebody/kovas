/**
 * Header de la fiche détaillée utilisateur.
 *
 * Pattern v5 : avatar XL + nom serif italic + meta (email, org, dates) à droite.
 */

import { Avatar } from '@/components/ui/avatar'
import type { UserDetail } from '@/lib/admin/users-types'
import { Calendar, Clock, Mail, MapPin } from 'lucide-react'
import { PlanBadge, StatusBadge } from './UserBadges'

interface UserDetailHeaderProps {
  user: UserDetail
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function UserDetailHeader({ user }: UserDetailHeaderProps) {
  const status = user.subscription?.status ?? user.organization?.plan_status ?? 'trialing'
  const suspended = Boolean(user.organization?.suspended_at)

  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6 rounded-xl border border-rule bg-paper p-6">
      <Avatar
        name={user.full_name ?? user.email}
        size="lg"
        className="size-16 md:size-20 text-2xl"
      />

      <div className="flex-1 min-w-0 space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Utilisateur · {user.user_id.slice(0, 8)}
        </p>
        <h1 className="font-serif italic font-normal text-3xl md:text-4xl tracking-tight text-ink leading-tight">
          {user.full_name ?? user.email}
        </h1>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {user.organization ? <PlanBadge plan={user.organization.plan} /> : null}
          <StatusBadge status={status} suspended={suspended} />
        </div>

        <dl className="grid gap-x-6 gap-y-1 grid-cols-1 sm:grid-cols-2 pt-3 text-[12px] text-ink-mute">
          <div className="flex items-center gap-2">
            <Mail className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
            <dt className="sr-only">Email</dt>
            <dd className="truncate">{user.email}</dd>
          </div>
          {user.organization ? (
            <div className="flex items-center gap-2">
              <MapPin className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
              <dt className="sr-only">Organisation</dt>
              <dd className="truncate">
                {user.organization.name}
                {user.organization.city ? ` · ${user.organization.city}` : ''}
              </dd>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Calendar className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
            <dt className="sr-only">Compte créé</dt>
            <dd>Inscrit le {formatDate(user.created_at)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
            <dt className="sr-only">Dernière activité</dt>
            <dd>Dernière activité {formatDate(user.last_active_at)}</dd>
          </div>
        </dl>
      </div>
    </header>
  )
}
