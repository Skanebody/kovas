/**
 * KOVAS — Système 14 : Competitive intelligence — analyse Claude.
 *
 * Helper pour générer un prompt Claude Sonnet qui contextualise les
 * changements détectés (SnapshotDiff) et estime leur impact business sur
 * KOVAS. Pure function — la function génère le prompt + parse la réponse
 * JSON renvoyée par Claude, sans appel API direct.
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §17.
 *
 * Le caller (Edge Function ou job) fait :
 *   1. const prompt = buildAnalysisPrompt(diff)
 *   2. const raw = await callClaude({ system, user: prompt, model: 'sonnet' })
 *   3. const parsed = parseClaudeImpactResponse(JSON.parse(raw))
 *
 * Déterministe (modulo Claude lui-même), testable, zéro IO.
 */

import { getCompetitor } from './competitors'
import type { SnapshotDiff } from './snapshot-diff'

export type ImpactLevel = 'low' | 'medium' | 'high'

export type AffectedArea = 'pricing' | 'features' | 'positioning' | 'marketing' | 'product'

export interface CompetitiveImpactAnalysis {
  /** Analyse synthétique 1-2 phrases */
  summary: string
  /** Niveau d'impact estimé sur KOVAS */
  impact_on_kovas: ImpactLevel
  /** 1 à 3 actions recommandées */
  recommended_actions: string[]
  /** Domaines KOVAS impactés */
  affected_areas: AffectedArea[]
}

/** Format JSON brut attendu en sortie Claude (avant validation). */
export interface RawClaudeImpactResponse {
  summary: string
  impact: string
  actions: string[]
  areas: string[]
}

const VALID_IMPACT_LEVELS: ReadonlyArray<ImpactLevel> = ['low', 'medium', 'high']
const VALID_AREAS: ReadonlyArray<AffectedArea> = [
  'pricing',
  'features',
  'positioning',
  'marketing',
  'product',
]

const KOVAS_CONTEXT = `Contexte KOVAS :
- SaaS B2B pour diagnostiqueurs immobiliers indépendants français (~13 000 cibles)
- Positionnement : alternative moderne mobile-first à Liciel (40-52% PdM)
- Focus 8 diagnostics standards : DPE, Amiante, Plomb CREP, Gaz, Électricité, Termites, Carrez/Boutin, ERP (92% du volume métier FR)
- Pricing V5 actuel (Phase 1 Logiciel) : Solo 29€/mo · Pro 79€/mo · Cabinet 199€/mo · Cabinet+ 499€/mo
- Track Annuaire : Présence 19€ · Boost 39€ · Premium 79€
- Différenciateurs Phase 1 : saisie vocale terrain hybride, exports multi-format universels (incl. ZIP Liciel), UX migration 30s-1min vs 1h30-2h re-saisie
- Phase 2 (M10-M18) : certification ADEME 3CL-2021 + Vision IA équipement + recos post-DPE F/G
- Solopreneur, ~24 mois runway, objectif 1 M€ ARR à M24`

/**
 * Construit le prompt Claude qui demande une analyse business du diff.
 *
 * @example
 * ```ts
 * const prompt = buildAnalysisPrompt(diff)
 * // → "Tu es analyste compétitif KOVAS..."
 * ```
 */
export function buildAnalysisPrompt(diff: SnapshotDiff): string {
  const competitor = getCompetitor(diff.competitor_slug)
  const competitorName = competitor?.name ?? diff.competitor_slug
  const marketShare =
    competitor?.market_share_pct != null ? ` (${competitor.market_share_pct}% PdM)` : ''
  const threatLabel = competitor?.is_major_threat
    ? 'Menace stratégique majeure'
    : 'Concurrent secondaire'

  const changesBlock = diff.changes.length
    ? diff.changes
        .map((c, i) => `${i + 1}. [${c.severity.toUpperCase()}] ${c.type} — ${c.detail}`)
        .join('\n')
    : '(aucun changement structuré détecté)'

  return `Tu es analyste compétitif KOVAS. Analyse les changements détectés sur le site d'un concurrent et estime leur impact business sur KOVAS.

${KOVAS_CONTEXT}

Concurrent observé : ${competitorName}${marketShare} — ${threatLabel}
URL : ${diff.url}
Période : ${diff.previous_fetched_at} → ${diff.current_fetched_at}

Changements détectés (${diff.changes.length} signal(aux)) :
${changesBlock}

Résumé extracteur : ${diff.summary}

Renvoie STRICTEMENT un JSON valide avec ces 4 champs (rien d'autre, pas de markdown) :
{
  "summary": "1-2 phrases d'analyse business synthétique (que signifie ce changement pour KOVAS ?)",
  "impact": "low" | "medium" | "high",
  "actions": ["action 1", "action 2", "action 3 (optionnel)"],
  "areas": ["pricing" | "features" | "positioning" | "marketing" | "product", ...]
}

Règles :
- impact = "high" uniquement si le concurrent change son pricing OU lance une feature directement concurrente d'un différenciateur KOVAS Phase 1.
- impact = "medium" si le changement signale un repositionnement marketing ou un investissement produit.
- impact = "low" si changement cosmétique / éditorial sans implication business directe.
- actions : 1 à 3 max, chacune < 200 chars, actionnables (pas de généralités).
- areas : sous-ensemble strict de ["pricing", "features", "positioning", "marketing", "product"].`
}

function normalizeImpact(raw: string): ImpactLevel {
  const lower = (raw ?? '').toLowerCase().trim()
  if (VALID_IMPACT_LEVELS.includes(lower as ImpactLevel)) {
    return lower as ImpactLevel
  }
  return 'low'
}

function normalizeAreas(raw: string[]): AffectedArea[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<AffectedArea>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const lower = item.toLowerCase().trim() as AffectedArea
    if (VALID_AREAS.includes(lower)) {
      seen.add(lower)
    }
  }
  return Array.from(seen)
}

function normalizeActions(raw: string[]): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((a): a is string => typeof a === 'string')
    .map((a) => a.trim())
    .filter((a) => a.length > 0 && a.length < 200)
    .slice(0, 3)
}

function normalizeSummary(raw: string): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, 500)
}

/**
 * Parse + valide la réponse Claude JSON.
 *
 * Tous les champs invalides sont nettoyés (impact default 'low', areas filtrées,
 * actions plafonnées à 3 et < 200 chars).
 *
 * @example
 * ```ts
 * const parsed = parseClaudeImpactResponse({
 *   summary: 'Liciel baisse son prix entrée...',
 *   impact: 'high',
 *   actions: ['Réviser pricing Solo', 'Comm défensive blog'],
 *   areas: ['pricing', 'marketing'],
 * })
 * ```
 */
export function parseClaudeImpactResponse(raw: RawClaudeImpactResponse): CompetitiveImpactAnalysis {
  return {
    summary: normalizeSummary(raw?.summary ?? ''),
    impact_on_kovas: normalizeImpact(raw?.impact ?? ''),
    recommended_actions: normalizeActions(raw?.actions ?? []),
    affected_areas: normalizeAreas(raw?.areas ?? []),
  }
}
