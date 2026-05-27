/**
 * POST /api/cancellation/confirm
 *
 * Confirme définitivement la résiliation après step 3 (feedback + catégorie).
 *
 * Effets :
 *   - Valide feedback >= 50 chars trimmed + catégorie ∈ liste autorisée
 *   - UPDATE Stripe : subscription.cancel_at_period_end = true
 *   - UPDATE cancellations : feedback_text, feedback_category, confirmed_at,
 *     effective_end_date, winback_code (unique COMEBACK50-XXXXXXXX),
 *     winback_code_expires_at (+6 mois)
 *   - Envoi email confirmation (best-effort)
 *   - Audit log
 *
 * Body : { cancellationId, feedback, category }
 */

import { randomBytes } from 'node:crypto'
import { logAdminAction } from '@/lib/admin/audit-log'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { getCurrentUser } from '@/lib/auth/current-user'
import { sendEmail } from '@/lib/email/send'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const FEEDBACK_MIN_LENGTH = 50
const WINBACK_CODE_VALIDITY_MONTHS = 6

const VALID_CATEGORIES = new Set([
  'too_expensive',
  'missing_features',
  'features_not_used',
  'better_competitor',
  'situation_change',
  'other',
])

interface RequestBody {
  cancellationId?: unknown
  feedback?: unknown
  category?: unknown
}

interface ConfirmResponse {
  ok: boolean
  effectiveEndDate?: string | null
  error?: string
}

export async function POST(request: Request): Promise<NextResponse<ConfirmResponse>> {
  const { user, orgId, profile } = await getCurrentUser()

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 })
  }

  if (typeof body.cancellationId !== 'string') {
    return NextResponse.json({ ok: false, error: 'cancellationId required' }, { status: 400 })
  }
  if (typeof body.feedback !== 'string') {
    return NextResponse.json({ ok: false, error: 'feedback required' }, { status: 400 })
  }
  const feedback = body.feedback.trim()
  if (feedback.length < FEEDBACK_MIN_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `feedback must be at least ${FEEDBACK_MIN_LENGTH} characters` },
      { status: 400 },
    )
  }
  if (typeof body.category !== 'string' || !VALID_CATEGORIES.has(body.category)) {
    return NextResponse.json({ ok: false, error: 'invalid category' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Vérifie ownership + non-confirmation
  const cancRes = (await (
    admin.from('cancellations') as unknown as {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: {
              id: string
              user_id: string
              subscription_id: string
              confirmed_at: string | null
            } | null
          }>
        }
      }
    }
  )
    .select('id, user_id, subscription_id, confirmed_at')
    .eq('id', body.cancellationId)
    .maybeSingle()) as {
    data: {
      id: string
      user_id: string
      subscription_id: string
      confirmed_at: string | null
    } | null
  }

  if (!cancRes.data) {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  }
  if (cancRes.data.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  if (cancRes.data.confirmed_at) {
    return NextResponse.json({ ok: false, error: 'already confirmed' }, { status: 409 })
  }

  const subRes = (await admin
    .from('subscriptions')
    .select('id, organization_id, stripe_subscription_id, current_period_end')
    .eq('id', cancRes.data.subscription_id)
    .maybeSingle()) as {
    data: {
      id: string
      organization_id: string
      stripe_subscription_id: string | null
      current_period_end: string | null
    } | null
  }

  if (!subRes.data || subRes.data.organization_id !== orgId) {
    return NextResponse.json({ ok: false, error: 'subscription mismatch' }, { status: 403 })
  }

  // 1) Stripe : cancel_at_period_end = true
  let effectiveEndIso: string | null = subRes.data.current_period_end
  try {
    if (isStripeConfigured() && subRes.data.stripe_subscription_id) {
      const updated = await getStripe().subscriptions.update(subRes.data.stripe_subscription_id, {
        cancel_at_period_end: true,
        cancellation_details: { feedback: 'other' },
      })
      // Depuis Stripe API 2026-04 (dahlia), current_period_end est porté par
      // l'item Subscription (plus par la subscription elle-même).
      const periodEnd = updated.items?.data[0]?.current_period_end
      if (typeof periodEnd === 'number') {
        effectiveEndIso = new Date(periodEnd * 1000).toISOString()
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'stripe error'
    await logAdminAction({
      adminUserId: user.id,
      actionType: 'cancellation_stripe_failed',
      actionSource: 'dashboard_web',
      targetType: 'cancellation',
      targetId: body.cancellationId,
      payload: { error: msg },
      succeeded: false,
      errorMessage: msg,
    })
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }

  // 2) Génère winback_code unique
  const winbackCode = generateWinbackCode()
  const winbackExpiresAt = new Date()
  winbackExpiresAt.setMonth(winbackExpiresAt.getMonth() + WINBACK_CODE_VALIDITY_MONTHS)

  // 3) UPDATE cancellations + subscriptions
  const updateRes = (await (
    admin.from('cancellations') as unknown as {
      update: (p: Record<string, unknown>) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{
          error: { message: string } | null
        }>
      }
    }
  )
    .update({
      feedback_text: feedback,
      feedback_category: body.category,
      confirmed_at: new Date().toISOString(),
      effective_end_date: effectiveEndIso ? effectiveEndIso.slice(0, 10) : null,
      winback_code: winbackCode,
      winback_code_expires_at: winbackExpiresAt.toISOString(),
    })
    .eq('id', body.cancellationId)) as { error: { message: string } | null }

  if (updateRes.error) {
    return NextResponse.json({ ok: false, error: updateRes.error.message }, { status: 500 })
  }

  // Miroir côté subscriptions (cancel_reason + cancel_feedback + cancel_at_period_end)
  await (
    admin.from('subscriptions') as unknown as {
      update: (p: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: unknown }>
      }
    }
  )
    .update({
      cancel_at_period_end: true,
      cancel_reason: body.category,
      cancel_feedback: feedback.slice(0, 500),
    })
    .eq('id', subRes.data.id)

  // 4) Audit
  await logAdminAction({
    adminUserId: user.id,
    actionType: 'cancellation_confirmed',
    actionSource: 'dashboard_web',
    targetType: 'cancellation',
    targetId: body.cancellationId,
    payload: {
      category: body.category,
      feedback_length: feedback.length,
      winback_code_issued: true,
      effective_end: effectiveEndIso,
    },
    succeeded: true,
  })

  // 5) Email confirmation (best-effort, n'échoue jamais la requête)
  const userEmail = profile.email ?? user.email
  if (userEmail) {
    void sendEmail({
      to: userEmail,
      subject: 'Confirmation de votre résiliation KOVAS',
      text: buildConfirmationText({
        firstName: profile.full_name ?? '',
        effectiveEndIso,
      }),
      category: 'transactional',
    }).catch((e) => {
      console.error('[cancellation/confirm] email send failed', e)
    })
  }

  return NextResponse.json({
    ok: true,
    effectiveEndDate: effectiveEndIso,
  })
}

