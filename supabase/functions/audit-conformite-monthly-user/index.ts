/**
 * KOVAS — Edge Function : audit-conformite-monthly-user (Upsell #3 Bouclier Conformité).
 *
 * Worker monomission appelé soit par l'orchestrator `audit-conformite-monthly`
 * (cron mensuel 1er du mois 6h UTC), soit directement (replay manuel admin).
 *
 * Workflow :
 *   1. Reçoit POST { user_id, month_year? } + Bearer CRON_SECRET.
 *   2. Idempotency : si rapport déjà présent pour (user, month) → 200 ok + skipped.
 *   3. Charge les missions du user sur les 30 derniers jours (window principale)
 *      ainsi qu'un lookback 12 mois (pour DPE shopping + class jump historiques).
 *   4. Charge les pre_export_analyses associées (findings agrégés).
 *   5. Lance les 5 risk detectors via le module partagé `lib/risk/risk-signals.ts`
 *      (copié inline dans cette fonction — pas de cross-import Deno/Node).
 *   6. Agrège score global + top 5 missions à risque.
 *   7. Appelle l'assistant cloud (modèle générateur) pour produire le plan de
 *      remédiation narratif par mission à risque (budget ~0.069 € / rapport).
 *   8. INSERT dans `audit_conformite_reports` : month_year, score_global,
 *      missions_count, high_risk_missions (JSONB), pdf_url (placeholder V1),
 *      ai_cost_eur.
 *   9. Return 200 { ok: true, report_id, score_global, high_risk_count }.
 *
 * Auth : `Authorization: Bearer <CRON_SECRET>`.
 *
 * Variables d'env requises :
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - CRON_SECRET
 *   - ANTHROPIC_API_KEY (clé du fournisseur LLM cloud)
 *
 * Variables d'env optionnelles :
 *   - REMEDIATION_MODEL          (défaut: "claude-sonnet-4-5")
 *   - REMEDIATION_MAX_TOKENS     (défaut: 3000)
 *
 * AUCUNE mention de provider IA tiers dans les variables exposées au schéma DB
 * ou aux logs côté utilisateur (directive transversale). On garde `ai_cost_eur`
 * neutre. Les appels HTTP au fournisseur sont strictement encapsulés ici.
 *
 * Authority : CLAUDE.md + brief Bouclier Conformité 2026-05-26.
 */

// @ts-nocheck — Deno-only Edge Function ; non compilée par tsc Node.

import { createClient } from 'jsr:@supabase/supabase-js@2'

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Constantes                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

const PRIMARY_WINDOW_DAYS = 30
const HISTORY_LOOKBACK_DAYS = 365
const DEFAULT_MODEL = 'claude-sonnet-4-5'
const DEFAULT_MAX_TOKENS = 3000

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Types — Risk Signal (mirror du module partagé lib/risk/risk-signals.ts)    */
/* ─────────────────────────────────────────────────────────────────────────── */

type RiskSignalType =
  | 'dpe_shopping'
  | 'cadastre_mismatch'
  | 'class_jump'
  | 'aberrant_data'
  | 'pattern_recurrent'

type RiskSeverity = 'low' | 'medium' | 'high' | 'critical'

interface RiskSignal {
  type: RiskSignalType
  severity: RiskSeverity
  missionId: string
  description: string
  evidence: Record<string, unknown>
}

interface Mission {
  id: string
  type: string
  createdAt: string
  completedAt?: string | null
  propertyId: string
  address?: string | null
  cadastreSection?: string | null
  cadastreNumber?: string | null
  cadastrePrefix?: string | null
  surfaceCarrez?: number | null
  surfaceBoutin?: number | null
  surfaceTotal?: number | null
  surfaceCadastre?: number | null
  surfaceDpe?: number | null
  dpeLetter?: string | null
  gesLetter?: string | null
  energyValue?: number | null
  gesValue?: number | null
  numeroDpe?: string | null
  heatingPowerKw?: number | null
  hasTravauxDocumented?: boolean | null
  yearBuilt?: number | null
  preExportFindingTypes?: string[] | null
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Risk detectors (logique mirror — duplication contrôlée Edge/Next)          */
/* ─────────────────────────────────────────────────────────────────────────── */

const SEVERITY_WEIGHTS: Record<RiskSeverity, number> = {
  low: 2,
  medium: 5,
  high: 12,
  critical: 25,
}

const ENERGY_CLASS_ORDER: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
}

