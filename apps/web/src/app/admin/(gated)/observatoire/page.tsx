/**
 * /admin/observatoire — Dashboard admin de l'Observatoire mensuel.
 *
 * Affiche :
 *   - KPI : nombre de subscribers actifs, ouvertures cumulées, downloads,
 *     dernier rapport envoyé
 *   - Liste des rapports archivés (download + relancer)
 *   - Bouton « Générer maintenant » pour relancer manuellement le cron
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Metadata } from 'next'
import { ObservatoireAdminBoard } from './ObservatoireAdminBoard'

export const metadata: Metadata = {
  title: 'Observatoire — Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface ObservatoireReport {
  readonly id: string
  readonly periodLabel: string
  readonly periodYear: number
  readonly periodMonth: number
  readonly coverTitle: string
  readonly executiveSummary: string
  readonly pdfUrl: string
  readonly pdfSizeBytes: number | null
  readonly status: 'draft' | 'sent' | 'failed'
  readonly subscribersAtSend: number
  readonly emailsSent: number
  readonly emailsFailed: number
  readonly emailsOpened: number
  readonly downloadsDirect: number
  readonly aiCostEur: number
  readonly generatedAt: string
  readonly sentAt: string | null
}

export interface AdminObservatoireSummary {
  readonly activeSubscribers: number
  readonly unsubscribed: number
  readonly totalOpens: number
  readonly avgOpenRatePct: number
  readonly lastReport: ObservatoireReport | null
}

interface ReportRow {
  id: string
  period_year: number
  period_month: number
  cover_title: string
  executive_summary: string
  pdf_url: string
  pdf_size_bytes: number | null
  status: 'draft' | 'sent' | 'failed'
  subscribers_at_send: number
  emails_sent: number
  emails_failed: number
  emails_opened: number
  downloads_direct: number
  ai_cost_eur: number
  generated_at: string
  sent_at: string | null
}

const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const

function periodLabel(year: number, month: number): string {
  return `${MONTHS_FR[month - 1] ?? 'mois'} ${year}`
}

async function loadReports(): Promise<ObservatoireReport[]> {
  const supabase = createAdminClient()
  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { data, error } = await (supabase as any)
    .from('observatoire_reports')
    .select(
      'id, period_year, period_month, cover_title, executive_summary, pdf_url, pdf_size_bytes, status, subscribers_at_send, emails_sent, emails_failed, emails_opened, downloads_direct, ai_cost_eur, generated_at, sent_at',
    )
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .limit(24)

  if (error) {
    console.error('loadReports error:', error.message)
    return []
  }

  return ((data ?? []) as ReportRow[]).map((r) => ({
    id: r.id,
    periodLabel: periodLabel(r.period_year, r.period_month),
    periodYear: r.period_year,
    periodMonth: r.period_month,
    coverTitle: r.cover_title,
    executiveSummary: r.executive_summary,
    pdfUrl: r.pdf_url,
    pdfSizeBytes: r.pdf_size_bytes,
    status: r.status,
    subscribersAtSend: r.subscribers_at_send,
    emailsSent: r.emails_sent,
    emailsFailed: r.emails_failed,
    emailsOpened: r.emails_opened,
    downloadsDirect: r.downloads_direct,
    aiCostEur: r.ai_cost_eur,
    generatedAt: r.generated_at,
    sentAt: r.sent_at,
  }))
}

async function loadSubscribersSummary(): Promise<{
  active: number
  unsubscribed: number
  totalOpens: number
}> {
  const supabase = createAdminClient()
  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { count: active } = await (supabase as any)
    .from('observatoire_subscribers')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_opt_in', true)
    .is('unsubscribed_at', null)

  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { count: unsubscribed } = await (supabase as any)
    .from('observatoire_subscribers')
    .select('id', { count: 'exact', head: true })
    .not('unsubscribed_at', 'is', null)

  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { data: opensData } = await (supabase as any)
    .from('observatoire_subscribers')
    .select('opens_count')
  const totalOpens = ((opensData ?? []) as Array<{ opens_count: number }>).reduce(
    (acc, r) => acc + (r.opens_count ?? 0),
    0,
  )

  return {
    active: active ?? 0,
    unsubscribed: unsubscribed ?? 0,
    totalOpens,
  }
}

export default async function AdminObservatoirePage() {
  const [reports, subs] = await Promise.all([
    loadReports(),
    loadSubscribersSummary(),
  ])

  const lastReport = reports[0] ?? null
  const avgOpenRate =
    lastReport && lastReport.emailsSent > 0
      ? (lastReport.emailsOpened / lastReport.emailsSent) * 100
      : 0

  const summary: AdminObservatoireSummary = {
    activeSubscribers: subs.active,
    unsubscribed: subs.unsubscribed,
    totalOpens: subs.totalOpens,
    avgOpenRatePct: Math.round(avgOpenRate * 10) / 10,
    lastReport,
  }

  return <ObservatoireAdminBoard reports={reports} summary={summary} />
}
