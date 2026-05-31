/**
 * Ligne d'utilisateur dans la liste admin.
 *
 * Rendue par <UsersListTable>. Click → /admin/users/[user_id].
 * Server component (le clic-row navigation se fait via wrapper <Link> dans
 * la table).
 */

import { Avatar } from '@/components/ui/avatar'
import type { UserListItem } from '@/lib/admin/users-types'
import { PlanBadge, StatusBadge } from './UserBadges'

interface UserRowProps {
  user: UserListItem
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const now = Date.now()
  const ts = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000))
  if (diffSec < 60) return "à l'instant"
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `${diffD} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function UserRow({ user }: UserRowProps) {
  return (
    <>
      {/* Avatar + nom + email */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={user.full_name ?? user.email} size="md" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink truncate">
              {user.full_name ?? user.email}
            </p>
            <p className="text-[11px] text-ink-mute truncate">{user.email}</p>
          </div>
        </div>
      </td>

      {/* Org */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <p className="text-[12px] text-ink truncate max-w-[200px]">
          {user.organization_name ?? <span className="text-ink-faint">—</span>}
        </p>
      </td>

      {/* Plan */}
      <td className="px-4 py-3">
        <PlanBadge plan={user.plan} />
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={user.plan_status} suspended={user.suspended} />
      </td>

      {/* Missions ce mois */}
      <td className="px-4 py-3 font-mono text-[12px] text-ink hidden sm:table-cell">
        {user.missions_this_month}
      </td>

      {/* Lifetime revenue */}
      <td className="px-4 py-3 font-mono text-[12px] text-ink hidden lg:table-cell">
        {formatEur(user.lifetime_revenue_cents)}
      </td>

      {/* Last activity */}
      <td className="px-4 py-3 text-[11px] text-ink-mute hidden md:table-cell">
        {relativeTime(user.last_active_at ?? user.created_at)}
      </td>
    </>
  )
}
