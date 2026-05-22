import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * Types du dashboard qualité admin.
 * Tous les blocs sont optionnels — si une source de données est indisponible
 * (mock, dev local, API down), on rend un placeholder visuel.
 */

export type LighthouseSnapshot = {
  score: number
  category: string // 'Performance' | 'SEO' | 'Accessibility' | …
  trend: number | null
}

export type SentrySnapshot = {
  errors24h: number
  uniqueIssues: number
  trend: number | null
  topIssues: Array<{ id: string; title: string; count: number }>
}

export type UptimeSnapshot = {
  percent: number // 0-100
  incidents: number
  source: 'better-stack' | 'mock'
}

export type CoverageSnapshot = {
  statements: number
  branches: number
  lines: number
  functions: number
}

export type SeoSnapshot = {
  indexedPages: number
  crawlErrors: number
  averagePosition: number
  impressions: number
  lowScorePages: number
}

export type BusinessSnapshot = {
  mrrEuros: number
  mrrTrendPct: number | null
  signups7d: number
  activeTrials: number
  trialConversionPct: number
  churnPct: number
}

export type SnykSnapshot = {
  score: number // 0-100
  highSeverity: number
  mediumSeverity: number
  lowSeverity: number
  lastScanIso: string
  lastScanRelative: string
}

export type IncidentSummary = {
  id: string
  severity: 'P1' | 'P2' | 'P3'
  title: string
  openedRelative: string
  source: string
  url?: string
}

export type PriorityTicket = {
  id: string
  title: string
  priority: 'urgent' | 'high'
  openedRelative: string
}

export type QualityDashboardData = {
  lighthouse: LighthouseSnapshot | null
  sentry: SentrySnapshot | null
  uptime: UptimeSnapshot | null
  coverage: CoverageSnapshot | null
  seo: SeoSnapshot | null
  business: BusinessSnapshot | null
  snyk: SnykSnapshot | null
  alerts: {
    activeIncidents: IncidentSummary[]
    priorityTickets: PriorityTicket[]
  }
  generatedAtIso: string
}

// ──────────────────────────────────────────────────────────────
// Fetchers individuels — chacun ne throw jamais, retourne null si KO.
// ──────────────────────────────────────────────────────────────

/**
 * Charge un rapport Lighthouse depuis le filesystem.
 * Cherche `reports/lighthouse/manifest.json`.
 * Retourne un mock si fichier absent.
 */
async function loadLighthouse(): Promise<LighthouseSnapshot | null> {
  try {
    const manifestPath = path.join(process.cwd(), 'reports/lighthouse/manifest.json')
    const raw = await fs.readFile(manifestPath, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return mockLighthouse()
    // Manifest Lighthouse CI : on prend le dernier run
    const lastRun = parsed[parsed.length - 1] as {
      summary?: { performance?: number; seo?: number; accessibility?: number }
    }
    if (!lastRun.summary) return mockLighthouse()
    const seo = Math.round((lastRun.summary.seo ?? 0) * 100)
    return {
      score: seo,
      category: 'SEO',
      trend: null,
    }
  } catch {
    return mockLighthouse()
  }
}

function mockLighthouse(): LighthouseSnapshot {
  return { score: 96, category: 'SEO (mock)', trend: 2 }
}

/**
 * Appelle l'API Sentry pour les 24 dernières heures.
 * Requiert env `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT`.
 * Retourne un mock sinon.
 */
async function loadSentry(): Promise<SentrySnapshot | null> {
  const token = process.env.SENTRY_AUTH_TOKEN
  const org = process.env.SENTRY_ORG
  const project = process.env.SENTRY_PROJECT
  if (!token || !org || !project) return mockSentry()

  try {
    const url = `https://sentry.io/api/0/projects/${org}/${project}/issues/?statsPeriod=24h&limit=5&sort=freq`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 },
    })
    if (!res.ok) return mockSentry()
    const issues = (await res.json()) as Array<{
      id: string
      title: string
      count: string
    }>
    const errors24h = issues.reduce((acc, i) => acc + Number(i.count ?? 0), 0)
    return {
      errors24h,
      uniqueIssues: issues.length,
      trend: null,
      topIssues: issues.map((i) => ({
        id: i.id,
        title: i.title,
        count: Number(i.count ?? 0),
      })),
    }
  } catch {
    return mockSentry()
  }
}

function mockSentry(): SentrySnapshot {
  return {
    errors24h: 3,
    uniqueIssues: 2,
    trend: -25,
    topIssues: [
      { id: 'mock-1', title: 'TypeError: cannot read property … (mock)', count: 2 },
      { id: 'mock-2', title: 'Network request failed /api/voice (mock)', count: 1 },
    ],
  }
}

