import { ReactivationModal } from '@/components/cancellation/ReactivationModal'
import { Button } from '@/components/ui/button'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { getCurrentUser } from '@/lib/auth/current-user'
import { buildCalendarSubscriptionUrl, buildCalendarWebcalUrl } from '@/lib/calendar-token'
import { parisMonthBounds } from '@/lib/paris-dates'
import { ADDON_MODULES, type PricingPlanCode, resolveTierToPlan } from '@/lib/pricing-plans'
import { getStorageUsage } from '@/lib/storage/quota'
import { cn } from '@/lib/utils'
import { LogOut } from 'lucide-react'
import type { Metadata } from 'next'
import { logoutAction } from '../actions'
import { AccountSettingsClient } from './account-settings-client'

export const metadata: Metadata = { title: 'Compte' }

const WINBACK_DISCOUNT_PERCENT = Number.parseInt(process.env.WINBACK_DISCOUNT_PERCENT ?? '50', 10)
const WINBACK_DISCOUNT_DURATION_MONTHS = Number.parseInt(
  process.env.WINBACK_DISCOUNT_DURATION_MONTHS ?? '3',
  10,
)

interface WinbackCodeRow {
  id: string
  user_id: string
  winback_code_used_at: string | null
  winback_code_expires_at: string | null
  confirmed_at: string | null
}

/**
 * Valide le code winback côté server. Retourne le payload si valide pour
 * l'utilisateur courant, sinon null.
 */
async function loadValidWinbackCode(
  rawCode: string | undefined,
  userId: string,
): Promise<{ code: string; expiresAt: string } | null> {
  if (!rawCode || rawCode.length < 10 || rawCode.length > 64) return null
  const admin = createAdminClient()
  const res = (await (
    admin.from('cancellations') as unknown as {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{ data: WinbackCodeRow | null }>
        }
      }
    }
  )
    .select('id, user_id, winback_code_used_at, winback_code_expires_at, confirmed_at')
    .eq('winback_code', rawCode)
    .maybeSingle()) as { data: WinbackCodeRow | null }

  const row = res.data
  if (!row) return null
  if (row.user_id !== userId) return null
  if (row.winback_code_used_at) return null
  if (!row.confirmed_at) return null
  if (!row.winback_code_expires_at) return null
  if (new Date(row.winback_code_expires_at).getTime() < Date.now()) return null

  return { code: rawCode, expiresAt: row.winback_code_expires_at }
}

interface AccountSearchParams {
  reactivate?: string
  expired?: string
  tab?: string
}

const VALID_ACCOUNT_TABS = ['profil', 'securite', 'abonnement', 'cabinet', 'facturation'] as const
type AccountTabKey = (typeof VALID_ACCOUNT_TABS)[number]

function normalizeTab(value: string | undefined): AccountTabKey {
  return value && (VALID_ACCOUNT_TABS as readonly string[]).includes(value)
    ? (value as AccountTabKey)
    : 'profil'
}

