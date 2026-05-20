/**
 * /admin/actions — Itération 10.
 *
 * 6 sections : BroadcastComposer + BroadcastHistory + EmailTemplatesManager
 *            + FinancialActionsPanel + TechnicalToolsPanel + SystemTestsPanel.
 *
 * Server component : charge broadcast_history (20) + email_templates + total users
 * via service_role (gate déjà appliquée par /admin/(gated)/layout.tsx).
 */

import { BroadcastComposer } from '@/components/admin/actions/BroadcastComposer'
import { BroadcastHistory } from '@/components/admin/actions/BroadcastHistory'
import { EmailTemplatesManager } from '@/components/admin/actions/EmailTemplatesManager'
import { FinancialActionsPanel } from '@/components/admin/actions/FinancialActionsPanel'
import { SystemTestsPanel } from '@/components/admin/actions/SystemTestsPanel'
import { TechnicalToolsPanel } from '@/components/admin/actions/TechnicalToolsPanel'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import type { BroadcastHistoryRow, EmailTemplateRow } from '@/lib/admin/broadcasts-types'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Actions',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ListResult<T> {
  data: T[] | null
  error: { message: string } | null
}

interface CountResult {
  count: number | null
  error: { message: string } | null
}

async function fetchActionsPageData(): Promise<{
  broadcasts: BroadcastHistoryRow[]
  templates: EmailTemplateRow[]
  totalUsers: number
}> {
  const supabase = createAdminClient()

  const [broadcastsRes, templatesRes, totalRes] = await Promise.all([
    (
      supabase.from('broadcast_history') as unknown as {
        select: (cols: string) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (n: number) => Promise<ListResult<BroadcastHistoryRow>>
          }
        }
      }
    )
      .select(
        'id, subject, body_html, body_text, audience_filter, recipients_count, status, sent_at, delivered_count, opened_count, clicked_count, error_count, created_at, created_by',
      )
      .order('created_at', { ascending: false })
      .limit(20),
    (
      supabase.from('email_templates') as unknown as {
        select: (cols: string) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<ListResult<EmailTemplateRow>>
        }
      }
    )
      .select(
        'id, key, name, subject, body_html, body_text, variables, active, created_at, updated_at',
      )
      .order('created_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true }) as unknown as Promise<CountResult>,
  ])

  return {
    broadcasts: broadcastsRes.data ?? [],
    templates: templatesRes.data ?? [],
    totalUsers: totalRes.count ?? 0,
  }
}

export default async function AdminActionsPage() {
  const access = await verifyAdminAccess()
  // Sécurité supplémentaire (le layout (gated) fait déjà le check).
  if (!access.isAdmin || !access.user) redirect('/')

  const data = await fetchActionsPageData()

  return (
    <div className="space-y-7 max-w-7xl">
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          🔧 Actions admin · {data.broadcasts.length} broadcasts récents
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Actions.
        </h1>
        <p className="text-sm text-ink-mute max-w-xl">
          Envois de masse, templates email, outils techniques et smoke tests système.
        </p>
      </div>

      <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
        <BroadcastComposer totalUsers={data.totalUsers} />
        <BroadcastHistory rows={data.broadcasts} />
      </div>

      <EmailTemplatesManager templates={data.templates.filter((t) => t.active)} />

      <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
        <FinancialActionsPanel />
        <TechnicalToolsPanel />
        <SystemTestsPanel defaultEmail={access.user.email} />
      </div>
    </div>
  )
}
