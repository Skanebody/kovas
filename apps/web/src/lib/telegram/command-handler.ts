/**
 * Dispatcher des commandes slash du bot Telegram (`/start`, `/stats`, `/user`, …).
 *
 * Chaque handler reçoit `{ chatId, args, userId, supabase, messageId }` et
 * appelle `sendMessage()` pour répondre. Toutes les commandes sont auditées
 * en amont par `webhook-handler.ts` (table telegram_bot_interactions).
 *
 * Convention parsing :
 *   - `/cmd arg1 arg2 ...` → `args = ['arg1', 'arg2', ...]`
 *   - `/cmd@KovasBot` (mode groupe) → strip suffix `@bot_name`
 *
 * Format Markdown : on utilise `parse_mode: 'Markdown'` (V1 lenient — pas
 * MarkdownV2 qui exige un escape plus strict). `*bold*`, `_italic_`,
 * `` `code` ``, `[link](url)`.
 */

import { calculateMRR, calculateMonthCosts } from '@/lib/admin/finance-calculator'
import { getDauWauMau, getSignupsByDay } from '@/lib/admin/growth-analytics'
import {
  getCacheHitRate,
  getIAUsageMonth,
  getIAUsageToday,
  getTopConsumers,
} from '@/lib/admin/ia-analytics'
import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildInlineKeyboard, sendMessage } from './bot-client'
import type { TelegramMessage } from './types'

type AdminSupabase = SupabaseClient<Database>

export interface CommandContext {
  chatId: number
  args: string[]
  userId: string
  supabase: AdminSupabase
  messageId: number
}

type CommandHandler = (ctx: CommandContext) => Promise<void>

// ============================================
// Helpers de formatage
// ============================================

const PUBLIC_APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? 'https://kovas.fr'

function fmtEur(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—'
  return `${n.toFixed(digits)}%`
}

function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}

