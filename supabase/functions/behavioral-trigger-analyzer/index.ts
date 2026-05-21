// Edge Function: behavioral-trigger-analyzer
// Cron: 0 4 * * * UTC (5h CET, batch quotidien)
//
// Pour chaque user avec subscription active :
//   1. Récupère user_behavior_events 30 derniers jours
//   2. Calcule currentUsage (missions, factures, leads, quotas)
//   3. Récupère currentAccess (plan_code, addons actifs)
//   4. Évalue les 10 règles métier (cf. behavioral-triggers.ts dans apps/web)
//   5. Insère les suggestions dans upsell_suggestions (anti-doublon)
//
// Auth : Bearer CRON_SECRET
// Idempotent : ne re-crée pas une suggestion existante < 30j en pending/shown_in_app

// @ts-nocheck — Deno runtime (Supabase Edge Functions). Le worktree principal
// utilise tsc Node — ce fichier est typé séparément à l'exécution Deno.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUGGESTION_DEDUPE_DAYS = 30

interface UserActiveRow {
  user_id: string
  organization_id: string
  plan_code: string | null
  tier: string | null
}

interface BehaviorEventRow {
  event_type: string
  event_data: Record<string, unknown> | null
  created_at: string
}

interface UserAddonRow {
  module_code: string
  status: string
}

interface SuggestionInsert {
  user_id: string
  suggestion_type: 'addon' | 'pack' | 'tier_upgrade'
  suggested_target: string
  reason_label: string
  reason_benefit: string
  estimated_value_eur: number | null
  priority: number
}

// ─────────────────────────────────────────────
// Règles (mirror simplifié de apps/web/src/lib/upsell/behavioral-triggers.ts)
// ─────────────────────────────────────────────
const PLAN_RANK: Record<string, number> = {
  essential: 1,
  decouverte: 2,
  pro: 3,
  all_inclusive: 4,
  cabinet: 5,
}
const TIER_ORDER = ['essential', 'decouverte', 'pro', 'all_inclusive', 'cabinet']

function planRank(code: string | null): number {
  if (!code) return 0
  return PLAN_RANK[code] ?? 0
}

function tierAtLeast(current: string | null, min: string): boolean {
  return planRank(current) >= planRank(min)
}

function nextTierAbove(current: string | null): string | null {
  if (!current) return 'decouverte'
  const idx = TIER_ORDER.indexOf(current)
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null
  return TIER_ORDER[idx + 1]
}

function prettyTier(code: string): string {
  const m: Record<string, string> = {
    essential: 'Essential',
    decouverte: 'Découverte',
    pro: 'Pro',
    all_inclusive: 'All Inclusive',
    cabinet: 'Cabinet',
  }
  return m[code] ?? code
}

function countEvents(events: BehaviorEventRow[], type: string): number {
  return events.filter((e) => e.event_type === type).length
}

function hasEvent(events: BehaviorEventRow[], type: string): boolean {
  return events.some((e) => e.event_type === type)
}

