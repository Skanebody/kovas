import { Badge } from '@/components/ui/badge'
import { getCurrentUser } from '@/lib/auth/current-user'
import { cn } from '@/lib/utils'
import { CreditCard } from 'lucide-react'
import Link from 'next/link'

/**
 * Widget mini "consommation mensuelle" dans le header app.
 * Cf. CLAUDE.md §5 — UX anti-friction paiement (transparence permanente).
 */
export async function UsageWidget() {
  const { supabase, orgId } = await getCurrentUser()

  const [{ data: sub }, { count: monthMissions }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('tier, missions_included, status')
      .eq('organization_id', orgId)
      .maybeSingle(),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte(
        'created_at',
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      ),
  ])

  const count = monthMissions ?? 0
  const included = sub?.missions_included ?? null

  // Pas d'abonnement → essai
  if (!sub || sub.status !== 'active') {
    return (
      <Link
        href="/app/account"
        className="hidden md:inline-flex items-center gap-1.5 text-xs text-ink-mute hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
      >
        <CreditCard className="size-3.5" />
        <span>
          Essai · {count} mission{count > 1 ? 's' : ''}
        </span>
      </Link>
    )
  }

  const ratio = included ? count / included : 0
  const overage = included ? Math.max(0, count - included) : 0

  return (
    <Link
      href="/app/account"
      className="hidden md:inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md hover:bg-muted transition-colors"
    >
      <CreditCard className="size-3.5 text-ink-mute" />
      <span className={cn(ratio > 1 ? 'text-accent-orange font-medium' : 'text-ink-mute')}>
        {count}/{included} missions
      </span>
      {overage > 0 && (
        <Badge variant="orange" className="ml-1 text-[10px] py-0">
          +{overage}
        </Badge>
      )}
    </Link>
  )
}
