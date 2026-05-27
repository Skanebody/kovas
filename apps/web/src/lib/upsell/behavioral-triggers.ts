/**
 * KOVAS — Moteur de règles comportementales pour l'upsell (L1).
 *
 * Pure function : prend en entrée le contexte d'un user (events 30j +
 * accès actuel + usage actuel) et retourne une liste de suggestions.
 * Aucun side-effect, aucun appel DB → testable en isolation.
 *
 * Les règles sont volontairement explicites (pas de DSL fancy) : un lecteur
 * doit pouvoir auditer "pourquoi cette suggestion s'est déclenchée" en
 * <30s.
 *
 * Ajout d'une nouvelle règle :
 *   1. Ajouter un cas dans evaluateAllRules
 *   2. Ajouter un test dans behavioral-triggers.test.ts
 *   3. Documenter dans docs/upsell-architecture.md §Règles
 */

import { type UserAccess, tierAtLeast } from './access-control'
import type { BehaviorEventType } from './track-event'

export interface BehaviorEvent {
  type: BehaviorEventType
  data: Record<string, unknown>
  createdAt: Date
}

export interface CurrentUsage {
  missionsCount30d: number
  invoicesCount30d: number
  leadsReceived30d: number
  leadsResponded30d: number
  /** % de quota Whisper consommé (0-100). */
  whisperUsagePct: number
  /** % de quota stockage consommé (0-100). */
  storageUsagePct: number
  /** % de quota missions consommé (0-100). */
  missionsUsagePct: number
  /** % de quota vision consommé (0-100). */
  visionUsagePct: number
}

export interface BehaviorContext {
  userId: string
  events: readonly BehaviorEvent[]
  currentAccess: UserAccess
  currentUsage: CurrentUsage
}

export interface TriggerRuleResult {
  shouldTrigger: boolean
  suggestionType: 'addon' | 'pack' | 'tier_upgrade'
  /** Code addon / pack / tier code. */
  target: string
  /** Phrase courte décrivant la raison (ex: "Vous avez créé 23 factures ce mois"). */
  reasonLabel: string
  /** Bénéfice attendu (ex: "Factur-X économise ~4h/mois"). */
  reasonBenefit: string
  /** Valeur monétaire/temps économisé estimée (€/mois). */
  estimatedValueEur?: number
  /** 0-100, plus haut = priorité affichage. */
  priority: number
}

// ─────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────
function countEvents(events: readonly BehaviorEvent[], type: BehaviorEventType): number {
  let n = 0
  for (const e of events) if (e.type === type) n++
  return n
}

function hasRecentEvent(events: readonly BehaviorEvent[], type: BehaviorEventType): boolean {
  return events.some((e) => e.type === type)
}

const NO_TRIGGER: TriggerRuleResult = {
  shouldTrigger: false,
  suggestionType: 'addon',
  target: '',
  reasonLabel: '',
  reasonBenefit: '',
  priority: 0,
}

// ─────────────────────────────────────────────
// Règle R1 — Factur-X PPF
// >20 factures émises ces 30 jours et l'addon facturx_ppf n'est pas actif
// → suggère l'addon (conformité obligation 2027 + 100 inclus).
// ─────────────────────────────────────────────
function r1FacturX(ctx: BehaviorContext): TriggerRuleResult {
  const emitted = countEvents(ctx.events, 'invoice_emitted')
  const created = countEvents(ctx.events, 'invoice_created')
  const total = Math.max(emitted, created, ctx.currentUsage.invoicesCount30d)
  if (total <= 20) return NO_TRIGGER
  if (ctx.currentAccess.activeAddons.includes('facturx_ppf')) return NO_TRIGGER
  if (ctx.currentAccess.activePacks.includes('pack_cabinet')) return NO_TRIGGER
  return {
    shouldTrigger: true,
    suggestionType: 'addon',
    target: 'facturx_ppf',
    reasonLabel: `Vous avez émis ${total} factures ce mois`,
    reasonBenefit: "Factur-X économise ~4h/mois et vous met en conformité avec l'obligation 2027",
    estimatedValueEur: 80,
    priority: 80,
  }
}

// ─────────────────────────────────────────────
// Règle R2 — Upgrade Pro pour leads
// >5 leads reçus, <30% taux réponse, tier < Pro
// → upgrade Pro (Annuaire Premium + auto-quote + payment-lock).
// ─────────────────────────────────────────────
function r2LeadsResponseRate(ctx: BehaviorContext): TriggerRuleResult {
  const received = ctx.currentUsage.leadsReceived30d
  if (received <= 5) return NO_TRIGGER
  const responded = ctx.currentUsage.leadsResponded30d
  const rate = received === 0 ? 1 : responded / received
  if (rate >= 0.3) return NO_TRIGGER
  if (tierAtLeast(ctx.currentAccess.planCode, 'pro')) return NO_TRIGGER
  return {
    shouldTrigger: true,
    suggestionType: 'tier_upgrade',
    target: 'pro',
    reasonLabel: `${received} leads reçus, ${responded} réponse${responded > 1 ? 's' : ''} (${Math.round(rate * 100)}%)`,
    reasonBenefit:
      'Le forfait Pro débloque auto-quote email et paiement bloqué pour augmenter votre conversion',
    estimatedValueEur: Math.round(received * 0.3 * 300),
    priority: 85,
  }
}

