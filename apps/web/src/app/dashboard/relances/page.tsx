import { getCurrentUser } from '@/lib/auth/current-user'
import type { Metadata } from 'next'
import { RelancesPageContent } from './page-content'

export const metadata: Metadata = { title: 'Relances' }
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

/**
 * KOVAS — Page /app/relances (P7)
 *
 * Centralise toutes les séquences de relance :
 *   - Devis envoyés sans réponse
 *   - Factures impayées
 *   - Missions post-DPE F/G (suivi opportunité travaux)
 *   - Prescripteurs silencieux
 *   - Avis clients
 *
 * Affiche 4 KPI agrégés + tabs filtrables + manager.
 */
export default async function RelancesPage({ searchParams }: PageProps) {
  const { tab } = await searchParams
  const { orgId, supabase } = await getCurrentUser()

  // Stats agrégées — best-effort (graceful degradation si table absente / schéma désaligné).
  const stats = await loadStats(supabase, orgId)

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="sticky top-0 z-20 -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-b sm:border border-rule/60 bg-paper/95 backdrop-blur-xl px-4 sm:px-7 py-5 shadow-glass-sm">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
            Suivi commercial
          </p>
          <h1 className="font-sans text-[28px] font-semibold leading-tight tracking-tight text-ink truncate">
            Vos <span className="font-serif italic font-normal text-ink-mute">relances</span>
            <span className="text-ink-mute">.</span>
          </h1>
          <p className="text-sm text-ink-mute max-w-xl">
            Séquences automatiques pour devis envoyés, factures impayées, missions post-DPE F/G,
            prescripteurs silencieux et avis clients.
          </p>
        </div>
      </header>

      <RelancesPageContent stats={stats} defaultTab={normalizeTab(tab)} />
    </div>
  )
}

function normalizeTab(tab: string | undefined): string | null {
  if (!tab) return null
  if (
    tab === 'pending_quote' ||
    tab === 'devis' ||
    tab === 'unpaid_invoice' ||
    tab === 'factures' ||
    tab === 'post_dpe_fg' ||
    tab === 'silent_prescriber' ||
    tab === 'client_review'
  ) {
    return tab
  }
  return null
}

interface RelancesStats {
  activeCount: number
  emailsSentThisMonth: number
  conversionsThisMonth: number
  averageResponseRate: number | null
}

async function loadStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
): Promise<RelancesStats> {
  try {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const monthStartIso = monthStart.toISOString()

    // Toutes les séquences récentes (3 mois) pour stats — limite 1000.
    const { data, error } = await supabase
      .from('follow_up_sequences')
      .select('status, last_action_at, next_action_at, created_at, updated_at, current_step')
      .eq('organization_id', orgId)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 3_600_000).toISOString())
      .limit(1000)

    if (error || !data) {
      return { activeCount: 0, emailsSentThisMonth: 0, conversionsThisMonth: 0, averageResponseRate: null }
    }
    const rows = data as Array<{
      status: string
      last_action_at: string | null
      next_action_at: string | null
      created_at: string
      updated_at: string
      current_step: number | null
    }>

    const activeCount = rows.filter((r) => r.status === 'active' || r.status === 'paused').length

    // "Emails envoyés ce mois" = séquences dont last_action_at tombe dans le mois courant.
    // Approximation V1 — chaque step = 1 email. À affiner avec table dédiée plus tard.
    const emailsSentThisMonth = rows.filter(
      (r) => r.last_action_at && r.last_action_at >= monthStartIso,
    ).length

    // "Conversions ce mois" = séquences completed ce mois.
    const conversionsThisMonth = rows.filter(
      (r) => r.status === 'completed' && r.updated_at >= monthStartIso,
    ).length

    // Taux moyen — V1 : on ne dispose pas encore d'opens tracking, on renvoie null.
    const averageResponseRate: number | null = null

    return { activeCount, emailsSentThisMonth, conversionsThisMonth, averageResponseRate }
  } catch {
    return { activeCount: 0, emailsSentThisMonth: 0, conversionsThisMonth: 0, averageResponseRate: null }
  }
}