/**
 * Page Compte /dashboard/account — refonte 2026-05-23 au pattern fiche client
 * (`/dashboard/clients/[id]`).
 *
 * Architecture cohérente avec /dashboard/gain :
 *  1. Header V5 sobre (paper + bordure fine) :
 *     breadcrumb + nom + email + bouton "Se déconnecter"
 *  2. 4 KPI cards (Plan actuel / Missions ce mois / Stockage utilisé / Membre depuis)
 *  3. PageTabs (client) : Profil / Sécurité / Abonnement / Cabinet / Facturation
 *  4. Contenu conditionnel via `?tab=` (default profil) — délégué au client
 *
 * Sources de vérité respectées :
 *  - DS v5 (sage `#F5F7F4` / dark `#0F1419` / chartreuse `#D4F542`)
 *  - Server actions inchangées
 *  - Workflow résiliation /dashboard/account/cancellation PROTÉGÉ (décret 2023-417)
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams?: Promise<AccountSearchParams>
}) {
  const { supabase, orgId, profile, user } = await getCurrentUser()
  const sp = searchParams ? await searchParams : {}
  const winbackValid = await loadValidWinbackCode(sp.reactivate, user.id)
  const { startIso: monthStartIso } = parisMonthBounds()

  // Préférence opt-out rapport mensuel (cf. CLAUDE.md §21bis).
  const userPrefsP = (
    supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            maybeSingle: () => Promise<{
              data: { monthly_report_email_enabled: boolean } | null
            }>
          }
        }
      }
    }
  )
    .from('user_preferences')
    .select('monthly_report_email_enabled')
    .eq('user_id', user.id)
    .maybeSingle()

  // Dernier snapshot ADEME (tolérant : IIFE async avec try/catch interne).
  const lastAdemeSyncP: Promise<{ data: { created_at: string } | null }> = (async () => {
    try {
      return await (
        supabase as unknown as {
          from: (t: string) => {
            select: (cols: string) => {
              eq: (
                col: string,
                val: string,
              ) => {
                order: (
                  col: string,
                  opts: { ascending: boolean },
                ) => {
                  limit: (n: number) => {
                    maybeSingle: () => Promise<{ data: { created_at: string } | null }>
                  }
                }
              }
            }
          }
        }
      )
        .from('ademe_kpi_snapshots')
        .select('created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    } catch {
      return { data: null }
    }
  })()

  const [
    { data: subscription },
    { count: monthMissions },
    { data: organization },
    { data: profileFull },
    storageUsage,
    userPrefs,
    lastAdemeSync,
  ] = await Promise.all([
    supabase
      .from('subscriptions')
      .select(
        'tier, status, missions_included, overage_price_cents, current_period_end, cancel_at_period_end',
      )
      .eq('organization_id', orgId)
      .maybeSingle(),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte('created_at', monthStartIso),
    supabase
      .from('organizations')
      .select('name, siret, vat_number, address, postal_code, city, certification_n')
      .eq('id', orgId)
      .maybeSingle(),
    supabase.from('profiles').select('linguistic_profile').eq('id', user.id).maybeSingle(),
    getStorageUsage(supabase, orgId).catch(() => null),
    userPrefsP,
    lastAdemeSyncP,
  ])

  const monthlyReportEnabled = userPrefs.data?.monthly_report_email_enabled !== false

  const linguisticProfile = (profileFull?.linguistic_profile ?? {}) as Record<string, unknown>
  const certificatRge =
    typeof linguisticProfile.certificat_rge === 'string' ? linguisticProfile.certificat_rge : null
  const ademeMonitoringEnabled = linguisticProfile.ademe_monitoring_enabled === true

  // Résolution canonique du tier DB → PricingPlan via le helper unique
  // `resolveTierToPlan()` (cf. lib/pricing-plans.ts §6bis). Cette fonction
  // gère TOUS les codes historiques : V3 nus (`decouverte`/`standard`/etc.),
  // V3 suffixés `_legacy`, alias `logiciel_*`, V4/V5 directs.
  //
  // PRINCIPE D'OR : ne JAMAIS faire de mapping manuel `tier → plan` dans
  // une page. Toujours passer par ce helper pour que la mise à jour de la
  // grille tarifaire dans pricing-plans.ts se propage automatiquement.
  const tier = resolveTierToPlan(subscription?.tier)
  const planCode = (tier?.code ?? null) as PricingPlanCode | null
  const missionsCount = monthMissions ?? 0
  const missionsQuota = subscription?.missions_included ?? 0
  const overage = Math.max(0, missionsCount - missionsQuota)
  const overagePrice = subscription?.overage_price_cents ?? 0
  const overageTotal = (overage * overagePrice) / 100
  const usagePct = missionsQuota > 0 ? Math.min((missionsCount / missionsQuota) * 100, 100) : 0

  // Précalcul des modules inclus dans le plan courant.
  const modulesIncludedMap: Record<string, boolean> = {}
  for (const m of ADDON_MODULES) {
    modulesIncludedMap[m.code] = planCode
      ? m.includedInPlans.includes(planCode as (typeof m.includedInPlans)[number])
      : false
  }

  const storageProps = storageUsage
    ? {
        usedBytes: Number(storageUsage.usedBytes),
        quotaBytes: Number(storageUsage.quotaBytes),
      }
    : null

  const expired = sp.expired === '1'

  // ============================================
  // 4 KPI top — pattern stats-card client
  // ============================================
  const planLabel = tier?.name ?? 'Aucun forfait'
  const missionsKpi =
    missionsQuota > 0 ? `${missionsCount} / ${missionsQuota}` : String(missionsCount)
  const storageKpi = storageProps ? formatBytesShort(storageProps.usedBytes) : '—'
  const memberSinceKpi = user.created_at ? formatMonthYear(user.created_at) : '—'

  const topKpis: KpiTopItem[] = [
    { label: 'Plan actuel', value: planLabel, hint: tier?.code ?? undefined, mono: false },
    {
      label: 'Missions ce mois',
      value: missionsKpi,
      hint: missionsQuota > 0 ? 'quota mensuel' : 'forfait illimité',
      mono: true,
    },
    {
      label: 'Stockage utilisé',
      value: storageKpi,
      hint: storageProps ? `sur ${formatBytesShort(storageProps.quotaBytes)}` : 'indispo',
      mono: true,
    },
    {
      label: 'Membre depuis',
      value: memberSinceKpi,
      hint: user.created_at ? formatDateFr(user.created_at) : undefined,
      mono: false,
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto w-full">
      {winbackValid && (
        <ReactivationModal
          code={winbackValid.code}
          discountPercent={WINBACK_DISCOUNT_PERCENT}
          discountDurationMonths={WINBACK_DISCOUNT_DURATION_MONTHS}
          expiresAt={winbackValid.expiresAt}
        />
      )}

      {expired ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 sm:px-5 sm:py-4"
        >
          <p className="font-sans text-[15px] font-semibold text-amber-900">
            Essai gratuit terminé.
          </p>
          <p className="mt-1 text-[13px] text-amber-900/85">
            Choisissez un forfait ci-dessous. Vos données sont conservées, réactivation immédiate.
          </p>
        </div>
      ) : null}

      {/* ============================================
          Header — V5 sobre (plus de glass / backdrop-blur)
          ============================================ */}
      <section className="-mx-4 sm:mx-0 rounded-none sm:rounded-xl border-b sm:border border-[#0F1419]/[0.08] bg-paper px-4 sm:px-7 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#0F1419]/72">
              Compte
            </p>
            <h1 className="font-sans text-[28px] font-semibold leading-tight tracking-tight text-[#0F1419] truncate">
              {profile.full_name ?? 'Mon'}{' '}
              <span className="font-serif italic font-normal text-[#0F1419]/72">profil</span>
              <span className="text-[#0F1419]/72">.</span>
            </h1>
            <p className="text-sm text-[#0F1419]/72 truncate">{profile.email}</p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm" className="shrink-0">
              <LogOut className="size-4" />
              Se déconnecter
            </Button>
          </form>
        </div>
      </section>

      {/* ============================================
          4 KPI top — pattern stats-card
          ============================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {topKpis.map((k) => (
          <KpiTopCell key={k.label} item={k} />
        ))}
      </div>

      {/* ============================================
          Tabs + contenu (client) — délégué pour state local
          ============================================ */}
      <AccountSettingsClient
        initialTab={normalizeTab(sp.tab)}
        profile={{
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone ?? null,
        }}
        organization={{
          name: organization?.name ?? null,
          siret: organization?.siret ?? null,
          vat_number: organization?.vat_number ?? null,
          address: organization?.address ?? null,
          postal_code: organization?.postal_code ?? null,
          city: organization?.city ?? null,
          certification_n: organization?.certification_n ?? null,
        }}
        subscription={
          subscription
            ? {
                status: subscription.status,
                cancel_at_period_end: subscription.cancel_at_period_end,
                missions_included: subscription.missions_included,
                overage_price_cents: subscription.overage_price_cents,
                current_period_end: subscription.current_period_end,
              }
            : null
        }
        planCode={planCode}
        planName={tier?.name ?? null}
        missionsCount={missionsCount}
        missionsQuota={missionsQuota}
        overage={overage}
        overageTotal={overageTotal}
        usagePct={usagePct}
        certificatRge={certificatRge}
        ademeMonitoringEnabled={ademeMonitoringEnabled}
        lastAdemeSyncAt={lastAdemeSync.data?.created_at ?? null}
        monthlyReportEnabled={monthlyReportEnabled}
        calendarHttpsUrl={buildCalendarSubscriptionUrl(orgId)}
        calendarWebcalUrl={buildCalendarWebcalUrl(orgId)}
        storageUsage={storageProps}
        modulesIncludedMap={modulesIncludedMap}
      />
    </div>
  )
}