// ─────────────────────────────────────────────
// Règle R3 — Pennylane
// pennylane_attempted présent dans les events sans addon pennylane_sync
// → suggère l'addon.
// ─────────────────────────────────────────────
function r3Pennylane(ctx: BehaviorContext): TriggerRuleResult {
  if (!hasRecentEvent(ctx.events, 'pennylane_attempted')) return NO_TRIGGER
  if (ctx.currentAccess.activeAddons.includes('pennylane_sync')) return NO_TRIGGER
  if (ctx.currentAccess.activePacks.includes('pack_cabinet')) return NO_TRIGGER
  return {
    shouldTrigger: true,
    suggestionType: 'addon',
    target: 'pennylane_sync',
    reasonLabel: 'Vous avez tenté de synchroniser Pennylane',
    reasonBenefit: 'Activation 1 clic, sync automatique missions et factures, ~2h économisées/mois',
    estimatedValueEur: 40,
    priority: 75,
  }
}

// ─────────────────────────────────────────────
// Règle R4 — Whisper quota 80%
// Quota Whisper consommé >80% → suggère le tier supérieur.
// ─────────────────────────────────────────────
function r4WhisperCap(ctx: BehaviorContext): TriggerRuleResult {
  if (ctx.currentUsage.whisperUsagePct < 80) return NO_TRIGGER
  const next = nextTierAbove(ctx.currentAccess.planCode)
  if (!next) return NO_TRIGGER
  return {
    shouldTrigger: true,
    suggestionType: 'tier_upgrade',
    target: next,
    reasonLabel: `Vous avez consommé ${Math.round(ctx.currentUsage.whisperUsagePct)}% de votre quota Whisper`,
    reasonBenefit: `Le forfait ${prettyTier(next)} multiplie votre quota Whisper et débloque plus de capacité`,
    priority: 70,
  }
}

// ─────────────────────────────────────────────
// Règle R5 — Storage 80%
// ─────────────────────────────────────────────
function r5StorageCap(ctx: BehaviorContext): TriggerRuleResult {
  if (ctx.currentUsage.storageUsagePct < 80) return NO_TRIGGER
  const next = nextTierAbove(ctx.currentAccess.planCode)
  if (!next) return NO_TRIGGER
  return {
    shouldTrigger: true,
    suggestionType: 'tier_upgrade',
    target: next,
    reasonLabel: `Votre stockage est à ${Math.round(ctx.currentUsage.storageUsagePct)}% du quota`,
    reasonBenefit: `Le forfait ${prettyTier(next)} double votre capacité de stockage cloud`,
    priority: 65,
  }
}

// ─────────────────────────────────────────────
// Règle R6 — Missions quota 80%
// ─────────────────────────────────────────────
function r6MissionsCap(ctx: BehaviorContext): TriggerRuleResult {
  if (ctx.currentUsage.missionsUsagePct < 80) return NO_TRIGGER
  const next = nextTierAbove(ctx.currentAccess.planCode)
  if (!next) return NO_TRIGGER
  return {
    shouldTrigger: true,
    suggestionType: 'tier_upgrade',
    target: next,
    reasonLabel: `Vous avez utilisé ${Math.round(ctx.currentUsage.missionsUsagePct)}% de votre quota missions`,
    reasonBenefit: `Le forfait ${prettyTier(next)} augmente significativement votre capacité de missions mensuelles`,
    priority: 78,
  }
}

// ─────────────────────────────────────────────
// Règle R7 — Migrer Essential → Découverte
// >30 missions/mois sur tier Essential (quota 30) → suggère Découverte (60).
// ─────────────────────────────────────────────
function r7EssentialToDecouverte(ctx: BehaviorContext): TriggerRuleResult {
  if (ctx.currentAccess.planCode !== 'essential') return NO_TRIGGER
  if (ctx.currentUsage.missionsCount30d < 30) return NO_TRIGGER
  return {
    shouldTrigger: true,
    suggestionType: 'tier_upgrade',
    target: 'decouverte',
    reasonLabel: `${ctx.currentUsage.missionsCount30d} missions ce mois (forfait Essential plafonné à 30)`,
    reasonBenefit: 'Découverte double votre quota mensuel et ajoute templates pièces + check-lists',
    estimatedValueEur: 10,
    priority: 72,
  }
}