function classRank(letter: string | null | undefined): number | null {
  if (!letter) return null
  return ENERGY_CLASS_ORDER[letter.toUpperCase()] ?? null
}

function propertyKey(m: Mission): string | null {
  if (m.cadastreSection && m.cadastreNumber) {
    return `cad:${m.cadastrePrefix ?? ''}-${m.cadastreSection}-${m.cadastreNumber}`
  }
  const addr = m.address?.trim().toLowerCase()
  if (addr && addr.length > 5) return `addr:${addr.replace(/\s+/g, ' ')}`
  return null
}

function monthsBetween(a: string, b: string): number {
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  if (Number.isNaN(da) || Number.isNaN(db)) return 0
  return Math.abs(db - da) / (1000 * 60 * 60 * 24 * 30.4375)
}

function detectDpeShopping(missions: Mission[]): RiskSignal[] {
  const signals: RiskSignal[] = []
  const dpes = missions.filter((m) => m.type === 'dpe' && classRank(m.dpeLetter) !== null)
  const byProp = new Map<string, Mission[]>()
  for (const m of dpes) {
    const key = propertyKey(m)
    if (!key) continue
    const arr = byProp.get(key) ?? []
    arr.push(m)
    byProp.set(key, arr)
  }
  for (const [key, group] of byProp) {
    if (group.length < 2) continue
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i]
        const b = group[j]
        if (!a || !b) continue
        const months = monthsBetween(a.createdAt, b.createdAt)
        if (months > 12) continue
        const ra = classRank(a.dpeLetter)
        const rb = classRank(b.dpeLetter)
        if (ra === null || rb === null) continue
        const gap = Math.abs(ra - rb)
        if (gap < 2) continue
        if (a.numeroDpe && b.numeroDpe && a.numeroDpe === b.numeroDpe) continue
        const severity: RiskSeverity = gap >= 4 ? 'critical' : gap >= 3 ? 'high' : 'medium'
        const recent = new Date(a.createdAt) > new Date(b.createdAt) ? a : b
        const older = recent === a ? b : a
        signals.push({
          type: 'dpe_shopping',
          severity,
          missionId: recent.id,
          description: `Deux DPE sur le même bien en ${months.toFixed(1)} mois avec écart de ${gap} classe(s) (${older.dpeLetter ?? '?'} → ${recent.dpeLetter ?? '?'}). Risque de contrôle ADEME élevé.`,
          evidence: {
            propertyKey: key,
            recentMissionId: recent.id,
            recentClass: recent.dpeLetter,
            previousMissionId: older.id,
            previousClass: older.dpeLetter,
            monthsApart: Number(months.toFixed(1)),
            classGap: gap,
          },
        })
      }
    }
  }
  return signals
}

function detectCadastreMismatch(m: Mission): RiskSignal | null {
  const dpe = m.surfaceDpe
  const cadastre = m.surfaceCadastre
  if (
    dpe === null ||
    dpe === undefined ||
    cadastre === null ||
    cadastre === undefined ||
    dpe <= 0 ||
    cadastre <= 0
  )
    return null
  const diffPct = (Math.abs(dpe - cadastre) / cadastre) * 100
  if (diffPct < 15) return null
  const severity: RiskSeverity = diffPct >= 40 ? 'critical' : diffPct >= 25 ? 'high' : 'medium'
  return {
    type: 'cadastre_mismatch',
    severity,
    missionId: m.id,
    description: `Surface DPE (${dpe} m²) vs cadastre (${cadastre} m²) : écart de ${diffPct.toFixed(1)}%. Vérifier le métré.`,
    evidence: { surfaceDpe: dpe, surfaceCadastre: cadastre, diffPct: Number(diffPct.toFixed(1)) },
  }
}

