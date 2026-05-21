import { AppPageHeader } from '@/components/app-page-header'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getQuotaForPlan } from '@/lib/diagnosticians/listing-level'
import { asUntyped } from '@/lib/diagnosticians/supabase-untyped'
import type { Metadata } from 'next'
import { LeadsListClient } from './leads-list-client'

export const metadata: Metadata = { title: 'Leads' }

interface DiagRow {
  id: string
  display_name: string | null
  claim_status: string
}

interface LeadRow {
  id: string
  requester_first_name: string | null
  requester_last_name: string | null
  property_city: string | null
  property_postal_code: string | null
  property_type: string | null
  property_surface_m2: number | null
  diagnostics_requested: string[] | null
  created_at: string
  status: string
}

interface UnlockRow {
  quote_request_id: string
  unlocked_at: string
}

interface SubRow {
  plan_code: string | null
  tier: string | null
}

export default async function LeadsPage() {
  const { user, supabase } = await getCurrentUser()
  const sb = asUntyped(supabase)

  // 1. Liste les diagnosticians claimed par cet user
  const { data: diagsRaw } = await sb
    .from('diagnosticians')
    .select('id, display_name, claim_status')
    .eq('claimed_by_user_id', user.id)

  const diags = (diagsRaw ?? []) as DiagRow[]
  const diagIds = diags.map((d) => d.id)

  // 2. Liste tous les leads pour ces diags
  let leads: LeadRow[] = []
  if (diagIds.length > 0) {
    const { data } = await sb
      .from('quote_requests')
      .select(
        'id, requester_first_name, requester_last_name, property_city, property_postal_code, property_type, property_surface_m2, diagnostics_requested, created_at, status',
      )
      .in('diagnostician_id', diagIds)
      .order('created_at', { ascending: false })
      .limit(200)
    leads = (data ?? []) as LeadRow[]
  }

  // 3. Liste les unlocks de l'user
  let unlockedIds = new Set<string>()
  if (diagIds.length > 0) {
    const { data: unlocksRaw } = await sb
      .from('quote_request_unlocks')
      .select('quote_request_id, unlocked_at')
      .eq('user_id', user.id)
    const unlocks = (unlocksRaw ?? []) as UnlockRow[]
    unlockedIds = new Set(unlocks.map((u) => u.quote_request_id))
  }

  // 4. Quota mensuel d'après le plan
  const { data: subRaw } = await sb
    .from('subscriptions')
    .select('plan_code, tier')
    .eq('user_id', user.id)
    .maybeSingle<SubRow>()

  const plan = subRaw?.plan_code ?? subRaw?.tier ?? null
  const quotaMax = getQuotaForPlan(plan)

  // 5. Unlocks du mois pour calculer le restant
  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1)
  startOfMonth.setUTCHours(0, 0, 0, 0)
  let unlocksThisMonth = 0
  if (diagIds.length > 0) {
    const { count } = await sb
      .from('quote_request_unlocks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('unlocked_at', startOfMonth.toISOString())
    unlocksThisMonth = count ?? 0
  }

  const remaining =
    quotaMax === Number.POSITIVE_INFINITY ? -1 : Math.max(0, quotaMax - unlocksThisMonth)
  const quotaDisplay = quotaMax === Number.POSITIVE_INFINITY ? '∞' : String(quotaMax)
  const remainingDisplay = remaining === -1 ? '∞' : String(remaining)

  const leadsWithStatus = leads.map((l) => ({
    ...l,
    unlocked: unlockedIds.has(l.id),
  }))

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Vos"
        accent="leads"
        description="Demandes de devis reçues via votre fiche annuaire publique."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Reçus ce mois" value={leads.length} />
        <KpiCard label="Déverrouillés" value={unlocksThisMonth} />
        <KpiCard
          label="Quota restant"
          value={remainingDisplay}
          sub={`sur ${quotaDisplay}`}
          accent={remaining === 0}
        />
      </div>

      <LeadsListClient leads={leadsWithStatus} diags={diags} />
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: number | string
  sub?: string
  accent?: boolean
}) {
  return (
    <Card variant="flat" padding="default">
      <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-ink-mute">{label}</p>
      <p
        className={
          accent
            ? 'mt-2 text-3xl font-serif italic font-normal text-[#D4F542]'
            : 'mt-2 text-3xl font-serif italic font-normal text-ink'
        }
      >
        {value}
      </p>
      {sub ? <p className="text-xs text-ink-mute mt-1">{sub}</p> : null}
    </Card>
  )
}