function escapeMd(s: string): string {
  // Markdown lenient : on échappe seulement les caractères à risque pour ne
  // pas casser la mise en forme (apostrophes/parenthèses tolérées).
  return s.replace(/[*_`[\]]/g, (m) => `\\${m}`)
}

function shortId(uuid: string): string {
  return uuid.length >= 8 ? uuid.slice(0, 8) : uuid
}

// ============================================
// Type rows (queries inline ad-hoc)
// ============================================

interface ProfileSearchRow {
  id: string
  email: string
  full_name: string | null
  created_at: string
  last_active_at: string | null
  default_org_id: string | null
}

interface OrgInfoRow {
  id: string
  name: string
  plan: string | null
  plan_status: string | null
  suspended_at: string | null
}

interface SubInfoRow {
  organization_id: string
  tier: string | null
  status: string
}

interface InvoicePaidRow {
  organization_id: string
  amount_ttc: number | string | null
}

// ============================================
// /start
// ============================================
const handleStart: CommandHandler = async ({ chatId }) => {
  const text = [
    '👋 *KOVAS admin bot*',
    '',
    'Bot personnel de pilotage. Tape /help pour la liste des commandes.',
    '',
    'Commandes principales :',
    '• `/stats` — chiffres clés (today / week / month)',
    '• `/user <query>` — fiche utilisateur',
    '• `/mrr` — MRR & breakdown plans',
    '• `/cost` — coûts IA & top consumers',
    '• `/alertes` — alertes actives',
    '• `/sante` — health checks system',
  ].join('\n')
  await sendMessage(chatId, text, { parse_mode: 'Markdown' })
}

// ============================================
// /help
// ============================================
const handleHelp: CommandHandler = async ({ chatId }) => {
  const text = [
    '📖 *KOVAS admin bot — commandes*',
    '',
    '*Métriques business*',
    '• `/stats [today|week|month]` — MRR + DAU + coûts + signups',
    '• `/mrr` — MRR détaillé + delta MoM + top plans',
    '• `/cost [today|month]` — coûts IA + top 5 consumers',
    '',
    '*Utilisateurs*',
    '• `/user <email|id|name>` — fiche utilisateur (≥3 caractères)',
    '',
    '*Alertes & santé*',
    '• `/alertes` — alertes actives (critical + warning + info)',
    '• `/erreurs` — erreurs récentes (ai_usage failed + audit log)',
    '• `/sante` — health checks Supabase / Anthropic / Stripe / Queue',
    '',
    "_Astuce : tape une question en langage naturel — l'IA est branchée bientôt._",
  ].join('\n')
  await sendMessage(chatId, text, { parse_mode: 'Markdown' })
}

// ============================================
// /stats [today|week|month]
// ============================================
const handleStats: CommandHandler = async ({ chatId, args, supabase }) => {
  const period = (args[0] ?? 'today').toLowerCase()
  if (period !== 'today' && period !== 'week' && period !== 'month') {
    await sendMessage(chatId, 'Usage : `/stats today` · `/stats week` · `/stats month`', {
      parse_mode: 'Markdown',
    })
    return
  }

  try {
    const [mrr, costs, growth, iaMonth] = await Promise.all([
      calculateMRR(supabase),
      calculateMonthCosts(supabase, new Date()),
      getDauWauMau(supabase),
      getIAUsageMonth(supabase),
    ])

    let signupsWindow = 0
    if (period === 'today') {
      const days = await getSignupsByDay(supabase, 1)
      signupsWindow = days[days.length - 1]?.count ?? 0
    } else if (period === 'week') {
      const days = await getSignupsByDay(supabase, 7)
      signupsWindow = days.reduce((acc, d) => acc + d.count, 0)
    } else {
      const days = await getSignupsByDay(supabase, 30)
      signupsWindow = days.reduce((acc, d) => acc + d.count, 0)
    }

    const periodLabel =
      period === 'today'
        ? "aujourd'hui"
        : period === 'week'
          ? '7 derniers jours'
          : '30 derniers jours'

    const text = [
      `📊 *Stats — ${periodLabel}*`,
      '',
      `💰 *MRR* : ${fmtEur(mrr.total)}  (Δ ${fmtEur(mrr.growth.mom)} / ${fmtPct(mrr.growth.momPct)})`,
      `🧾 *Coûts mois* : ${fmtEur(costs.total)} (IA ${fmtEur(costs.ia)})`,
      `🤖 *IA mois* : ${fmtEur(iaMonth.costEur)} · ${fmtInt(iaMonth.callsCount)} calls`,
      '',
      '👥 *Activité*',
      `• DAU : ${fmtInt(growth.dau)}  ·  WAU : ${fmtInt(growth.wau)}  ·  MAU : ${fmtInt(growth.mau)}`,
      `• Sticky : ${fmtPct(growth.stickyRatio * 100)}`,
      `• Signups ${periodLabel} : ${fmtInt(signupsWindow)}`,
    ].join('\n')

    await sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: buildInlineKeyboard([
        [{ text: '📈 Voir détail', url: `${PUBLIC_APP_BASE_URL}/admin` }],
      ]),
    })
  } catch (e) {
    await sendMessage(chatId, `❌ Erreur stats : ${e instanceof Error ? e.message : 'unknown'}`, {
      parse_mode: 'Markdown',
    })
  }
}

// ============================================
// /user <query>
// ============================================
async function searchProfiles(
  supabase: AdminSupabase,
  q: string,
  limit = 5,
): Promise<ProfileSearchRow[]> {
  // Recherche par email/full_name/id. On accepte un UUID complet (eq id),
  // sinon ILIKE sur email + full_name.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)
  if (isUuid) {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at, last_active_at, default_org_id')
      .eq('id', q)
      .limit(1)
    return (data ?? []) as ProfileSearchRow[]
  }

  // Recherche multi-champs : on combine 2 queries avec OR custom (ILIKE).
  const escaped = q.replace(/[%_,]/g, (m) => `\\${m}`)
  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, created_at, last_active_at, default_org_id')
    .or(`email.ilike.%${escaped}%,full_name.ilike.%${escaped}%`)
    .limit(limit)
  return (data ?? []) as ProfileSearchRow[]
}

async function buildUserCard(supabase: AdminSupabase, profile: ProfileSearchRow): Promise<string> {
  const orgId = profile.default_org_id
  let org: OrgInfoRow | null = null
  let sub: SubInfoRow | null = null
  let lifetimeRevenue = 0
  let missionsThisMonth = 0

  if (orgId) {
    const orgRes = await supabase
      .from('organizations')
      .select('id, name, plan, plan_status, suspended_at')
      .eq('id', orgId)
      .maybeSingle<OrgInfoRow>()
    org = orgRes.data ?? null

    const subRes = await supabase
      .from('subscriptions')
      .select('organization_id, tier, status')
      .eq('organization_id', orgId)
      .maybeSingle<SubInfoRow>()
    sub = subRes.data ?? null

    const invRes = await supabase
      .from('invoices')
      .select('organization_id, amount_ttc')
      .eq('organization_id', orgId)
      .eq('status', 'paid')
    for (const row of (invRes.data ?? []) as InvoicePaidRow[]) {
      const amt =
        typeof row.amount_ttc === 'string'
          ? Number.parseFloat(row.amount_ttc)
          : (row.amount_ttc ?? 0)
      lifetimeRevenue += Number.isFinite(amt) ? amt : 0
    }

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const missionsRes = await supabase
      .from('missions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('created_at', monthStart)
      .is('deleted_at', null)
    missionsThisMonth = missionsRes.count ?? 0
  }

  const planLabel = sub?.tier ?? org?.plan ?? '—'
  const statusLabel = sub?.status ?? org?.plan_status ?? '—'
  const suspendedTag = org?.suspended_at ? ' ⛔ *Suspendu*' : ''
  const lastActive = profile.last_active_at
    ? new Date(profile.last_active_at).toLocaleString('fr-FR', {
        timeZone: 'Europe/Paris',
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : 'jamais'

  return [
    `👤 *${escapeMd(profile.full_name ?? profile.email)}*${suspendedTag}`,
    `📧 \`${profile.email}\`  ·  id \`${shortId(profile.id)}\``,
    org ? `🏢 ${escapeMd(org.name)}` : '🏢 _aucune org_',
    `💎 Plan : *${escapeMd(planLabel)}*  ·  ${escapeMd(statusLabel)}`,
    `📦 Missions ce mois : *${fmtInt(missionsThisMonth)}*`,
    `💰 Lifetime revenue : *${fmtEur(lifetimeRevenue)}*`,
    `🕐 Dernière activité : ${lastActive}`,
  ].join('\n')
}

const handleUser: CommandHandler = async ({ chatId, args, supabase }) => {
  const q = args.join(' ').trim()
  if (q.length < 3) {
    await sendMessage(chatId, 'Usage : `/user <email | id | nom>` (≥ 3 caractères)', {
      parse_mode: 'Markdown',
    })
    return
  }

  try {
    const profiles = await searchProfiles(supabase, q, 5)
    if (profiles.length === 0) {
      await sendMessage(chatId, `🔎 Aucun utilisateur pour _${escapeMd(q)}_`, {
        parse_mode: 'Markdown',
      })
      return
    }
    if (profiles.length === 1) {
      const first = profiles[0]
      if (!first) return
      const card = await buildUserCard(supabase, first)
      await sendMessage(chatId, card, {
        parse_mode: 'Markdown',
        reply_markup: buildInlineKeyboard([
          [
            {
              text: '🌐 Ouvrir dans /admin',
              url: `${PUBLIC_APP_BASE_URL}/admin/users/${first.id}`,
            },
          ],
        ]),
      })
      return
    }

    // Plusieurs résultats : on liste.
    const lines = ['🔎 Plusieurs résultats — précise avec email ou id :', '']
    for (let i = 0; i < profiles.length; i++) {
      const p = profiles[i]
      if (!p) continue
      lines.push(
        `${i + 1}. ${escapeMd(p.full_name ?? p.email)} · \`${p.email}\` · id \`${shortId(p.id)}\``,
      )
    }
    await sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' })
  } catch (e) {
    await sendMessage(chatId, `❌ Erreur /user : ${e instanceof Error ? e.message : 'unknown'}`, {
      parse_mode: 'Markdown',
    })
  }
}

// ============================================
// /cost [today|month]
// ============================================
const handleCost: CommandHandler = async ({ chatId, args, supabase }) => {
  const period = (args[0] ?? 'month').toLowerCase()
  if (period !== 'today' && period !== 'month') {
    await sendMessage(chatId, 'Usage : `/cost today` · `/cost month`', { parse_mode: 'Markdown' })
    return
  }

  try {
    const [today, month, top, cache] = await Promise.all([
      getIAUsageToday(supabase),
      getIAUsageMonth(supabase),
      getTopConsumers(supabase, 5),
      getCacheHitRate(supabase),
    ])

    const usage = period === 'today' ? today : month
    const periodLabel = period === 'today' ? "aujourd'hui" : 'ce mois'
    const trendArrow = cache.trend === 'up' ? '↗' : cache.trend === 'down' ? '↘' : '→'

    const lines = [
      `🤖 *Coût IA — ${periodLabel}*`,
      '',
      `*Total* : ${fmtEur(usage.costEur)} · ${fmtInt(usage.callsCount)} calls`,
      `*Cache 30j* : ${fmtPct(cache.rate30d * 100)} ${trendArrow} 7j ${fmtPct(cache.rate7d * 100)}`,
      '',
      '*Top 5 consumers (ce mois)*',
    ]
    if (top.length === 0) {
      lines.push('_Aucun consumer enregistré_')
    } else {
      for (let i = 0; i < top.length; i++) {
        const t = top[i]
        if (!t) continue
        lines.push(
          `${i + 1}. ${escapeMd(t.orgName)} — ${fmtEur(t.costEur)} (${fmtPct(t.percentOfTotal)})`,
        )
      }
    }

    await sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' })
  } catch (e) {
    await sendMessage(chatId, `❌ Erreur /cost : ${e instanceof Error ? e.message : 'unknown'}`, {
      parse_mode: 'Markdown',
    })
  }
}

// ============================================
// /mrr
// ============================================
const handleMRR: CommandHandler = async ({ chatId, supabase }) => {
  try {
    const mrr = await calculateMRR(supabase)
    const lines = [
      '💰 *MRR — état actuel*',
      '',
      `*Total* : ${fmtEur(mrr.total)}`,
      `Δ MoM : ${fmtEur(mrr.growth.mom)} (${fmtPct(mrr.growth.momPct)})`,
      '',
      '*Breakdown par plan*',
    ]
    const planEntries = Object.entries(mrr.byPlan).filter(([, v]) => v > 0)
    if (planEntries.length === 0) {
      lines.push('_Aucun abonnement actif_')
    } else {
      planEntries.sort(([, a], [, b]) => b - a)
      for (const [plan, value] of planEntries) {
        const pct = mrr.total > 0 ? (value / mrr.total) * 100 : 0
        lines.push(`• ${escapeMd(plan)} : ${fmtEur(value)} (${fmtPct(pct)})`)
      }
    }
    await sendMessage(chatId, lines.join('\n'), {
      parse_mode: 'Markdown',
      reply_markup: buildInlineKeyboard([
        [{ text: '📈 Voir détail finance', url: `${PUBLIC_APP_BASE_URL}/admin/finance` }],
      ]),
    })
  } catch (e) {
    await sendMessage(chatId, `❌ Erreur /mrr : ${e instanceof Error ? e.message : 'unknown'}`, {
      parse_mode: 'Markdown',
    })
  }
}

// ============================================
// /alertes
// ============================================
interface AlertEventListRow {
  id: string
  target_label: string | null
  actual_value: number | string | null
  threshold_value: number | string | null
  created_at: string
  alert_rules:
    | { name: string; severity: 'info' | 'warning' | 'critical' }
    | { name: string; severity: 'info' | 'warning' | 'critical' }[]
    | null
}

const handleAlertes: CommandHandler = async ({ chatId, supabase }) => {
  try {
    interface AlertEventsBuilder {
      select: (cols: string) => {
        eq: (
          col: string,
          val: boolean,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (n: number) => Promise<{
              data: AlertEventListRow[] | null
              error: { message: string } | null
            }>
          }
        }
      }
    }
    const builder = supabase.from('alert_events') as unknown as AlertEventsBuilder
    const { data, error } = await builder
      .select(
        'id, target_label, actual_value, threshold_value, created_at, alert_rules:rule_id (name, severity)',
      )
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      throw new Error(error.message)
    }
    const events = (data ?? []) as AlertEventListRow[]
    if (events.length === 0) {
      await sendMessage(chatId, '✅ *Aucune alerte active*', { parse_mode: 'Markdown' })
      return
    }

    const sevIcon: Record<string, string> = {
      critical: '🔴',
      warning: '🟠',
      info: '🔵',
    }
    const lines = ['🚨 *Alertes actives*', '']
    for (const e of events.slice(0, 10)) {
      const rule = Array.isArray(e.alert_rules) ? e.alert_rules[0] : e.alert_rules
      const icon = sevIcon[rule?.severity ?? 'info'] ?? '⚪'
      const ts = new Date(e.created_at).toLocaleString('fr-FR', {
        timeZone: 'Europe/Paris',
        dateStyle: 'short',
        timeStyle: 'short',
      })
      const target = e.target_label ? ` — ${escapeMd(e.target_label)}` : ''
      lines.push(`${icon} ${escapeMd(rule?.name ?? '(règle ?)')}${target}  _${ts}_`)
    }
    if (events.length > 10) {
      lines.push('', `_… +${events.length - 10} autres_`)
    }

    await sendMessage(chatId, lines.join('\n'), {
      parse_mode: 'Markdown',
      reply_markup: buildInlineKeyboard([
        [{ text: '🌐 Voir toutes les alertes', url: `${PUBLIC_APP_BASE_URL}/admin/alertes` }],
      ]),
    })
  } catch (e) {
    await sendMessage(
      chatId,
      `❌ Erreur /alertes : ${e instanceof Error ? e.message : 'unknown'}`,
      { parse_mode: 'Markdown' },
    )
  }
}

