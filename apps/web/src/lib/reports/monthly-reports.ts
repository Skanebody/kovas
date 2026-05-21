/**
 * Logique métier — rapports mensuels d'activité (CLAUDE.md §21bis V1.5).
 *
 * Pourquoi un fichier dédié plutôt que tout dans la route cron ?
 *  - Réutilisable par le cron (1er du mois) ET l'action admin manuelle.
 *  - Plus facile à tester unitairement.
 *
 * Toutes les opérations DB passent via service_role (les casts évitent les
 * limitations du type Database généré : la table `monthly_reports` n'est pas
 * encore dans `packages/database/src/types.ts` — il faut regen après merge).
 */

import { sendEmail } from '@/lib/email/send'
import { buildMonthlyReportEmail } from '@/lib/email/templates/monthly-report'
import type { Database } from '@kovas/database/types'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ============================================
// Types
// ============================================

export interface MonthlyReportRow {
  id: string
  organization_id: string
  user_id: string
  period_year: number
  period_month: number
  missions_count: number
  time_saved_minutes: number
  value_generated_cents: number
  top_diagnostic_type: string | null
  sent_at: string | null
  email_status: 'pending' | 'sent' | 'failed' | 'bounced' | 'skipped'
  email_message_id: string | null
  email_error: string | null
  retry_count: number
  created_at: string
  updated_at: string
}

export interface RunMonthlyReportsResult {
  organizations_scanned: number
  reports_computed: number
  emails_sent: number
  emails_skipped: number
  emails_failed: number
  errors: string[]
}

export interface ProcessOneReportResult {
  status: 'sent' | 'skipped' | 'failed'
  reason?: string
  message_id?: string
}

export const MAX_RETRY_COUNT = 3

// ============================================
// Supabase client cron (service_role bypass RLS)
// ============================================

export type CronSupabase = SupabaseClient<Database>

export function createMonthlyReportsSupabaseClient(): CronSupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'monthly-reports: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante.',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ============================================
// Calcul de la période "mois précédent" (Europe/Paris)
// ============================================

/**
 * À partir d'une date de référence (par défaut now()), retourne {year, month}
 * du MOIS PRÉCÉDENT en timezone Europe/Paris. Ex : appelé le 01/06/2026 à 7h UTC
 * (= 9h Paris été), retourne {2026, 5}.
 */
export function previousMonth(reference: Date = new Date()): {
  year: number
  month: number
} {
  // On extrait year/month en Europe/Paris en formatant via locale en-CA (YYYY-MM-DD)
  const parisYearMonth = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
  }).format(reference)
  // Format: "2026-06"
  const [yStr, mStr] = parisYearMonth.split('-')
  const y = Number.parseInt(yStr ?? '0', 10)
  const m = Number.parseInt(mStr ?? '0', 10)
  if (m === 1) return { year: y - 1, month: 12 }
  return { year: y, month: m - 1 }
}

// ============================================
// Helpers casts (table monthly_reports pas dans Database types)
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */
// On utilise un cast minimal `as unknown as` au point d'entrée — pas de `any`
// éparpillés dans la logique métier.

interface OrgRow {
  id: string
  name: string
  plan: string
  plan_status: string
}

interface SubscriptionRow {
  organization_id: string
  status: string
}

interface ProfileRow {
  id: string
  email: string | null
  full_name: string | null
}

interface UserPrefRow {
  user_id: string
  monthly_report_email_enabled: boolean
}

// ============================================
// Process : envoi d'un rapport pour une org/mois donnés
// ============================================

interface ProcessOptions {
  supabase: CronSupabase
  organizationId: string
  year: number
  month: number
  /** Forcer l'envoi même si déjà 'sent' (utile pour test admin). */
  force?: boolean
}

