import { HealthChecksGrid } from '@/components/admin/home/HealthChecksGrid'
import { RecentActivityFeed } from '@/components/admin/home/RecentActivityFeed'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { KOVAS_TIERS, type KovasTier } from '@/lib/stripe-config'
import { BarChart3, Bot, Building2, PieChart, TrendingUp, UserPlus } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Aujourd'hui",
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic' // métriques temps réel
export const revalidate = 0

// ============================================
// Types des réponses Supabase (admin_*, tables existantes)
// ============================================
interface SubscriptionRow {
  tier: KovasTier['id'] | null
}
interface AiUsageRow {
  cost_eur: number | string
}

// ============================================
// Helpers
// ============================================

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

function startOfTodayParisIso(): string {
  // date_trunc('day', now() AT TIME ZONE 'Europe/Paris') équivalent côté JS.
  // En pratique on calcule minuit Paris du jour courant.
  const now = new Date()
  const parisStr = now.toLocaleString('en-US', { timeZone: 'Europe/Paris' })
  const paris = new Date(parisStr)
  paris.setHours(0, 0, 0, 0)
  // paris est en heure locale du serveur — toISOString convertit en UTC.
  return paris.toISOString()
}

function startOfThisMonthIso(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

// ============================================
// Data fetchers
// ============================================

async function fetchMetrics(): Promise<{
  signupsToday: number
  mrrEur: number
  activeOrgs: number
  missionsThisMonth: number
  aiCostEur: number
  marginPct: number | null
}> {
  const supabase = createAdminClient()
  const todayIso = startOfTodayParisIso()
  const monthIso = startOfThisMonthIso()

  // Les helpers Supabase typés .from()/'count' fonctionnent ; on extrait count
  // de la response standard.
  const signupsPromise = supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', todayIso)

  const subsPromise = supabase.from('subscriptions').select('tier').eq('status', 'active')

  const orgsPromise = supabase
    .from('organizations')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)

  const missionsPromise = supabase
    .from('missions')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', monthIso)
    .is('deleted_at', null)

  const aiPromise = supabase.from('ai_usage').select('cost_eur').gte('created_at', monthIso)

  const [signupsRes, subsRes, orgsRes, missionsRes, aiRes] = await Promise.all([
    signupsPromise,
    subsPromise,
    orgsPromise,
    missionsPromise,
    aiPromise,
  ])

  const signupsToday = signupsRes.count ?? 0
  const activeOrgs = orgsRes.count ?? 0
  const missionsThisMonth = missionsRes.count ?? 0

  // MRR estimé : somme priceMonthlyCents par tier des subs actives.
  const subs = (subsRes.data ?? []) as SubscriptionRow[]
  const mrrCents = subs.reduce((acc, sub) => {
    if (!sub.tier) return acc
    const tier = KOVAS_TIERS.find((t) => t.id === sub.tier)
    return tier ? acc + tier.priceMonthlyCents : acc
  }, 0)
  const mrrEur = mrrCents / 100

  // Coût IA ce mois (numérique stocké, parseFloat safe)
  const aiRows = (aiRes.data ?? []) as AiUsageRow[]
  const aiCostEur = aiRows.reduce(
    (acc, row) => acc + Number.parseFloat(String(row.cost_eur ?? '0')),
    0,
  )

  // Marge brute V1 simpliste : (MRR - coût IA) / MRR, null si pas de MRR.
  const marginPct = mrrEur > 0 ? Math.max(0, ((mrrEur - aiCostEur) / mrrEur) * 100) : null

  return {
    signupsToday,
    mrrEur,
    activeOrgs,
    missionsThisMonth,
    aiCostEur,
    marginPct,
  }
}

// ============================================
// Page
// ============================================

export default async function AdminHomePage() {
  const metrics = await fetchMetrics()

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          🛡️ Tableau de bord admin
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Aujourd'hui.
        </h1>
        <p className="text-sm text-ink-mute max-w-xl">
          Vue d'ensemble en temps réel · données rafraîchies à chaque chargement.
        </p>
      </div>

      {/* Grille 3×2 de métriques */}
      <section
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Métriques clés"
      >
        <AdminMetricCard
          eyebrow="Signups aujourd'hui"
          value={formatInt(metrics.signupsToday)}
          hint="Comptes créés depuis minuit (Europe/Paris)"
          icon={UserPlus}
        />
        <AdminMetricCard
          eyebrow="MRR estimé"
          value={formatEur(metrics.mrrEur)}
          hint="Somme des abonnements actifs"
          icon={TrendingUp}
        />
        <AdminMetricCard
          eyebrow="Orgs actives"
          value={formatInt(metrics.activeOrgs)}
          hint="Organisations non supprimées"
          icon={Building2}
        />
        <AdminMetricCard
          eyebrow="Missions ce mois"
          value={formatInt(metrics.missionsThisMonth)}
          hint="Toutes orgs confondues"
          icon={BarChart3}
        />
        <AdminMetricCard
          eyebrow="Coût IA ce mois"
          value={formatEur(metrics.aiCostEur)}
          hint="Anthropic + OpenAI + Deepgram"
          icon={Bot}
        />
        <AdminMetricCard
          eyebrow="Marge brute"
          value={metrics.marginPct !== null ? `${metrics.marginPct.toFixed(0)}%` : '—'}
          hint="(MRR − coût IA) / MRR · v1 simpliste"
          icon={PieChart}
        />
      </section>

      {/* Activité récente (polling 10s) + Health checks (polling 30s) */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <RecentActivityFeed />
        <HealthChecksGrid />
      </section>
    </div>
  )
}