function evaluateRules(
  planCode: string | null,
  activeAddons: Set<string>,
  activePacks: Set<string>,
  events: BehaviorEventRow[],
  usage: {
    invoicesCount30d: number
    leadsReceived30d: number
    leadsResponded30d: number
    whisperUsagePct: number
    storageUsagePct: number
    missionsUsagePct: number
    visionUsagePct: number
    missionsCount30d: number
  },
): SuggestionInsert[] {
  const out: SuggestionInsert[] = []

  // R1 — Factur-X
  const invoicesEvts = Math.max(
    countEvents(events, 'invoice_emitted'),
    countEvents(events, 'invoice_created'),
    usage.invoicesCount30d,
  )
  if (invoicesEvts > 20 && !activeAddons.has('facturx_ppf') && !activePacks.has('pack_cabinet')) {
    out.push({
      user_id: '',
      suggestion_type: 'addon',
      suggested_target: 'facturx_ppf',
      reason_label: `Vous avez émis ${invoicesEvts} factures ce mois`,
      reason_benefit: "Factur-X économise ~4h/mois et vous met en conformité avec l'obligation 2027",
      estimated_value_eur: 80,
      priority: 80,
    })
  }

  // R2 — Leads response rate < 30%
  const received = usage.leadsReceived30d
  const responded = usage.leadsResponded30d
  if (received > 5) {
    const rate = received === 0 ? 1 : responded / received
    if (rate < 0.3 && !tierAtLeast(planCode, 'pro')) {
      out.push({
        user_id: '',
        suggestion_type: 'tier_upgrade',
        suggested_target: 'pro',
        reason_label: `${received} leads reçus, ${responded} réponse(s) (${Math.round(rate * 100)}%)`,
        reason_benefit: 'Le forfait Pro débloque auto-quote email et paiement bloqué pour augmenter votre conversion',
        estimated_value_eur: Math.round(received * 0.3 * 300),
        priority: 85,
      })
    }
  }

  // R3 — Pennylane attempted
  if (hasEvent(events, 'pennylane_attempted') && !activeAddons.has('pennylane_sync') && !activePacks.has('pack_cabinet')) {
    out.push({
      user_id: '',
      suggestion_type: 'addon',
      suggested_target: 'pennylane_sync',
      reason_label: 'Vous avez tenté de synchroniser Pennylane',
      reason_benefit: 'Activation 1 clic, sync automatique missions et factures, ~2h économisées/mois',
      estimated_value_eur: 40,
      priority: 75,
    })
  }

  // R4 — Whisper cap
  if (usage.whisperUsagePct >= 80) {
    const next = nextTierAbove(planCode)
    if (next) {
      out.push({
        user_id: '',
        suggestion_type: 'tier_upgrade',
        suggested_target: next,
        reason_label: `Vous avez consommé ${Math.round(usage.whisperUsagePct)}% de votre quota Whisper`,
        reason_benefit: `Le forfait ${prettyTier(next)} multiplie votre quota Whisper et débloque plus de capacité`,
        estimated_value_eur: null,
        priority: 70,
      })
    }
  }

  // R5 — Storage cap
  if (usage.storageUsagePct >= 80) {
    const next = nextTierAbove(planCode)
    if (next) {
      out.push({
        user_id: '',
        suggestion_type: 'tier_upgrade',
        suggested_target: next,
        reason_label: `Votre stockage est à ${Math.round(usage.storageUsagePct)}% du quota`,
        reason_benefit: `Le forfait ${prettyTier(next)} double votre capacité de stockage cloud`,
        estimated_value_eur: null,
        priority: 65,
      })
    }
  }

  // R6 — Missions cap
  if (usage.missionsUsagePct >= 80) {
    const next = nextTierAbove(planCode)
    if (next) {
      out.push({
        user_id: '',
        suggestion_type: 'tier_upgrade',
        suggested_target: next,
        reason_label: `Vous avez utilisé ${Math.round(usage.missionsUsagePct)}% de votre quota missions`,
        reason_benefit: `Le forfait ${prettyTier(next)} augmente significativement votre capacité de missions mensuelles`,
        estimated_value_eur: null,
        priority: 78,
      })
    }
  }

  // R7 — Essential → Découverte
  if (planCode === 'essential' && usage.missionsCount30d >= 30) {
    out.push({
      user_id: '',
      suggestion_type: 'tier_upgrade',
      suggested_target: 'decouverte',
      reason_label: `${usage.missionsCount30d} missions ce mois (forfait Essential plafonné à 30)`,
      reason_benefit: 'Découverte double votre quota mensuel et ajoute templates pièces + check-lists',
      estimated_value_eur: 10,
      priority: 72,
    })
  }

  // R8 — Analytics attempted
  if (hasEvent(events, 'analytics_attempted') && !tierAtLeast(planCode, 'pro')) {
    out.push({
      user_id: '',
      suggestion_type: 'tier_upgrade',
      suggested_target: 'pro',
      reason_label: 'Vous avez consulté Analytics sans accès',
      reason_benefit: 'Le forfait Pro débloque Analytics, Cockpit ADEME et Annuaire Premium',
      estimated_value_eur: null,
      priority: 60,
    })
  }

  // R9 — Bilingual attempted
  if (
    hasEvent(events, 'bilingual_report_attempted') &&
    !activeAddons.has('bilingual_reports') &&
    !activePacks.has('pack_international')
  ) {
    out.push({
      user_id: '',
      suggestion_type: 'pack',
      suggested_target: 'pack_international',
      reason_label: 'Vous avez tenté de générer un rapport bilingue',
      reason_benefit:
        'Le Pack International groupe rapports bilingues + signatures eIDAS avec -15€/mo vs achat séparé',
      estimated_value_eur: 30,
      priority: 55,
    })
  }

  // R10 — Vision cap
  if (usage.visionUsagePct >= 80) {
    const next = nextTierAbove(planCode)
    if (next) {
      out.push({
        user_id: '',
        suggestion_type: 'tier_upgrade',
        suggested_target: next,
        reason_label: `Quota Vision IA à ${Math.round(usage.visionUsagePct)}%`,
        reason_benefit: `Le forfait ${prettyTier(next)} augmente vos reconnaissances Vision IA mensuelles`,
        estimated_value_eur: null,
        priority: 58,
      })
    }
  }

  return out.sort((a, b) => b.priority - a.priority)
}