// ─────────────────────────────────────────────
// Règle R8 — Analytics attempted sans Pro+
// ─────────────────────────────────────────────
function r8AnalyticsGated(ctx: BehaviorContext): TriggerRuleResult {
  if (!hasRecentEvent(ctx.events, 'analytics_attempted')) return NO_TRIGGER
  if (tierAtLeast(ctx.currentAccess.planCode, 'pro')) return NO_TRIGGER
  return {
    shouldTrigger: true,
    suggestionType: 'tier_upgrade',
    target: 'pro',
    reasonLabel: 'Vous avez consulté Analytics sans accès',
    reasonBenefit: 'Le forfait Pro débloque Analytics, Cockpit ADEME et Annuaire Premium',
    priority: 60,
  }
}

// ─────────────────────────────────────────────
// Règle R9 — Rapport bilingue attempted sans addon
// ─────────────────────────────────────────────
function r9Bilingual(ctx: BehaviorContext): TriggerRuleResult {
  if (!hasRecentEvent(ctx.events, 'bilingual_report_attempted')) return NO_TRIGGER
  if (ctx.currentAccess.activeAddons.includes('bilingual_reports')) return NO_TRIGGER
  if (ctx.currentAccess.activePacks.includes('pack_international')) return NO_TRIGGER
  return {
    shouldTrigger: true,
    suggestionType: 'pack',
    target: 'pack_international',
    reasonLabel: 'Vous avez tenté de générer un rapport bilingue',
    reasonBenefit:
      'Le Pack International groupe rapports bilingues + signatures eIDAS avec -15€/mo vs achat séparé',
    estimatedValueEur: 30,
    priority: 55,
  }
}

// ─────────────────────────────────────────────
// Règle R10 — Vision quota 80%
// ─────────────────────────────────────────────
function r10VisionCap(ctx: BehaviorContext): TriggerRuleResult {
  if (ctx.currentUsage.visionUsagePct < 80) return NO_TRIGGER
  const next = nextTierAbove(ctx.currentAccess.planCode)
  if (!next) return NO_TRIGGER
  return {
    shouldTrigger: true,
    suggestionType: 'tier_upgrade',
    target: next,
    reasonLabel: `Quota Vision IA à ${Math.round(ctx.currentUsage.visionUsagePct)}%`,
    reasonBenefit: `Le forfait ${prettyTier(next)} augmente vos reconnaissances Vision IA mensuelles`,
    priority: 58,
  }
}

// ─────────────────────────────────────────────
// Pipeline complet
// ─────────────────────────────────────────────
const RULES: Array<(ctx: BehaviorContext) => TriggerRuleResult> = [
  r1FacturX,
  r2LeadsResponseRate,
  r3Pennylane,
  r4WhisperCap,
  r5StorageCap,
  r6MissionsCap,
  r7EssentialToDecouverte,
  r8AnalyticsGated,
  r9Bilingual,
  r10VisionCap,
]

export function evaluateAllRules(ctx: BehaviorContext): TriggerRuleResult[] {
  const results: TriggerRuleResult[] = []
  for (const rule of RULES) {
    const r = rule(ctx)
    if (r.shouldTrigger) results.push(r)
  }
  // Tri par priorité descendante
  results.sort((a, b) => b.priority - a.priority)
  return results
}

// ─────────────────────────────────────────────
// Helpers tier upgrade
// ─────────────────────────────────────────────
import type { PricingPlanCode } from '@/lib/pricing-plans'

const TIER_ORDER: readonly PricingPlanCode[] = [
  'essential',
  'decouverte',
  'pro',
  'all_inclusive',
  'cabinet',
] as const

function nextTierAbove(current: PricingPlanCode | null | undefined): PricingPlanCode | null {
  if (!current) return 'decouverte'
  const idx = TIER_ORDER.indexOf(current)
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null
  return TIER_ORDER[idx + 1] ?? null
}

function prettyTier(code: PricingPlanCode): string {
  switch (code) {
    case 'essential':
    case 'essential_legacy':
      return 'Essential'
    case 'decouverte':
    case 'decouverte_legacy':
      return 'Découverte'
    case 'pro':
    case 'pro_legacy':
      return 'Pro'
    case 'all_inclusive':
    case 'all_inclusive_legacy':
      return 'All Inclusive'
    case 'cabinet':
    case 'cabinet_legacy':
      return 'Cabinet'
    case 'logiciel_free':
      return 'Essai 14 jours'
    case 'logiciel_starter':
      return 'Starter'
    case 'logiciel_active':
      return 'Active'
    case 'logiciel_cabinet':
      return 'Cabinet'
    case 'logiciel_enterprise':
      return 'Enterprise'
    default:
      return code
  }
}