function detectClassJump(missions: Mission[]): RiskSignal[] {
  const signals: RiskSignal[] = []
  const dpes = missions.filter((m) => m.type === 'dpe' && classRank(m.dpeLetter) !== null)
  const byProp = new Map<string, Mission[]>()
  for (const m of dpes) {
    const key = propertyKey(m)
    if (!key) continue
    const arr = byProp.get(key) ?? []
    arr.push(m)
    byProp.set(key, arr)
  }
  for (const [key, group] of byProp) {
    if (group.length < 2) continue
    const sorted = [...group].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1]
      const cur = sorted[i]
      if (!prev || !cur) continue
      const rp = classRank(prev.dpeLetter)
      const rc = classRank(cur.dpeLetter)
      if (rp === null || rc === null) continue
      const improvement = rp - rc
      if (improvement < 2) continue
      if (cur.hasTravauxDocumented === true) continue
      const severity: RiskSeverity =
        improvement >= 4 ? 'critical' : improvement >= 3 ? 'high' : 'medium'
      signals.push({
        type: 'class_jump',
        severity,
        missionId: cur.id,
        description: `Saut de ${improvement} classe(s) (${prev.dpeLetter} → ${cur.dpeLetter}) sans travaux documentés. À justifier.`,
        evidence: {
          propertyKey: key,
          previousClass: prev.dpeLetter,
          currentClass: cur.dpeLetter,
          improvement,
        },
      })
    }
  }
  return signals
}

function detectAberrantData(m: Mission): RiskSignal[] {
  const signals: RiskSignal[] = []
  const power = m.heatingPowerKw
  const surface = m.surfaceTotal ?? m.surfaceDpe ?? m.surfaceCarrez
  if (power !== null && power !== undefined && surface && surface > 0) {
    const wPerM2 = (power * 1000) / surface
    if (wPerM2 < 5) {
      signals.push({
        type: 'aberrant_data',
        severity: wPerM2 < 2 ? 'high' : 'medium',
        missionId: m.id,
        description: `Puissance chauffage très faible : ${wPerM2.toFixed(1)} W/m². Vérifier la saisie.`,
        evidence: {
          check: 'heating_power_low',
          heatingPowerKw: power,
          surface,
          wattsPerM2: Number(wPerM2.toFixed(1)),
        },
      })
    } else if (wPerM2 > 200) {
      signals.push({
        type: 'aberrant_data',
        severity: wPerM2 > 500 ? 'high' : 'medium',
        missionId: m.id,
        description: `Puissance chauffage anormalement élevée : ${wPerM2.toFixed(1)} W/m². Vérifier l'unité.`,
        evidence: {
          check: 'heating_power_high',
          heatingPowerKw: power,
          surface,
          wattsPerM2: Number(wPerM2.toFixed(1)),
        },
      })
    }
  }
  if (m.dpeLetter === 'A' && typeof m.energyValue === 'number' && m.energyValue > 50) {
    signals.push({
      type: 'aberrant_data',
      severity: 'high',
      missionId: m.id,
      description: `Classe A annoncée mais consommation ${m.energyValue} kWh/m².an (> 50). Incohérence méthode 3CL probable.`,
      evidence: {
        check: 'class_a_with_high_consumption',
        dpeLetter: m.dpeLetter,
        energyValue: m.energyValue,
      },
    })
  }
  if (
    typeof m.yearBuilt === 'number' &&
    m.yearBuilt < 1948 &&
    (m.dpeLetter === 'A' || m.dpeLetter === 'B') &&
    m.hasTravauxDocumented !== true
  ) {
    signals.push({
      type: 'aberrant_data',
      severity: 'medium',
      missionId: m.id,
      description: `Construction antérieure à 1948 (${m.yearBuilt}) classée ${m.dpeLetter} sans travaux documentés.`,
      evidence: {
        check: 'old_building_good_class',
        yearBuilt: m.yearBuilt,
        dpeLetter: m.dpeLetter,
      },
    })
  }
  return signals
}

function detectRecurrentPatterns(missions: Mission[], lookbackMonths: number): RiskSignal[] {
  if (missions.length === 0) return []
  const counts = new Map<string, number>()
  const byType = new Map<string, string[]>()
  for (const m of missions) {
    const findings = m.preExportFindingTypes ?? []
    for (const f of findings) {
      counts.set(f, (counts.get(f) ?? 0) + 1)
      const arr = byType.get(f) ?? []
      arr.push(m.id)
      byType.set(f, arr)
    }
  }
  const total = missions.length
  const signals: RiskSignal[] = []
  for (const [findingType, count] of counts) {
    const pct = (count / total) * 100
    if (pct < 30) continue
    const severity: RiskSeverity = pct > 70 ? 'critical' : pct > 50 ? 'high' : 'medium'
    const sample = byType.get(findingType)?.[0] ?? ''
    signals.push({
      type: 'pattern_recurrent',
      severity,
      missionId: sample,
      description: `Erreur récurrente "${findingType}" dans ${pct.toFixed(0)}% de tes missions des ${lookbackMonths} derniers mois.`,
      evidence: {
        findingType,
        occurrences: count,
        totalMissions: total,
        pct: Number(pct.toFixed(1)),
      },
    })
  }
  signals.sort((a, b) => Number(b.evidence.occurrences ?? 0) - Number(a.evidence.occurrences ?? 0))
  return signals.slice(0, 3)
}

