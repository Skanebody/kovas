import { Badge } from '@/components/ui/badge'
import { getCurrentUser } from '@/lib/auth/current-user'
import { cn } from '@/lib/utils'
import { CreditCard, Infinity as InfinityIcon } from 'lucide-react'
import Link from 'next/link'

/**
 * Widget mini "consommation mensuelle" dans le header app.
 * Cf. CLAUDE.md §5 — UX anti-friction paiement (transparence permanente).
 *
 * Comportement :
 *  - Pas d'abonnement actif → "Essai · X missions"
 *  - Forfait illimité (Volume, All Inclusive, Cabinet, tiers V3 ≥ active) →
 *    "X missions · Illimité" (pas de ratio, pas de jauge)
 *  - Forfait avec quota (Essential, Découverte, Pro) →
 *    "X / N missions" + badge orange si dépassement
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
        href="/dashboard/account"
        className="hidden md:inline-flex items-center gap-1.5 text-xs text-ink-mute hover:text-ink transition-colors px-2 py-1 rounded-md hover:bg-cream-deep"
      >
        <CreditCard className="size-3.5" />
        <span>
          Essai · {count} mission{count > 1 ? 's' : ''}
        </span>
      </Link>
    )
  }

  // Tiers "illimité" : Volume legacy, All Inclusive, Cabinet, ou seuil >= 9000
  // (la subscription seed du compte démo affiche missions_included=99999
  // ce qui n'a pas de sens à afficher tel quel).
  const unlimitedTiers = new Set<string>([
    'volume',
    'all_inclusive',
    'all_inclusive_legacy',
    'cabinet',
    'cabinet_legacy',
    'logiciel_active',
    'logiciel_cabinet',
    'logiciel_enterprise',
  ])
  const isUnlimited =
    unlimitedTiers.has(sub.tier ?? '') || (included !== null && included >= 9000)

  if (isUnlimited) {
    return (
      <Link
        href="/dashboard/account"
        className="hidden md:inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md hover:bg-cream-deep transition-colors"
        title="Forfait illimité"
      >
        <InfinityIcon className="size-3.5 text-ink-mute" strokeWidth={1.5} />
        <span className="text-ink-mute">
          {count} mission{count > 1 ? 's' : ''} · Illimité
        </span>
      </Link>
    )
  }

  const ratio = included ? count / included : 0
  const overage = included ? Math.max(0, count - included) : 0

  return (
    <Link
      href="/dashboard/account"
      className="hidden md:inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md hover:bg-cream-deep transition-colors"
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
