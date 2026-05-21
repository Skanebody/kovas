/**
 * Page /app/account/cancellation
 *
 * Workflow de résiliation en 4 étapes — conforme décret n°2023-417 du 31/05/2023
 * (Code consommation art. D215-1).
 *
 * Path utilisateur 3 clics maximum depuis le dashboard :
 *   1. Avatar / "Compte" (sidebar)
 *   2. Section "Abonnement" / bouton "Résilier"
 *   3. Atterrissage sur step=1 → workflow.
 *
 * Navigation : `?step=1|2|3|4` via search params (URL → back/forward natif +
 * audit trail via logs serveur).
 */

import { CancellationStep1 } from '@/components/cancellation/CancellationStep1'
import { CancellationStep2 } from '@/components/cancellation/CancellationStep2'
import { CancellationStep3 } from '@/components/cancellation/CancellationStep3'
import { CancellationStep4 } from '@/components/cancellation/CancellationStep4'
import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { logAdminAction } from '@/lib/admin/audit-log'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getPlan, type KovasPlanId } from '@/lib/stripe-config'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Résiliation' }
export const dynamic = 'force-dynamic'

const DOWNGRADE_PATH: Record<KovasPlanId, KovasPlanId | null> = {
  essential: null,
  decouverte: 'essential',
  pro: 'decouverte',
  all_inclusive: 'pro',
  cabinet: 'all_inclusive',
}

interface ActiveModuleRow {
  id: string
  addon_modules: { name: string; description: string | null } | null
}

interface CancellationRow {
  id: string
  step1_seen_at: string | null
  step2_seen_at: string | null
  confirmed_at: string | null
  effective_end_date: string | null
}

interface SubscriptionRow {
  id: string
  plan_code: string | null
  tier: string | null
  status: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
}

interface SearchParams {
  step?: string
}

export default async function CancellationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { orgId, user, profile } = await getCurrentUser()
  const sp = await searchParams
  const step = parseStep(sp.step)

  // Service-role client pour assurer l'écriture des step*_seen_at + INSERT
  // initial. RLS bloquerait l'UPDATE côté client (policy intentionnellement
  // restrictive — cf. migration 20260526130000).
  const admin = createAdminClient()

  // 1) Charge subscription active
  const subQuery = (await admin
    .from('subscriptions')
    .select(
      'id, plan_code, tier, status, current_period_end, cancel_at_period_end',
    )
    .eq('organization_id', orgId)
    .maybeSingle()) as { data: SubscriptionRow | null }
  const subscription = subQuery.data

  if (!subscription || subscription.status !== 'active') {
    redirect('/app/account')
  }

  // 2) Charge ou crée la cancellation en cours (latest non-confirmed)
  let cancellation = await getOrCreateCancellation(orgId, user.id, subscription.id)

  // 3) Pose les timestamps step*_seen_at + audit, en fonction du step affiché.
  if (step === 1 && !cancellation.step1_seen_at) {
    await markStepSeen(cancellation.id, 'step1_seen_at')
    cancellation.step1_seen_at = new Date().toISOString()
    await logAudit(user.id, 'cancellation_step_seen', cancellation.id, { step: 1 })
  } else if (step === 2 && !cancellation.step2_seen_at) {
    await markStepSeen(cancellation.id, 'step2_seen_at')
    cancellation.step2_seen_at = new Date().toISOString()
    await logAudit(user.id, 'cancellation_step_seen', cancellation.id, { step: 2 })
  } else if (step === 4 && process.env.CALENDLY_CUSTOMER_SUCCESS_URL) {
    await markStepSeen(cancellation.id, 'calendly_link_shown_at')
    await logAudit(user.id, 'cancellation_calendly_shown', cancellation.id, {})
  }

  // 4) Bloc affichage en fonction du step.
  let body: React.ReactNode = null

  if (step === 1) {
    const modules = await loadActiveModules(orgId)
    body = (
      <CancellationStep1
        modules={modules}
        planLabel={planLabelOf(subscription)}
        effectiveEndDate={subscription.current_period_end}
      />
    )
  } else if (step === 2) {
    const downgrade = computeDowngrade(subscription.plan_code)
    body = (
      <CancellationStep2
        cancellationId={cancellation.id}
        currentPlanLabel={planLabelOf(subscription)}
        downgradeTarget={downgrade}
      />
    )
  } else if (step === 3) {
    body = <CancellationStep3 cancellationId={cancellation.id} />
  } else if (step === 4) {
    if (!cancellation.confirmed_at) {
      // step=4 ne devrait pas être atteint sans confirmation : redirige step3.
      redirect('/app/account/cancellation?step=3')
    }
    body = (
      <CancellationStep4
        effectiveEndDate={cancellation.effective_end_date}
        userEmail={profile.email ?? user.email ?? ''}
        calendlyUrl={process.env.CALENDLY_CUSTOMER_SUCCESS_URL ?? null}
      />
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/account">
          <ArrowLeft className="size-4" /> Retour à mon compte
        </Link>
      </Button>

      <AppPageHeader
        title="Résiliation"
        accent="abonnement"
        description={`Étape ${step}/4 — procédure conforme décret n°2023-417`}
      />

      <Stepper current={step} />

      {body}
    </div>
  )
}