export async function computeAndSendMonthlyReport(
  opts: ProcessOptions,
): Promise<ProcessOneReportResult> {
  const { supabase, organizationId, year, month, force } = opts

  // 1. Compute / upsert la ligne via RPC SQL
  const rpc = await (supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: MonthlyReportRow | null; error: { message: string } | null }>
  }).rpc('compute_monthly_report', {
    p_org_id: organizationId,
    p_year: year,
    p_month: month,
  })

  if (rpc.error || !rpc.data) {
    return {
      status: 'failed',
      reason: `compute_monthly_report RPC: ${rpc.error?.message ?? 'no data'}`,
    }
  }

  const report = rpc.data

  // 2. Idempotence : skip si déjà envoyé (sauf force)
  if (!force && report.email_status === 'sent') {
    return { status: 'skipped', reason: 'déjà envoyé', message_id: report.email_message_id ?? undefined }
  }

  // 3. Skip si retry > MAX_RETRY_COUNT (anti boucle infinie)
  if (!force && report.retry_count >= MAX_RETRY_COUNT && report.email_status === 'failed') {
    return { status: 'skipped', reason: `retry_count >= ${MAX_RETRY_COUNT}` }
  }

  // 4. Skip si 0 mission ce mois — pas de bruit dans la boîte mail
  if (!force && report.missions_count === 0) {
    await markStatus(supabase, report.id, 'skipped', null, 'aucune mission ce mois')
    return { status: 'skipped', reason: 'aucune mission ce mois' }
  }

  // 5. Récup profil destinataire + préférences opt-out
  const profileQ = (await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', report.user_id)
    .maybeSingle()) as unknown as { data: ProfileRow | null; error: { message: string } | null }

  if (profileQ.error || !profileQ.data || !profileQ.data.email) {
    await markStatus(supabase, report.id, 'failed', null, 'profil destinataire introuvable')
    return { status: 'failed', reason: 'profil destinataire introuvable' }
  }

  const profile: { id: string; email: string; full_name: string | null } = {
    id: profileQ.data.id,
    email: profileQ.data.email,
    full_name: profileQ.data.full_name,
  }

  // Préférence opt-out (table user_preferences)
  const prefQ = (await (supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => { maybeSingle: () => Promise<{ data: UserPrefRow | null; error: unknown }> }
      }
    }
  })
    .from('user_preferences')
    .select('user_id, monthly_report_email_enabled')
    .eq('user_id', report.user_id)
    .maybeSingle()) as { data: UserPrefRow | null; error: unknown }

  // Default opt-in : si pas de ligne user_preferences, on envoie.
  const optedIn = prefQ.data?.monthly_report_email_enabled !== false
  if (!force && !optedIn) {
    await markStatus(supabase, report.id, 'skipped', null, 'utilisateur opt-out')
    return { status: 'skipped', reason: 'utilisateur opt-out' }
  }

  // 6. Récup le mois précédent pour trend
  const prevMonthRef = previousMonthBefore(year, month)
  const prevQ = (await (supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col2: string, val2: number) => {
            eq: (
              col3: string,
              val3: number,
            ) => { maybeSingle: () => Promise<{ data: MonthlyReportRow | null; error: unknown }> }
          }
        }
      }
    }
  })
    .from('monthly_reports')
    .select('missions_count')
    .eq('organization_id', organizationId)
    .eq('period_year', prevMonthRef.year)
    .eq('period_month', prevMonthRef.month)
    .maybeSingle()) as { data: MonthlyReportRow | null; error: unknown }

  const previousCount: number | null = prevQ.data?.missions_count ?? null

  // 7. Build email
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kovas.fr'
  const content = buildMonthlyReportEmail({
    recipientName: profile.full_name ?? profile.email,
    recipientEmail: profile.email,
    periodYear: year,
    periodMonth: month,
    missionsCount: report.missions_count,
    missionsCountPrevious: previousCount,
    timeSavedMinutes: report.time_saved_minutes,
    valueGeneratedCents: report.value_generated_cents,
    topDiagnosticType: report.top_diagnostic_type,
    dashboardUrl: `${baseUrl}/app/gain`,
    unsubscribeUrl: `${baseUrl}/app/account`,
  })

  // 8. Send via Resend
  const result = await sendEmail({
    to: profile.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    category: 'digest',
  })

  if (!result.success) {
    await markStatus(supabase, report.id, 'failed', null, result.error ?? 'erreur Resend')
    return { status: 'failed', reason: result.error ?? 'erreur Resend' }
  }

  await markStatus(
    supabase,
    report.id,
    'sent',
    result.id ?? (result.stub ? 'stub-dev' : null),
    null,
  )

  return { status: 'sent', message_id: result.id }
}