// ============================================
// /erreurs
// ============================================
interface AuditFailedRow {
  id: string
  action_type: string
  target_label: string | null
  error_message: string | null
  created_at: string
}

const handleErreurs: CommandHandler = async ({ chatId, supabase }) => {
  try {
    // V1 : on liste les 5 dernières actions admin failed (succeeded=false).
    interface AuditBuilder {
      select: (cols: string) => {
        eq: (
          col: string,
          val: boolean,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (n: number) => Promise<{
              data: AuditFailedRow[] | null
              error: { message: string } | null
            }>
          }
        }
      }
    }
    const builder = supabase.from('admin_audit_log') as unknown as AuditBuilder
    const { data, error } = await builder
      .select('id, action_type, target_label, error_message, created_at')
      .eq('succeeded', false)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) throw new Error(error.message)
    const rows = (data ?? []) as AuditFailedRow[]
    if (rows.length === 0) {
      await sendMessage(chatId, '✅ *Aucune erreur admin récente*', { parse_mode: 'Markdown' })
      return
    }

    const lines = ['❌ *5 dernières erreurs admin*', '']
    for (const r of rows) {
      const ts = new Date(r.created_at).toLocaleString('fr-FR', {
        timeZone: 'Europe/Paris',
        dateStyle: 'short',
        timeStyle: 'short',
      })
      const tgt = r.target_label ? ` · ${escapeMd(r.target_label)}` : ''
      const msg = r.error_message ? ` — _${escapeMd(r.error_message.slice(0, 100))}_` : ''
      lines.push(`• \`${r.action_type}\`${tgt}${msg}  _${ts}_`)
    }

    await sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' })
  } catch (e) {
    await sendMessage(
      chatId,
      `❌ Erreur /erreurs : ${e instanceof Error ? e.message : 'unknown'}`,
      { parse_mode: 'Markdown' },
    )
  }
}

