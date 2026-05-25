/**
 * /admin/seo/quality-monitor — Monitoring helpful content Core Update mai 2026.
 *
 * Liste les pages programmatiques (/trouver-un-diagnostiqueur/*) à fort taux
 * de rebond, faible temps sur page, pogo-sticking détecté ou contenu incomplet.
 *
 * Source : table `seo_page_quality_signals` (migration 20260524230000).
 * Alimentée par job nightly ingest-posthog-seo-signals (cf. crons GitHub Actions).
 *
 * Actions admin :
 *  - "Refresh content" : marque la page `needs_refresh=true` → entre dans la
 *    file d'attente de régénération éditoriale.
 *  - "Ignorer" : remet le flag à false (faux positif).
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import {
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Timer,
  TrendingDown,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Monitoring helpful content SEO — Admin KOVAS',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface SignalRow {
  id: string
  page_url: string
  page_type: string | null
  city_slug: string | null
  dept_code: string | null
  bounce_rate: number | null
  avg_time_on_page_sec: number | null
  pogo_stick_count: number
  total_visits: number
  total_conversions: number
  has_real_diagnostician: boolean
  has_local_data: boolean
  has_human_signature: boolean
  quality_score: number | null
  last_audited_at: string
  needs_refresh: boolean
  refresh_reason: string | null
}

async function loadAtRiskPages(): Promise<SignalRow[]> {
  try {
    const supabase = createAdminClient()
    // biome-ignore lint/suspicious/noExplicitAny: table seo_page_quality_signals pas dans types DB
    const { data, error } = await (supabase as any)
      .from('seo_page_quality_signals')
      .select('*')
      .or('needs_refresh.eq.true,bounce_rate.gte.0.7,pogo_stick_count.gte.5')
      .order('quality_score', { ascending: true, nullsFirst: false })
      .limit(200)

    if (error || !data) return []
    return data as SignalRow[]
  } catch {
    return []
  }
}

async function loadGlobalStats(): Promise<{
  totalTracked: number
  needsRefresh: number
  avgBounce: number
  avgQuality: number
}> {
  try {
    const supabase = createAdminClient()
    // biome-ignore lint/suspicious/noExplicitAny: table seo_page_quality_signals pas dans types DB
    const { data, error } = await (supabase as any)
      .from('seo_page_quality_signals')
      .select('bounce_rate, quality_score, needs_refresh')
      .limit(5000)

    if (error || !data) {
      return { totalTracked: 0, needsRefresh: 0, avgBounce: 0, avgQuality: 0 }
    }

    const rows = data as Array<{
      bounce_rate: number | null
      quality_score: number | null
      needs_refresh: boolean
    }>

    const totalTracked = rows.length
    const needsRefresh = rows.filter((r) => r.needs_refresh).length
    const bounceVals = rows.map((r) => r.bounce_rate).filter((v): v is number => v !== null)
    const qualityVals = rows.map((r) => r.quality_score).filter((v): v is number => v !== null)
    const avgBounce =
      bounceVals.length > 0 ? bounceVals.reduce((a, b) => a + b, 0) / bounceVals.length : 0
    const avgQuality =
      qualityVals.length > 0 ? qualityVals.reduce((a, b) => a + b, 0) / qualityVals.length : 0

    return { totalTracked, needsRefresh, avgBounce, avgQuality }
  } catch {
    return { totalTracked: 0, needsRefresh: 0, avgBounce: 0, avgQuality: 0 }
  }
}

function formatRefreshReason(reason: string | null): string {
  if (!reason) return '—'
  const map: Record<string, string> = {
    high_bounce: 'Taux de rebond > 70 %',
    low_time: 'Temps lecture < 30 s',
    pogo_stick: 'Pogo-sticking > 5',
    no_diag: 'Pas de diagnostiqueur réel',
    stale: 'Contenu > 90 jours',
  }
  return map[reason] ?? reason
}

export default async function SeoQualityMonitorPage() {
  const [pages, stats] = await Promise.all([loadAtRiskPages(), loadGlobalStats()])

  return (
    <div className="space-y-8 p-6 max-w-7xl">
      <header className="space-y-2">
        <h1 className="font-sans font-bold text-3xl tracking-tight">
          Monitoring helpful content SEO
        </h1>
        <p className="text-sm text-ink-mute max-w-3xl">
          Tracking des signaux Core Update mai 2026 sur les pages programmatiques
          (/trouver-un-diagnostiqueur/*, /diagnostic/*). Les pages à fort taux de rebond, faible
          temps sur page ou pogo-sticking détecté sont marquées pour refresh prioritaire.
        </p>
      </header>

      {/* Stats globales */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Pages trackées
          </p>
          <p className="font-serif italic text-3xl text-ink mt-1">
            {stats.totalTracked.toLocaleString('fr-FR')}
          </p>
        </Card>
        <Card className="p-4 bg-accent-warm-soft">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint inline-flex items-center gap-1.5">
            <AlertTriangle className="size-3" aria-hidden />À rafraîchir
          </p>
          <p className="font-serif italic text-3xl text-ink mt-1">
            {stats.needsRefresh.toLocaleString('fr-FR')}
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint inline-flex items-center gap-1.5">
            <TrendingDown className="size-3" aria-hidden />
            Bounce moyen
          </p>
          <p className="font-serif italic text-3xl text-ink mt-1">
            {(stats.avgBounce * 100).toFixed(1)}%
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3" aria-hidden />
            Quality score moyen
          </p>
          <p className="font-serif italic text-3xl text-ink mt-1">
            {stats.avgQuality.toFixed(1)}/100
          </p>
        </Card>
      </section>

      {/* Liste pages à risque */}
      <section className="space-y-4">
        <h2 className="font-sans font-bold text-2xl tracking-tight">
          Pages à risque ({pages.length})
        </h2>
        {pages.length === 0 ? (
          <Card className="p-8 text-center text-ink-mute">
            Aucune page à risque détectée. Le tracking PostHog/GA4 démarre dès le déploiement de la
            migration et la connexion du job nightly
            <code className="font-mono ml-1">ingest-posthog-seo-signals</code>.
          </Card>
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-deep border-b border-rule">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-ink">URL</th>
                  <th className="text-right px-4 py-3 font-semibold text-ink">Bounce</th>
                  <th className="text-right px-4 py-3 font-semibold text-ink">Temps moy.</th>
                  <th className="text-right px-4 py-3 font-semibold text-ink">Pogo</th>
                  <th className="text-right px-4 py-3 font-semibold text-ink">Visites</th>
                  <th className="text-center px-4 py-3 font-semibold text-ink">Complétude</th>
                  <th className="text-right px-4 py-3 font-semibold text-ink">Score</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink">Raison</th>
                  <th className="text-center px-4 py-3 font-semibold text-ink">Action</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-rule last:border-b-0 hover:bg-cream-deep/40"
                  >
                    <td className="px-4 py-3 max-w-md">
                      <Link
                        href={p.page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-navy hover:underline underline-offset-4 inline-flex items-center gap-1 text-xs font-mono break-all"
                      >
                        {p.page_url}
                        <ExternalLink className="size-3 shrink-0" />
                      </Link>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-xs ${
                        p.bounce_rate && p.bounce_rate > 0.7
                          ? 'text-accent-red font-bold'
                          : 'text-ink'
                      }`}
                    >
                      {p.bounce_rate !== null ? `${(p.bounce_rate * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-xs ${
                        p.avg_time_on_page_sec && p.avg_time_on_page_sec < 30
                          ? 'text-accent-red font-bold'
                          : 'text-ink'
                      }`}
                    >
                      {p.avg_time_on_page_sec !== null
                        ? `${Math.round(p.avg_time_on_page_sec)}s`
                        : '—'}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-xs ${
                        p.pogo_stick_count > 5 ? 'text-accent-red font-bold' : 'text-ink'
                      }`}
                    >
                      {p.pogo_stick_count}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-ink-soft">
                      {p.total_visits.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex gap-1">
                        <Badge
                          variant={p.has_real_diagnostician ? 'green' : 'red'}
                          className="text-[9px]"
                        >
                          DIAG
                        </Badge>
                        <Badge variant={p.has_local_data ? 'green' : 'red'} className="text-[9px]">
                          DATA
                        </Badge>
                        <Badge
                          variant={p.has_human_signature ? 'green' : 'red'}
                          className="text-[9px]"
                        >
                          SIGN
                        </Badge>
                      </div>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-xs ${
                        p.quality_score && p.quality_score < 50
                          ? 'text-accent-red font-bold'
                          : 'text-ink'
                      }`}
                    >
                      {p.quality_score !== null ? p.quality_score.toFixed(0) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-mute">
                      <span className="inline-flex items-center gap-1">
                        <Timer className="size-3 text-ink-faint" aria-hidden />
                        {formatRefreshReason(p.refresh_reason)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/api/admin/seo/quality-monitor/refresh?id=${p.id}`}>
                          <RefreshCw className="size-3" aria-hidden />
                          Refresh
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section className="space-y-2 text-xs text-ink-faint">
        <p>
          <strong className="text-ink">Procédure d'urgence Core Update :</strong> ne PAS paniquer si
          une page chute brutalement. Observer 2 semaines avant action (cycle d'évaluation Google =
          ~14 jours). Vérifier les signaux comportementaux (pogo-sticking, temps sur page) avant de
          modifier le contenu.
        </p>
        <p>
          <strong className="text-ink">Cibles qualité minimum :</strong> bounce rate &lt; 60 %,
          temps moyen &gt; 60 s, quality_score &gt; 70/100, 3+ diagnostiqueurs réels par page,
          signature humaine systématique.
        </p>
      </section>
    </div>
  )
}