/**
 * Format COMEBACK50-XXXXXXXX (hex 8 chars majuscules, ~4 milliards combinaisons).
 * Collision improbable mais protégée par contrainte UNIQUE en DB.
 */
function generateWinbackCode(): string {
  const suffix = randomBytes(4).toString('hex').toUpperCase()
  return `COMEBACK50-${suffix}`
}

function buildConfirmationText(opts: {
  firstName: string
  effectiveEndIso: string | null
}): string {
  const { firstName, effectiveEndIso } = opts
  const dateFr = effectiveEndIso
    ? new Date(effectiveEndIso).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'la fin de la période en cours'

  return `Bonjour ${firstName || ''},

Nous avons bien enregistré votre demande de résiliation de votre abonnement KOVAS.

Votre abonnement restera actif jusqu'au ${dateFr}. Aucune nouvelle facturation ne sera effectuée après cette date.

Après cette échéance, votre compte basculera 90 jours en mode lecture et export complet (PDF, Word, CSV, JSON, ZIP Liciel). Vous pourrez exporter tous vos dossiers à votre rythme depuis votre compte : https://kovas.fr/dashboard/account

Au-delà des 90 jours, vos données opérationnelles seront purgées. Vos factures restent conservées 10 ans (obligation légale comptable).

Si vous changez d'avis dans les 6 mois qui viennent, nous vous proposerons une offre spéciale pour reprendre où vous vous êtes arrêté.

Merci pour le temps passé avec nous.

Benjamin Bel
Fondateur KOVAS
`
}