// ============================================
// /sante
// ============================================
const handleSante: CommandHandler = async ({ chatId, supabase }) => {
  try {
    // Health check inline (subset de /api/admin/health) — on évite l'appel
    // HTTP self-referent pour rester self-contained dans le webhook.
    const start = performance.now()
    const probe = await supabase
      .from('admin_users')
      .select('user_id', { count: 'exact', head: true })
    const supabaseMs = performance.now() - start

    interface AiUsageProbeRow {
      created_at: string
    }
    const lastAiRes = await supabase
      .from('ai_usage')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<AiUsageProbeRow>()

    const ageMinAi = lastAiRes.data
      ? Math.floor((Date.now() - new Date(lastAiRes.data.created_at).getTime()) / 60_000)
      : null

    const queueRes = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'queued')
    const queueCount = queueRes.count ?? 0

    const supabaseStatus = supabaseMs < 200 ? '🟢' : supabaseMs < 1000 ? '🟠' : '🔴'
    const aiStatus =
      ageMinAi === null ? '⚪' : ageMinAi < 60 ? '🟢' : ageMinAi < 24 * 60 ? '🟠' : '🔴'
    const queueStatus = queueCount === 0 ? '🟢' : queueCount < 50 ? '🟠' : '🔴'

    const lines = [
      '❤️ *Health checks*',
      '',
      `${supabaseStatus} *Supabase* — ${Math.round(supabaseMs)} ms${probe.error ? ' (erreur)' : ''}`,
      `${aiStatus} *Anthropic* — ${ageMinAi === null ? 'aucun signal' : ageMinAi < 60 ? `${ageMinAi} min` : ageMinAi < 24 * 60 ? `${Math.floor(ageMinAi / 60)} h` : '> 1 j'}`,
      `${queueStatus} *Queue jobs* — ${queueCount} en attente`,
    ]

    await sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' })
  } catch (e) {
    await sendMessage(chatId, `❌ Erreur /sante : ${e instanceof Error ? e.message : 'unknown'}`, {
      parse_mode: 'Markdown',
    })
  }
}