function aggregateRiskSignals(signals: RiskSignal[]) {
  const bySev = { low: 0, medium: 0, high: 0, critical: 0 }
  let penalty = 0
  for (const s of signals) {
    penalty += SEVERITY_WEIGHTS[s.severity]
    bySev[s.severity] += 1
  }
  const score = Math.max(0, Math.min(100, 100 - penalty))
  const order = { critical: 4, high: 3, medium: 2, low: 1 } as const
  const sorted = [...signals].sort((a, b) => order[b.severity] - order[a.severity])
  return { score, top5: sorted.slice(0, 5), bySeverity: bySev }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Loaders DB                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

interface DbMissionRow {
  id: string
  type: string
  created_at: string
  completed_at: string | null
  dpe_letter: string | null
  ges_letter: string | null
  energy_value: number | null
  ges_value: number | null
  metadata: Record<string, unknown> | null
  property: {
    id: string
    address: string | null
    cadastre_section: string | null
    cadastre_number: string | null
    cadastre_prefix: string | null
    surface_carrez: number | null
    surface_boutin: number | null
    surface_total: number | null
    year_built: number | null
  } | null
}

async function loadMissions(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Mission[]> {
  const since = new Date(Date.now() - HISTORY_LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString()

  // On filtre par missions assignées ou créées par le user.
  const { data: rows, error } = await supabase
    .from('missions')
    .select(`
      id, type, created_at, completed_at, dpe_letter, ges_letter, energy_value, ges_value, metadata,
      property:properties (
        id, address, cadastre_section, cadastre_number, cadastre_prefix,
        surface_carrez, surface_boutin, surface_total, year_built
      )
    `)
    .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
    .gte('created_at', since)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[audit-conformite-monthly-user] loadMissions error', error)
    throw new Error(`loadMissions: ${error.message}`)
  }

  const missions: Mission[] = []
  for (const raw of (rows ?? []) as DbMissionRow[]) {
    const meta = (raw.metadata ?? {}) as Record<string, unknown>
    missions.push({
      id: raw.id,
      type: raw.type,
      createdAt: raw.created_at,
      completedAt: raw.completed_at,
      propertyId: raw.property?.id ?? '',
      address: raw.property?.address ?? null,
      cadastreSection: raw.property?.cadastre_section ?? null,
      cadastreNumber: raw.property?.cadastre_number ?? null,
      cadastrePrefix: raw.property?.cadastre_prefix ?? null,
      surfaceCarrez: raw.property?.surface_carrez ?? null,
      surfaceBoutin: raw.property?.surface_boutin ?? null,
      surfaceTotal: raw.property?.surface_total ?? null,
      surfaceCadastre: (meta.surface_cadastre as number | undefined) ?? null,
      surfaceDpe: (meta.surface_dpe as number | undefined) ?? null,
      dpeLetter: raw.dpe_letter,
      gesLetter: raw.ges_letter,
      energyValue: raw.energy_value,
      gesValue: raw.ges_value,
      numeroDpe: (meta.numero_dpe as string | undefined) ?? null,
      heatingPowerKw: (meta.heating_power_kw as number | undefined) ?? null,
      hasTravauxDocumented: (meta.travaux_documented as boolean | undefined) ?? null,
      yearBuilt: raw.property?.year_built ?? null,
    })
  }

  // Charge les findings agrégés via pre_export_analyses (lookup par mission_id).
  const missionIds = missions.map((m) => m.id)
  if (missionIds.length > 0) {
    const { data: analyses } = await supabase
      .from('pre_export_analyses')
      .select('mission_id, findings')
      .in('mission_id', missionIds)
      .order('analyzed_at', { ascending: false })

    const findingsByMission = new Map<string, string[]>()
    for (const row of (analyses ?? []) as Array<{
      mission_id: string
      findings: unknown
    }>) {
      const types: string[] = []
      if (Array.isArray(row.findings)) {
        for (const f of row.findings) {
          if (
            f &&
            typeof f === 'object' &&
            'type' in f &&
            typeof (f as { type: unknown }).type === 'string'
          ) {
            types.push((f as { type: string }).type)
          }
        }
      }
      // Une mission peut avoir plusieurs analyses ; on prend le set agrégé.
      const existing = findingsByMission.get(row.mission_id) ?? []
      findingsByMission.set(row.mission_id, [...new Set([...existing, ...types])])
    }

    for (const m of missions) {
      m.preExportFindingTypes = findingsByMission.get(m.id) ?? []
    }
  }

  return missions
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Génération plan de remédiation narratif (fournisseur LLM cloud)            */
/* ─────────────────────────────────────────────────────────────────────────── */

interface RemediationResult {
  narrative: string
  costEur: number
}

/**
 * Appelle le fournisseur LLM cloud pour produire un plan de remédiation
 * narratif structuré sur les top 5 missions à risque. Budget cible ~0.069 €
 * par rapport (~8000 input + 3000 output tokens).
 *
 * Fallback : si la clé API est manquante OU si l'appel échoue, on retourne
 * un narrative neutre généré localement à partir des signaux (pas d'échec
 * total du rapport).
 */
async function generateRemediation(args: {
  apiKey: string | null
  model: string
  maxTokens: number
  signals: RiskSignal[]
  scoreGlobal: number
}): Promise<RemediationResult> {
  // Fallback narrative sans appel cloud (pour env de test / dégradé gracieux)
  const fallback = (): RemediationResult => {
    const lines: string[] = []
    lines.push(`Score global : ${args.scoreGlobal}/100.`)
    if (args.signals.length === 0) {
      lines.push('Aucun risque détecté sur la fenêtre du mois. RAS.')
    } else {
      lines.push('')
      lines.push('Plan de remédiation par mission à risque :')
      for (const s of args.signals) {
        lines.push(`- [${s.severity.toUpperCase()}] Mission ${s.missionId} : ${s.description}`)
      }
    }
    return { narrative: lines.join('\n'), costEur: 0 }
  }

  if (!args.apiKey) {
    return fallback()
  }

  try {
    const systemPrompt =
      'Tu es un expert conformité ADEME 3CL-2021 pour diagnostiqueurs immobiliers français. ' +
      'Sur la base des signaux de risque ci-dessous (issus du moteur KOVAS Bouclier Conformité), ' +
      'produis un plan de remédiation court et opérationnel par mission. Format : pour chaque ' +
      'mission, 1 paragraphe (3-5 phrases) avec : (a) cause probable du risque, (b) action ' +
      'concrète à mener avant envoi ADEME via Liciel, (c) document à conserver pour preuve. ' +
      "Ton sobre, professionnel, tutoiement. Pas d'emoji."

    const userPrompt = JSON.stringify(
      {
        score_global: args.scoreGlobal,
        signals: args.signals.map((s) => ({
          mission_id: s.missionId,
          type: s.type,
          severity: s.severity,
          description: s.description,
          evidence: s.evidence,
        })),
      },
      null,
      2,
    )

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': args.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: args.model,
        max_tokens: args.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!resp.ok) {
      console.error('[audit-conformite-monthly-user] remediation_http_error', resp.status)
      return fallback()
    }

    const data = (await resp.json()) as {
      content?: Array<{ type: string; text?: string }>
      usage?: { input_tokens?: number; output_tokens?: number }
    }

    const narrative =
      data.content
        ?.filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('\n') ?? ''

    // Approximation de coût (Sonnet 4.5 — ordre de grandeur 3$/MTok input + 15$/MTok output).
    // Conversion approx EUR 1$=0.92€. Les chiffres exacts sont audités côté billing.
    const inputTokens = data.usage?.input_tokens ?? 0
    const outputTokens = data.usage?.output_tokens ?? 0
    const costUsd = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15
    const costEur = Number((costUsd * 0.92).toFixed(6))

    return { narrative: narrative.trim() || fallback().narrative, costEur }
  } catch (err) {
    console.error('[audit-conformite-monthly-user] remediation_exception', err)
    return fallback()
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

function currentMonthYearUtc(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function filterPrimaryWindow(missions: Mission[]): Mission[] {
  const since = Date.now() - PRIMARY_WINDOW_DAYS * 24 * 3600 * 1000
  return missions.filter((m) => new Date(m.createdAt).getTime() >= since)
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Entry point                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  const remediationKey = Deno.env.get('ANTHROPIC_API_KEY') ?? null
  const model = Deno.env.get('REMEDIATION_MODEL') ?? DEFAULT_MODEL
  const maxTokensEnv = Deno.env.get('REMEDIATION_MAX_TOKENS')
  const maxTokens =
    maxTokensEnv && /^\d+$/.test(maxTokensEnv) ? Number(maxTokensEnv) : DEFAULT_MAX_TOKENS

  if (!supabaseUrl || !serviceRole || !cronSecret) {
    return jsonResponse({ error: 'missing_environment' }, 500)
  }

  if (req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  let body: { user_id?: string; month_year?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  if (!body.user_id || typeof body.user_id !== 'string') {
    return jsonResponse({ error: 'missing_user_id' }, 400)
  }

  const monthYear =
    typeof body.month_year === 'string' && /^\d{4}-\d{2}$/.test(body.month_year)
      ? body.month_year
      : currentMonthYearUtc()

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Vérifie subscription active.
  const { data: sub } = await supabase
    .from('user_addon_subscriptions')
    .select('user_id, status, addon_slug')
    .eq('user_id', body.user_id)
    .eq('addon_slug', 'bouclier_conformite')
    .in('status', ['active', 'trialing'])
    .maybeSingle()

  if (!sub) {
    return jsonResponse({ ok: false, reason: 'addon_not_active' }, 403)
  }

  // 2. Idempotency : pas de doublon (user, month).
  const { data: existing } = await supabase
    .from('audit_conformite_reports')
    .select('id, score_global')
    .eq('user_id', body.user_id)
    .eq('month_year', monthYear)
    .maybeSingle()

  if (existing) {
    return jsonResponse({
      ok: true,
      skipped: true,
      reason: 'already_generated',
      report_id: (existing as { id: string }).id,
      score_global: (existing as { score_global: number }).score_global,
    })
  }

  // 3. Charge missions + analyses.
  let missions: Mission[]
  try {
    missions = await loadMissions(supabase, body.user_id)
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        reason: 'load_missions_failed',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      500,
    )
  }

  const primaryMissions = filterPrimaryWindow(missions)

  // 4. Détecteurs sur l'historique complet (pour DPE shopping + class jump)
  //    mais on agrège le score sur la fenêtre primary uniquement (mois courant).
  const signals: RiskSignal[] = []
  signals.push(...detectDpeShopping(missions))
  signals.push(...detectClassJump(missions))
  signals.push(...detectRecurrentPatterns(primaryMissions, 1))
  for (const m of primaryMissions) {
    const cad = detectCadastreMismatch(m)
    if (cad) signals.push(cad)
    signals.push(...detectAberrantData(m))
  }

  // 5. On ne retient que les signaux dont la mission appartient à la fenêtre
  //    primary (les historiques sont des contextes, pas des cibles du mois).
  const primaryIds = new Set(primaryMissions.map((m) => m.id))
  const relevantSignals = signals.filter(
    (s) => primaryIds.has(s.missionId) || s.type === 'pattern_recurrent',
  )

  const agg = aggregateRiskSignals(relevantSignals)

  // 6. Génère le plan de remédiation narratif via le fournisseur cloud.
  const remediation = await generateRemediation({
    apiKey: remediationKey,
    model,
    maxTokens,
    signals: agg.top5,
    scoreGlobal: agg.score,
  })

  // 7. INSERT le rapport.
  const highRiskMissions = agg.top5.map((s) => ({
    mission_id: s.missionId,
    type: s.type,
    severity: s.severity,
    description: s.description,
    evidence: s.evidence,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('audit_conformite_reports')
    .insert({
      user_id: body.user_id,
      month_year: monthYear,
      score_global: agg.score,
      missions_count: primaryMissions.length,
      high_risk_missions: {
        signals: highRiskMissions,
        bySeverity: agg.bySeverity,
        remediation: remediation.narrative,
      },
      pdf_url: null, // V1 : généré côté Next.js à la demande, pas en cron.
      ai_cost_eur: remediation.costEur,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    console.error('[audit-conformite-monthly-user] insert_failed', insertError)
    return jsonResponse(
      { ok: false, reason: 'insert_failed', detail: insertError?.message ?? 'unknown' },
      500,
    )
  }

  return jsonResponse({
    ok: true,
    report_id: (inserted as { id: string }).id,
    month_year: monthYear,
    score_global: agg.score,
    missions_count: primaryMissions.length,
    high_risk_count: agg.top5.length,
    by_severity: agg.bySeverity,
    ai_cost_eur: remediation.costEur,
  })
})
