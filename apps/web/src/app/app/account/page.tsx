import { ReactivationModal } from '@/components/cancellation/ReactivationModal'
import { Button } from '@/components/ui/button'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { getCurrentUser } from '@/lib/auth/current-user'
import { buildCalendarSubscriptionUrl, buildCalendarWebcalUrl } from '@/lib/calendar-token'
import { parisMonthBounds } from '@/lib/paris-dates'
import { PRICING_PLANS, type PricingPlanCode, ADDON_MODULES } from '@/lib/pricing-plans'
import { getStorageUsage } from '@/lib/storage/quota'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { AccountSettingsClient } from './account-settings-client'

export const metadata: Metadata = { title: 'Réglages' }

const WINBACK_DISCOUNT_PERCENT = Number.parseInt(
  process.env.WINBACK_DISCOUNT_PERCENT ?? '50',
  10,
)
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
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: WinbackCodeRow | null }>
        }
      }
    }
  )
    .select(
      'id, user_id, winback_code_used_at, winback_code_expires_at, confirmed_at',
    )
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
}

/**
 * Page "Réglages" /app/account — refonte 2026-05-20 style iOS Settings.
 *
 * Architecture :
 *   - Server component pour fetch parallèle (subscription + organization +
 *     profile + storage + ADEME snapshot + user_preferences).
 *   - Délègue toute l'UX d'édition au client `AccountSettingsClient` qui gère
 *     les sheets (drawers iOS-style) par-dessus les rows cliquables.
 *   - Layout single-column `max-w-2xl` (lecture optimale, pas trop large).
 *   - Search bar sticky en haut, filtre client-side les sections par texte.
 *   - Hero card user (avatar dark + chartreuse signature DS v5) → ouvre Profile sheet.
 *   - 8 sections groupées : Abonnement / Identité / Modules / Conformité ADEME /
 *     Préférences notifs+calendrier / Données stockage / Légal RGPD / Zone danger.
 *   - Workflow résiliation /app/account/cancellation PROTÉGÉ (décret 2023-417),
 *     bouton visible en zone danger.
 *
 * Sources de vérité respectées :
 *   - DS v5 (sage `#F5F7F4` / dark `#0F1419` / chartreuse `#D4F542`)
 *   - Icons catégoriels palette iOS Settings (#007AFF, #AF52DE, etc.)
 *   - Server actions inchangées (updateProfileAction, updateOrganizationAction,
 *     updateAdemeSettingsAction, updateMonthlyReportPreferenceAction,
 *     startModuleTrialAction).
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
          eq: (col: string, val: string) => {
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
              eq: (col: string, val: string) => {
                order: (col: string, opts: { ascending: boolean }) => {
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
    typeof linguisticProfile.certificat_rge === 'string'
      ? linguisticProfile.certificat_rge
      : null
  const ademeMonitoringEnabled = linguisticProfile.ademe_monitoring_enabled === true

  // Mapping legacy tier → plan_code canonique (5 forfaits post-pivot 2026-05-20)
  const currentTier = subscription?.tier
  const legacyToPlanCode: Record<string, PricingPlanCode | string> = {
    decouverte: 'decouverte',
    standard: 'pro',
    volume: 'all_inclusive',
    founder: 'pro',
    decouverte_legacy: 'decouverte',
    standard_legacy: 'pro',
    volume_legacy: 'all_inclusive',
    founder_legacy: 'pro',
  }
  const resolvedCode = currentTier ? legacyToPlanCode[currentTier] ?? currentTier : null
  const planCode = (resolvedCode &&
    PRICING_PLANS.find((p) => p.code === resolvedCode)?.code) as PricingPlanCode | null
  const tier = planCode ? PRICING_PLANS.find((p) => p.code === planCode) ?? null : null
  const missionsCount = monthMissions ?? 0
  const missionsQuota = subscription?.missions_included ?? 0
  const overage = Math.max(0, missionsCount - missionsQuota)
  const overagePrice = subscription?.overage_price_cents ?? 0
  const overageTotal = (overage * overagePrice) / 100
  const usagePct =
    missionsQuota > 0 ? Math.min((missionsCount / missionsQuota) * 100, 100) : 0

  // Précalcul des modules inclus dans le plan courant (évite calcul client).
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

  return (
    <div className="animate-fade-in">
      {winbackValid && (
        <ReactivationModal
          code={winbackValid.code}
          discountPercent={WINBACK_DISCOUNT_PERCENT}
          discountDurationMonths={WINBACK_DISCOUNT_DURATION_MONTHS}
          expiresAt={winbackValid.expiresAt}
        />
      )}

      {/* RETOUR DASHBOARD */}
      <Button variant="ghost" size="sm" asChild className="mb-3">
        <Link href="/app/dashboard">
          <ArrowLeft className="size-4" /> Tableau de bord
        </Link>
      </Button>

      {/* HEADER GREETING — titre iOS Settings simple */}
      <header className="pb-4 mb-4">
        <h1 className="font-sans font-semibold text-[28px] leading-tight tracking-tight text-[#0F1419]">
          Réglages
        </h1>
      </header>

      {/* CONTENU max-w-2xl pour lisibilité iOS-style */}
      <div className="max-w-2xl mx-auto">
        <AccountSettingsClient
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
    </div>
  )
}