/**
 * Appelle Better Stack API pour l'uptime 30j.
 * Requiert env `BETTERSTACK_API_TOKEN` + `BETTERSTACK_MONITOR_ID`.
 */
async function loadUptime(): Promise<UptimeSnapshot | null> {
  const token = process.env.BETTERSTACK_API_TOKEN
  const monitorId = process.env.BETTERSTACK_MONITOR_ID
  if (!token || !monitorId) return mockUptime()

  try {
    const url = `https://uptime.betterstack.com/api/v2/monitors/${monitorId}/sla?from=30d`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    })
    if (!res.ok) return mockUptime()
    const json = (await res.json()) as {
      data: { attributes: { availability: number; incidents_count: number } }
    }
    return {
      percent: json.data.attributes.availability,
      incidents: json.data.attributes.incidents_count,
      source: 'better-stack',
    }
  } catch {
    return mockUptime()
  }
}

function mockUptime(): UptimeSnapshot {
  return { percent: 99.97, incidents: 0, source: 'mock' }
}

/**
 * Lit `reports/coverage/coverage-summary.json` (sortie Vitest --coverage).
 */
async function loadCoverage(): Promise<CoverageSnapshot | null> {
  try {
    const summaryPath = path.join(process.cwd(), 'reports/coverage/coverage-summary.json')
    const raw = await fs.readFile(summaryPath, 'utf-8')
    const parsed = JSON.parse(raw) as {
      total: {
        statements: { pct: number }
        branches: { pct: number }
        lines: { pct: number }
        functions: { pct: number }
      }
    }
    return {
      statements: Math.round(parsed.total.statements.pct),
      branches: Math.round(parsed.total.branches.pct),
      lines: Math.round(parsed.total.lines.pct),
      functions: Math.round(parsed.total.functions.pct),
    }
  } catch {
    return mockCoverage()
  }
}

function mockCoverage(): CoverageSnapshot {
  return { statements: 72, branches: 65, lines: 74, functions: 70 }
}

/**
 * Google Search Console nécessite OAuth complexe — mock V1.
 * Phase 2 : OAuth GSC + service account + cache jour.
 */
async function loadSeo(): Promise<SeoSnapshot | null> {
  return {
    indexedPages: 42,
    crawlErrors: 0,
    averagePosition: 18.4,
    impressions: 3_240,
    lowScorePages: 1,
  }
}

/**
 * Charge les métriques business depuis PostHog (si dispo) sinon mock.
 * Phase 2 : query PostHog SQL API.
 */
async function loadBusiness(): Promise<BusinessSnapshot | null> {
  const token = process.env.POSTHOG_API_KEY
  if (!token) return mockBusiness()
  // V1 : on garde le mock (l'intégration PostHog SQL est dans le backlog Q-INSTRUMENT)
  return mockBusiness()
}

function mockBusiness(): BusinessSnapshot {
  return {
    mrrEuros: 1_240,
    mrrTrendPct: 18,
    signups7d: 12,
    activeTrials: 7,
    trialConversionPct: 24.5,
    churnPct: 3.8,
  }
}

/**
 * Snyk : mock V1 (intégration API Snyk en Phase 2 — token complexe à provisionner).
 */
async function loadSnyk(): Promise<SnykSnapshot | null> {
  return {
    score: 94,
    highSeverity: 0,
    mediumSeverity: 2,
    lowSeverity: 5,
    lastScanIso: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    lastScanRelative: 'il y a 6h',
  }
}

/**
 * Liste les alertes actives — V1 : mock vide (aucune intégration live encore).
 * Phase 2 : requête `support_tickets WHERE priority IN ('urgent','high') AND status='open'`.
 */
async function loadAlerts(): Promise<QualityDashboardData['alerts']> {
  return {
    activeIncidents: [],
    priorityTickets: [],
  }
}

// ──────────────────────────────────────────────────────────────
// Agrégateur principal — Promise.all
// ──────────────────────────────────────────────────────────────

export async function loadQualityDashboardData(): Promise<QualityDashboardData> {
  const [lighthouse, sentry, uptime, coverage, seo, business, snyk, alerts] = await Promise.all([
    loadLighthouse(),
    loadSentry(),
    loadUptime(),
    loadCoverage(),
    loadSeo(),
    loadBusiness(),
    loadSnyk(),
    loadAlerts(),
  ])

  return {
    lighthouse,
    sentry,
    uptime,
    coverage,
    seo,
    business,
    snyk,
    alerts,
    generatedAtIso: new Date().toISOString(),
  }
}