// ─────────────────────────────────────────────
// HTTP handler
// ─────────────────────────────────────────────
Deno.serve(async (req) => {
  // Auth Bearer CRON_SECRET
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const authHeader = req.headers.get('authorization') ?? ''
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // 1. Récupère les users avec abonnement actif
  // NB : la relation user ↔ organization passe par organizations.owner_user_id
  // ou par les memberships. Pour la phase 1 (solopreneur), 1 org = 1 owner.
  const { data: subsRaw } = await supabase
    .from('subscriptions')
    .select(
      'organization_id, plan_code, tier, status, missions_included, organizations!inner(owner_user_id)',
    )
    .in('status', ['trialing', 'active'])

  type SubRow = {
    organization_id: string
    plan_code: string | null
    tier: string | null
    status: string
    missions_included: number | null
    organizations: { owner_user_id: string } | null
  }

  const subs = (subsRaw ?? []) as SubRow[]
  let totalInserts = 0
  let totalSkipped = 0

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const dedupeCutoff = new Date(Date.now() - SUGGESTION_DEDUPE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  for (const sub of subs) {
    const ownerId = sub.organizations?.owner_user_id
    if (!ownerId) {
      totalSkipped++
      continue
    }

    // 2. Events 30j
    const { data: eventsRaw } = await supabase
      .from('user_behavior_events')
      .select('event_type, event_data, created_at')
      .eq('user_id', ownerId)
      .gte('created_at', thirtyDaysAgo)
      .limit(500)
    const events = (eventsRaw ?? []) as BehaviorEventRow[]

    // 3. Addons actifs
    const { data: addonsRaw } = await supabase
      .from('user_addons')
      .select('status, addon_modules!inner(module_code)')
      .eq('organization_id', sub.organization_id)
      .in('status', ['active', 'trialing'])
    const activeAddons = new Set<string>()
    const activePacks = new Set<string>()
    const PACK_CODES = new Set(['pack_growth', 'pack_cabinet', 'pack_international'])
    for (const row of addonsRaw ?? []) {
      const code = (row as { addon_modules?: { module_code?: string } }).addon_modules?.module_code
      if (!code) continue
      if (PACK_CODES.has(code)) activePacks.add(code)
      else activeAddons.add(code)
    }

    // 4. Usage : missions / factures / leads + quotas (best-effort)
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    const [
      { count: missionsCount30d },
      { count: invoicesCount30d },
      { count: leadsReceived30d },
      { count: leadsResponded30d },
    ] = await Promise.all([
      supabase
        .from('missions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', sub.organization_id)
        .is('deleted_at', null)
        .gte('created_at', thirtyDaysAgo),
      supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', sub.organization_id)
        .gte('created_at', thirtyDaysAgo),
      supabase
        .from('user_behavior_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', ownerId)
        .eq('event_type', 'lead_received')
        .gte('created_at', thirtyDaysAgo),
      supabase
        .from('user_behavior_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', ownerId)
        .eq('event_type', 'lead_responded')
        .gte('created_at', thirtyDaysAgo),
    ])

    const missionsIncluded = sub.missions_included ?? 0
    const missionsUsagePct =
      missionsIncluded > 0 ? Math.min(100, ((missionsCount30d ?? 0) / missionsIncluded) * 100) : 0

    // Quotas Whisper / storage / vision : depuis user_usage_quotas si dispo
    let whisperUsagePct = 0
    let storageUsagePct = 0
    let visionUsagePct = 0
    try {
      const { data: quotasRow } = await supabase
        .from('user_usage_quotas')
        .select(
          'whisper_seconds_used, whisper_seconds_cap, storage_bytes_used, storage_bytes_cap, vision_calls_used, vision_calls_cap',
        )
        .eq('organization_id', sub.organization_id)
        .maybeSingle()
      const q = quotasRow as
        | {
            whisper_seconds_used: number | null
            whisper_seconds_cap: number | null
            storage_bytes_used: number | null
            storage_bytes_cap: number | null
            vision_calls_used: number | null
            vision_calls_cap: number | null
          }
        | null
      if (q?.whisper_seconds_cap && q.whisper_seconds_cap > 0) {
        whisperUsagePct = Math.min(100, ((q.whisper_seconds_used ?? 0) / q.whisper_seconds_cap) * 100)
      }
      if (q?.storage_bytes_cap && q.storage_bytes_cap > 0) {
        storageUsagePct = Math.min(100, ((q.storage_bytes_used ?? 0) / q.storage_bytes_cap) * 100)
      }
      if (q?.vision_calls_cap && q.vision_calls_cap > 0) {
        visionUsagePct = Math.min(100, ((q.vision_calls_used ?? 0) / q.vision_calls_cap) * 100)
      }
    } catch {
      // Si la table n'existe pas, on garde 0 — pas de blocking
    }

    // 5. Évalue les règles
    const suggestions = evaluateRules(sub.plan_code ?? sub.tier, activeAddons, activePacks, events, {
      invoicesCount30d: invoicesCount30d ?? 0,
      leadsReceived30d: leadsReceived30d ?? 0,
      leadsResponded30d: leadsResponded30d ?? 0,
      whisperUsagePct,
      storageUsagePct,
      missionsUsagePct,
      visionUsagePct,
      missionsCount30d: missionsCount30d ?? 0,
    })

    // 6. Pour chaque suggestion : vérifie qu'il n'y en a pas déjà une pending
    // ou shown_in_app < 30j → si non, insert.
    for (const sugg of suggestions) {
      const { data: existing } = await supabase
        .from('upsell_suggestions')
        .select('id')
        .eq('user_id', ownerId)
        .eq('suggested_target', sugg.suggested_target)
        .in('status', ['pending', 'shown_in_app'])
        .gte('created_at', dedupeCutoff)
        .limit(1)
      if (existing && existing.length > 0) {
        totalSkipped++
        continue
      }
      const { error: insErr } = await supabase.from('upsell_suggestions').insert({
        user_id: ownerId,
        suggestion_type: sugg.suggestion_type,
        suggested_target: sugg.suggested_target,
        reason_label: sugg.reason_label,
        reason_benefit: sugg.reason_benefit,
        estimated_value_eur: sugg.estimated_value_eur,
        priority: sugg.priority,
        status: 'pending',
      })
      if (!insErr) totalInserts++
    }
  }

  return new Response(
    JSON.stringify({ analyzed: subs.length, inserts: totalInserts, skipped: totalSkipped }),
    { headers: { 'content-type': 'application/json' } },
  )
})