function parseStep(raw: string | undefined): 1 | 2 | 3 | 4 {
  const parsed = raw ? Number.parseInt(raw, 10) : 1
  if (parsed === 2 || parsed === 3 || parsed === 4) return parsed
  return 1
}

function Stepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  const labels = ['Sûr ?', 'Alternatives', 'Motif', 'Confirmation']
  return (
    <ol className="flex items-center justify-between gap-2 text-[11px] font-mono uppercase tracking-wider text-ink-mute">
      {labels.map((label, idx) => {
        const n = idx + 1
        const active = n === current
        const done = n < current
        return (
          <li key={label} className="flex-1 flex items-center gap-2">
            <span
              className={
                active
                  ? 'size-6 rounded-full bg-navy text-paper flex items-center justify-center text-[10px] font-bold'
                  : done
                    ? 'size-6 rounded-full bg-accent-green/20 text-accent-green flex items-center justify-center text-[10px] font-bold'
                    : 'size-6 rounded-full bg-cream-deep text-ink-mute flex items-center justify-center text-[10px] font-bold'
              }
              aria-current={active ? 'step' : undefined}
            >
              {n}
            </span>
            <span className={active ? 'text-ink font-semibold' : ''}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

function planLabelOf(sub: SubscriptionRow): string {
  if (sub.plan_code) {
    const p = getPlan(sub.plan_code)
    if (p) return p.label
  }
  if (sub.tier) return sub.tier
  return 'votre formule'
}

function computeDowngrade(planCode: string | null): {
  planCode: string
  label: string
  priceMonthlyCents: number
} | null {
  if (!planCode) return null
  const target = DOWNGRADE_PATH[planCode as KovasPlanId]
  if (!target) return null
  const p = getPlan(target)
  if (!p) return null
  return {
    planCode: p.id,
    label: p.label,
    priceMonthlyCents: p.priceMonthlyCents,
  }
}

async function getOrCreateCancellation(
  orgId: string,
  userId: string,
  subscriptionId: string,
): Promise<CancellationRow> {
  const admin = createAdminClient()

  const existingRes = (await (
    admin.from('cancellations') as unknown as {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          is: (
            col: string,
            val: null,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => {
                maybeSingle: () => Promise<{ data: CancellationRow | null }>
              }
            }
          }
        }
      }
    }
  )
    .select(
      'id, step1_seen_at, step2_seen_at, confirmed_at, effective_end_date',
    )
    .eq('user_id', userId)
    .is('confirmed_at', null)
    .order('initiated_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: CancellationRow | null }

  if (existingRes.data) return existingRes.data

  // INSERT initial avec feedback bidon temporaire — DB exige length>=50. On
  // crée un row "draft" avec feedback de 50 chars qui sera ÉCRASÉ à step3.
  // C'est OK car aucun confirmed_at posé → row pas comptée comme résiliation.
  const draftFeedback =
    '[draft cancellation in progress — to be filled at step 3]___'.padEnd(50, '_')

  const inserted = (await (
    admin.from('cancellations') as unknown as {
      insert: (rows: Record<string, unknown>) => {
        select: (cols: string) => {
          single: () => Promise<{
            data: CancellationRow | null
            error: { message: string } | null
          }>
        }
      }
    }
  )
    .insert({
      organization_id: orgId,
      user_id: userId,
      subscription_id: subscriptionId,
      feedback_text: draftFeedback,
      feedback_category: 'other',
    })
    .select('id, step1_seen_at, step2_seen_at, confirmed_at, effective_end_date')
    .single()) as { data: CancellationRow | null; error: { message: string } | null }

  if (inserted.error || !inserted.data) {
    throw new Error(
      `Failed to create cancellation draft: ${inserted.error?.message ?? 'unknown'}`,
    )
  }

  await logAudit(userId, 'cancellation_initiated', inserted.data.id, {
    subscription_id: subscriptionId,
  })

  return inserted.data
}

async function markStepSeen(
  cancellationId: string,
  column:
    | 'step1_seen_at'
    | 'step2_seen_at'
    | 'calendly_link_shown_at',
): Promise<void> {
  const admin = createAdminClient()
  await (
    admin.from('cancellations') as unknown as {
      update: (patch: Record<string, string>) => {
        eq: (col: string, val: string) => Promise<{ error: unknown }>
      }
    }
  )
    .update({ [column]: new Date().toISOString() })
    .eq('id', cancellationId)
}

async function loadActiveModules(orgId: string) {
  const admin = createAdminClient()
  const res = (await (
    admin.from('user_addons') as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col2: string, val2: string) => Promise<{ data: ActiveModuleRow[] | null }>
        }
      }
    }
  )
    .select('id, addon_modules(name, description)')
    .eq('organization_id', orgId)
    .eq('status', 'active')) as { data: ActiveModuleRow[] | null }

  return (res.data ?? []).map((row) => ({
    id: row.id,
    label: row.addon_modules?.name ?? 'Module',
    description: row.addon_modules?.description ?? null,
  }))
}

async function logAudit(
  userId: string,
  actionType: string,
  cancellationId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await logAdminAction({
      adminUserId: userId,
      actionType,
      actionSource: 'dashboard_web',
      targetType: 'cancellation',
      targetId: cancellationId,
      payload,
      succeeded: true,
    })
  } catch (e) {
    console.error('[cancellation/audit] log failed', e)
  }
}
