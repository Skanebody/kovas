/**
 * /admin/press — Console presse (Game Changer 5 acqui-target).
 *
 * Affiche :
 *   - KPI : contacts opt-in actifs, communiqués envoyés total, dernier envoi
 *   - Liste des communiqués (toutes status) avec actions :
 *       draft → approve → dispatch → sent
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §6.5 + CLAUDE.md ton sobre.
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Metadata } from 'next'
import { PressAdminBoard } from './PressAdminBoard'

export const metadata: Metadata = {
  title: 'Presse — Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface PressReleaseAdminRow {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly subtitle: string | null
  readonly dateline: string | null
  readonly category: string
  readonly status: 'draft' | 'pending_review' | 'approved' | 'sent' | 'archived'
  readonly bodyWordCount: number
  readonly contactsAtSend: number
  readonly emailsSent: number
  readonly emailsFailed: number
  readonly aiCostEur: number
  readonly approvedAt: string | null
  readonly sentAt: string | null
  readonly createdAt: string
}

export interface PressAdminSummary {
  readonly activeContacts: number
  readonly totalReleasesSent: number
  readonly lastSentAt: string | null
  readonly lastDraftCreatedAt: string | null
}

interface RawReleaseRow {
  id: string
  slug: string
  title: string
  subtitle: string | null
  dateline: string | null
  category: string
  status: 'draft' | 'pending_review' | 'approved' | 'sent' | 'archived'
  body_markdown: string
  contacts_at_send: number
  emails_sent: number
  emails_failed: number
  ai_cost_eur: number
  approved_at: string | null
  sent_at: string | null
  created_at: string
}

async function loadReleases(): Promise<PressReleaseAdminRow[]> {
  const supabase = createAdminClient()
  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { data, error } = await (supabase as any)
    .from('press_releases')
    .select(
      'id, slug, title, subtitle, dateline, category, status, body_markdown, contacts_at_send, emails_sent, emails_failed, ai_cost_eur, approved_at, sent_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(24)

  if (error) {
    console.error('loadReleases admin/press error:', error.message)
    return []
  }

  return ((data ?? []) as RawReleaseRow[]).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    dateline: r.dateline,
    category: r.category,
    status: r.status,
    bodyWordCount: r.body_markdown ? r.body_markdown.split(/\s+/).length : 0,
    contactsAtSend: r.contacts_at_send,
    emailsSent: r.emails_sent,
    emailsFailed: r.emails_failed,
    aiCostEur: r.ai_cost_eur,
    approvedAt: r.approved_at,
    sentAt: r.sent_at,
    createdAt: r.created_at,
  }))
}

async function loadSummary(): Promise<PressAdminSummary> {
  const supabase = createAdminClient()

  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { count: activeContacts } = await (supabase as any)
    .from('press_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('opt_in', true)
    .is('unsubscribed_at', null)

  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { count: totalSent } = await (supabase as any)
    .from('press_releases')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')

  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { data: lastSent } = await (supabase as any)
    .from('press_releases')
    .select('sent_at')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { data: lastDraft } = await (supabase as any)
    .from('press_releases')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    activeContacts: activeContacts ?? 0,
    totalReleasesSent: totalSent ?? 0,
    lastSentAt: (lastSent as { sent_at?: string } | null)?.sent_at ?? null,
    lastDraftCreatedAt: (lastDraft as { created_at?: string } | null)?.created_at ?? null,
  }
}

export default async function AdminPressPage() {
  const [releases, summary] = await Promise.all([loadReleases(), loadSummary()])

  return <PressAdminBoard releases={releases} summary={summary} />
}