// ============================================
// Registry
// ============================================
const COMMANDS: Record<string, CommandHandler> = {
  '/start': handleStart,
  '/help': handleHelp,
  '/stats': handleStats,
  '/user': handleUser,
  '/cost': handleCost,
  '/mrr': handleMRR,
  '/alertes': handleAlertes,
  '/erreurs': handleErreurs,
  '/sante': handleSante,
}

export function isKnownCommand(text: string): boolean {
  const cmd = parseCommandName(text)
  return cmd !== null && cmd in COMMANDS
}

function parseCommandName(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('/')) return null
  const firstWord = trimmed.split(/\s+/)[0] ?? ''
  // Strip suffix @BotName (mode group)
  const atIdx = firstWord.indexOf('@')
  const name = atIdx === -1 ? firstWord : firstWord.slice(0, atIdx)
  return name.toLowerCase()
}

/**
 * Dispatcher principal. Si la commande n'est pas connue → message "/help".
 * Toute exception interne est attrapée et reportée à l'utilisateur sans crash.
 */
export async function handleCommand(
  message: TelegramMessage,
  supabase: AdminSupabase,
  userId: string,
): Promise<{ commandName: string | null; succeeded: boolean; response: string; error?: string }> {
  const text = message.text ?? ''
  const cmdName = parseCommandName(text)
  const chatId = message.chat.id

  if (!cmdName) {
    await sendMessage(chatId, '💡 Tape /help pour la liste des commandes.', {
      parse_mode: 'Markdown',
    })
    return { commandName: null, succeeded: true, response: '/help hint' }
  }

  const handler = COMMANDS[cmdName]
  if (!handler) {
    await sendMessage(chatId, `❓ Commande inconnue : \`${escapeMd(cmdName)}\`. Tape /help.`, {
      parse_mode: 'Markdown',
    })
    return { commandName: cmdName, succeeded: false, response: 'unknown command' }
  }

  // Args = tokens après la commande (split sur whitespace)
  const args = text.trim().split(/\s+/).slice(1)

  try {
    await handler({
      chatId,
      args,
      userId,
      supabase,
      messageId: message.message_id,
    })
    return { commandName: cmdName, succeeded: true, response: 'ok' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    console.error(`[telegram/command-handler] ${cmdName} crashed`, e)
    await sendMessage(chatId, `❌ Erreur interne : ${escapeMd(msg)}`, { parse_mode: 'Markdown' })
    return { commandName: cmdName, succeeded: false, response: 'error', error: msg }
  }
}