// ============================================================
// 4 KPI top — sous-composant (pattern stats-card client)
// ============================================================

interface KpiTopItem {
  label: string
  value: string
  hint?: string
  mono?: boolean
}

function KpiTopCell({ item }: { item: KpiTopItem }) {
  return (
    <div className="rounded-xl border border-[#0F1419]/[0.08] bg-paper px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#0F1419]/72 mb-1">
        {item.label}
      </div>
      <div
        className={cn(
          'text-base font-semibold text-[#0F1419] tabular-nums truncate',
          item.mono ? 'font-mono' : 'font-sans',
        )}
      >
        {item.value}
      </div>
      {item.hint ? (
        <div className="font-mono text-[10px] text-[#0F1419]/72 mt-1 tracking-[0.05em] truncate">
          {item.hint}
        </div>
      ) : null}
    </div>
  )
}

// ============================================================
// Helpers de formatage local (mois/année + bytes)
// ============================================================

function formatMonthYear(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }).replace('.', '')
}

function formatDateFr(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatBytesShort(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Mo'
  const units = ['o', 'Ko', 'Mo', 'Go', 'To']
  let value = bytes
  let unitIdx = 0
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024
    unitIdx++
  }
  const decimals = value < 10 ? 1 : 0
  return `${value.toFixed(decimals)} ${units[unitIdx]}`
}