function previousMonthBefore(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

async function markStatus(
  supabase: CronSupabase,
  reportId: string,
  status: 'sent' | 'failed' | 'skipped',
  messageId: string | null,
  error: string | null,
): Promise<void> {
  await (supabase as unknown as {
    from: (t: string) => {
      update: (patch: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: unknown }>
      }
    }
  })
    .from('monthly_reports')
    .update({
      email_status: status,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      email_message_id: messageId,
      email_error: error,
      retry_count: status === 'failed' ? null : 0, // increment for failed handled by separate update
    })
    .eq('id', reportId)

  // Pour les failed, on incrémente retry_count séparément (impossible en 1 query sans RPC)
  if (status === 'failed') {
    const cur = (await (supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: { retry_count: number } | null
              error: unknown
            }>
          }
        }
      }
    })
      .from('monthly_reports')
      .select('retry_count')
      .eq('id', reportId)
      .maybeSingle()) as { data: { retry_count: number } | null; error: unknown }

    const newCount = (cur.data?.retry_count ?? 0) + 1

    await (supabase as unknown as {
      from: (t: string) => {
        update: (patch: Record<string, unknown>) => {
          eq: (col: string, val: string) => Promise<{ error: unknown }>
        }
      }
    })
      .from('monthly_reports')
      .update({ retry_count: newCount })
      .eq('id', reportId)
  }
}

// ============================================
// Run cron principal : scan toutes orgs actives
// ============================================

export async function runMonthlyReportsCron(
  supabase: CronSupabase,
  reference: Date = new Date(),
): Promise<RunMonthlyReportsResult> {
  const period = previousMonth(reference)
  const result: RunMonthlyReportsResult = {
    organizations_scanned: 0,
    reports_computed: 0,
    emails_sent: 0,
    emails_skipped: 0,
    emails_failed: 0,
    errors: [],
  }

  // Récupère les organisations avec subscription active (ou plan_status='active')
  // ou trial en cours. On exclut les orgs canceled depuis > 30 jours.
  const subsQ = (await supabase
    .from('subscriptions')
    .select('organization_id, status')
    .in('status', ['active', 'trialing', 'past_due'])) as unknown as {
    data: SubscriptionRow[] | null
    error: { message: string } | null
  }

  if (subsQ.error) {
    result.errors.push(`subscriptions query: ${subsQ.error.message}`)
    return result
  }

  const orgIds = Array.from(new Set((subsQ.data ?? []).map((s) => s.organization_id)))

  // Vérif que les orgs ne sont pas soft-deleted
  if (orgIds.length === 0) return result

  const orgsQ = (await supabase
    .from('organizations')
    .select('id, name, plan, plan_status')
    .in('id', orgIds)
    .is('deleted_at', null)) as unknown as {
    data: OrgRow[] | null
    error: { message: string } | null
  }

  if (orgsQ.error) {
    result.errors.push(`organizations query: ${orgsQ.error.message}`)
    return result
  }

  const orgs = orgsQ.data ?? []
  result.organizations_scanned = orgs.length

  // Process séquentiel (V1 — petit volume, ~10-200 orgs).
  // Si volume > 500 orgs, batcher par groupes de 20 avec Promise.all + sleep.
  for (const org of orgs) {
    try {
      const res = await computeAndSendMonthlyReport({
        supabase,
        organizationId: org.id,
        year: period.year,
        month: period.month,
      })
      result.reports_computed++
      if (res.status === 'sent') result.emails_sent++
      else if (res.status === 'skipped') result.emails_skipped++
      else if (res.status === 'failed') {
        result.emails_failed++
        result.errors.push(`${org.id}: ${res.reason ?? 'unknown'}`)
      }
    } catch (err) {
      result.emails_failed++
      result.errors.push(
        `${org.id}: ${err instanceof Error ? err.message : 'unknown'}`,
      )
    }
  }

  return result
}
