/**
 * KOVAS — Page /dashboard/coach
 *
 * Coach IA conversationnel personnel. Server Component qui :
 *  - Fetch les KPI (conversations totales, insights mois, recos actives,
 *    temps économisé estimé)
 *  - Charge la dernière conversation + ses messages (resume natif)
 *  - Lit les recommandations actives
 *  - Rend le CoachWorkspace client + ActiveRecommendations + carte
 *    "Comment ça fonctionne"
 *
 * Avatar : SOBRE PROFESSIONNEL — vouvoiement, pas d'emoji.
 */

import {
  ActiveRecommendations,
  type CoachRecommendation,
} from '@/components/coach/ActiveRecommendations'
import { CoachWorkspace } from '@/components/coach/CoachWorkspace'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { Clock, Lightbulb, MessageSquare, Sparkles } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Coach IA' }
export const dynamic = 'force-dynamic'

interface ConversationRow {
  id: string
}

interface MessageRow {
  id: string
  role: string
  content: string
}

interface KpiRow {
  total_conversations: number
  insights_this_month: number
  active_recommendations: number
  time_saved_minutes: number
}

const MINUTES_SAVED_PER_INSIGHT = 12 // hypothèse V1.5 : chaque reco IA = ~12 min épargnées

async function loadCoachData(): Promise<{
  kpi: KpiRow
  conversationId: string | null
  initialMessages: readonly { id: string; role: 'user' | 'assistant'; content: string }[]
  recommendations: readonly CoachRecommendation[]
}> {
  const { user, supabase } = await getCurrentUser()
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  try {
    // biome-ignore lint/suspicious/noExplicitAny: coach_* tables not yet in generated types
    const sb = supabase as any

    const [convCountRes, lastConvRes, insightsCountRes, recosRes] = await Promise.all([
      sb
        .from('coach_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      sb
        .from('coach_conversations')
        .select('id')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from('coach_recommendations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', monthStart.toISOString()),
      sb
        .from('coach_recommendations')
        .select('id, title, summary, action_url, priority, created_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    const conversationId: string | null = (lastConvRes.data as ConversationRow | null)?.id ?? null

    let initialMessages: { id: string; role: 'user' | 'assistant'; content: string }[] = []
    if (conversationId) {
      const msgsRes = await sb
        .from('coach_messages')
        .select('id, role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(30)
      const rows = (msgsRes.data as MessageRow[] | null) ?? []
      initialMessages = rows
        .filter(
          (m): m is { id: string; role: 'user' | 'assistant'; content: string } =>
            (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string',
        )
        .map((m) => ({ id: m.id, role: m.role, content: m.content }))
    }

    const recommendations: CoachRecommendation[] = (
      (recosRes.data as CoachRecommendation[] | null) ?? []
    ).map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      action_url: r.action_url,
      priority: r.priority ?? 5,
      created_at: r.created_at,
    }))

    const insightsThisMonth = insightsCountRes.count ?? 0

    return {
      kpi: {
        total_conversations: convCountRes.count ?? 0,
        insights_this_month: insightsThisMonth,
        active_recommendations: recommendations.length,
        time_saved_minutes: insightsThisMonth * MINUTES_SAVED_PER_INSIGHT,
      },
      conversationId,
      initialMessages,
      recommendations,
    }
  } catch {
    // Tables pas encore migrées en local : graceful degradation
    return {
      kpi: {
        total_conversations: 0,
        insights_this_month: 0,
        active_recommendations: 0,
        time_saved_minutes: 0,
      },
      conversationId: null,
      initialMessages: [],
      recommendations: [],
    }
  }
}

export default async function CoachPage() {
  const { kpi, conversationId, initialMessages, recommendations } = await loadCoachData()

  const timeSavedLabel = formatMinutes(kpi.time_saved_minutes)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ============================================
          Header sticky Qonto pattern
          ============================================ */}
      <header className="sticky top-0 z-20 -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-b sm:border border-rule/60 bg-paper/95 backdrop-blur-xl px-4 sm:px-7 py-5 shadow-glass-sm">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">Coach IA</p>
          <h1 className="font-sans text-[28px] font-semibold leading-tight tracking-tight text-ink">
            Votre <span className="font-serif italic font-normal text-ink-mute">coach</span>{' '}
            personnel
            <span className="text-ink-mute">.</span>
          </h1>
          <p className="text-sm text-ink-mute max-w-xl">
            Posez des questions sur votre activité, votre productivité et la réglementation. Le
            Coach analyse vos données pour vous proposer des pistes concrètes.
          </p>
        </div>
      </header>

      {/* ============================================
          4 KPI cards
          ============================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCell
          icon={MessageSquare}
          label="Conversations"
          value={String(kpi.total_conversations)}
        />
        <KpiCell icon={Sparkles} label="Insights ce mois" value={String(kpi.insights_this_month)} />
        <KpiCell
          icon={Lightbulb}
          label="Recos actives"
          value={String(kpi.active_recommendations)}
        />
        <KpiCell icon={Clock} label="Temps épargné" value={timeSavedLabel} />
      </div>

      {/* ============================================
          Workspace : chat (2/3) + recommandations (1/3)
          ============================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CoachWorkspace conversationId={conversationId} initialMessages={initialMessages} />
        </div>
        <aside className="lg:col-span-1 space-y-4">
          <ActiveRecommendations recommendations={recommendations} />
        </aside>
      </div>

      {/* ============================================
          Bandeau transparence
          ============================================ */}
      <Card variant="flat" padding="sm">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="size-9 rounded-full bg-[#0F1419] text-[#D4F542] flex items-center justify-center shrink-0"
          >
            <Sparkles className="size-4" />
          </span>
          <div className="space-y-1">
            <h3 className="text-[13px] font-semibold text-ink">Comment fonctionne le Coach IA</h3>
            <p className="text-[12.5px] text-ink-mute leading-relaxed">
              Le Coach utilise Claude Haiku 4.5 (Anthropic) avec un contexte limité à vos données
              métier : missions récentes, factures du mois, profil utilisateur. Aucune donnée
              personnelle client n'est transmise au modèle. Les conversations et recommandations
              sont stockées chiffrées dans votre espace Supabase EU (Paris) — vous pouvez les
              supprimer à tout moment depuis votre compte.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ============================================================
// Helpers
// ============================================================

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  if (rem === 0) return `${hours}h`
  return `${hours}h${rem.toString().padStart(2, '0')}`
}

function KpiCell({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MessageSquare
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-rule/60 bg-paper/85 px-4 py-3 shadow-glass-xs">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="size-3.5 text-ink-faint" aria-hidden />
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
          {label}
        </div>
      </div>
      <div className="text-base font-semibold text-ink tabular-nums font-mono">{value}</div>
    </div>
  )
}
