/**
 * KOVAS — Edge Function : Fair-use monthly check (cron mensuel).
 *
 * Endpoint POST /functions/v1/fair-use-monthly-check
 *
 * Cron : 1er du mois 08:00 Europe/Paris → 06:00 UTC en heure d'été.
 *   `0 6 1 * *`
 *
 *   SELECT cron.schedule(
 *     'fair-use-monthly-check',
 *     '0 6 1 * *',
 *     $$ SELECT net.http_post(
 *          url := current_setting('app.settings.supabase_functions_url') || '/fair-use-monthly-check',
 *          headers := jsonb_build_object(
 *            'Content-Type', 'application/json',
 *            'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
 *          )
 *        ); $$
 *   );
 *
 * Workflow :
 *   1. Pour chaque subscription active (status IN active/trialing) :
 *        a. Skip si is_grandfathered = true (anciens plans pas concernés)
 *        b. Skip si tier inconnu
 *        c. Compte missions du mois précédent (timezone Paris)
 *        d. Si > cap : upsert fair_use_alerts (consecutive_months_over + 1)
 *           Sinon : ne touche pas (le compteur reset implicitement quand on
 *           ne crée plus de lignes pendant N mois)
 *   2. Pour chaque alert où consecutive_months_over >= 3 ET email_sent_at IS NULL :
 *        - Envoie email Resend (template fair-use-upgrade)
 *        - Marque email_sent_at = now()
 *
 * Auth : `Authorization: Bearer <CRON_SECRET>`.
 */

// @ts-nocheck — Deno-only Edge Function

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface SubscriptionRow {
  organization_id: string
  tier: string | null
  is_grandfathered: boolean | null
  fair_use_cap_missions: number | null
  status: string | null
}

interface AlertRow {
  organization_id: string
  month_iso: string
  missions_count: number
  cap_threshold: number
  consecutive_months_over: number
  email_sent_at: string | null
}

interface OrgEmailRecipient {
  organization_id: string
  email: string
  name: string
}

const TIERS_ORDER = ['essential', 'decouverte', 'pro', 'all_inclusive', 'cabinet'] as const
const TIER_CAPS: Record<string, number> = {
  essential: 50,
  decouverte: 100,
  pro: 200,
  all_inclusive: 350,
  cabinet: 500,
}
const LEGACY_TIERS = new Set([
  'decouverte_legacy',
  'standard_legacy',
  'volume_legacy',
  'founder_legacy',
  'cabinet_legacy',
])

function suggestUpgrade(currentTier: string, volume: number): string {
  const idx = TIERS_ORDER.indexOf(currentTier as (typeof TIERS_ORDER)[number])
  for (let i = idx + 1; i < TIERS_ORDER.length; i += 1) {
    const t = TIERS_ORDER[i]
    if (TIER_CAPS[t] !== undefined && volume <= TIER_CAPS[t]) return t
  }
  return 'cabinet'
}

function monthIsoFor(date: Date): string {
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = parts.find((p) => p.type === 'year')?.value ?? `${date.getUTCFullYear()}`
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  return `${year}-${month}`
}

function monthBounds(monthIso: string): { startIso: string; endIso: string } {
  const [yearStr, monthStr] = monthIso.split('-')
  const year = Number(yearStr)
  const monthIdx = Number(monthStr) - 1
  const start = new Date(Date.UTC(year, monthIdx, 1))
  const end = new Date(Date.UTC(year, monthIdx + 1, 1))
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

Deno.serve(async (req: Request) => {
  // Auth
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'missing env' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Mois audité = mois précédent
  const lastMonthDate = new Date()
  lastMonthDate.setUTCMonth(lastMonthDate.getUTCMonth() - 1)
  lastMonthDate.setUTCDate(15)
  const monthIso = monthIsoFor(lastMonthDate)
  const { startIso, endIso } = monthBounds(monthIso)

  const stats = {
    organizationsScanned: 0,
    newOverages: 0,
    alertsSent: 0,
    errors: 0 as number,
    monthIso,
  }

  // 1) Récupère subscriptions actives non-grandfathered
  const { data: subs, error: subsErr } = await supabase
    .from('subscriptions')
    .select('organization_id, tier, is_grandfathered, fair_use_cap_missions, status')
    .in('status', ['active', 'trialing'])
    .neq('is_grandfathered', true)

  if (subsErr) {
    return new Response(JSON.stringify({ error: subsErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  for (const sub of (subs ?? []) as SubscriptionRow[]) {
    stats.organizationsScanned += 1
    if (!sub.tier || LEGACY_TIERS.has(sub.tier)) continue
    if (!TIER_CAPS[sub.tier]) continue
    const cap = sub.fair_use_cap_missions ?? TIER_CAPS[sub.tier]

    const { count } = await supabase
      .from('missions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', sub.organization_id)
      .is('deleted_at', null)
      .gte('created_at', startIso)
      .lt('created_at', endIso)

    const missionsCount = count ?? 0
    if (missionsCount <= cap) continue

    // Récupère dernière alerte pour compter consecutive_months_over
    const { data: prevAlert } = await supabase
      .from('fair_use_alerts')
      .select('consecutive_months_over')
      .eq('organization_id', sub.organization_id)
      .order('month_iso', { ascending: false })
      .limit(1)
      .maybeSingle()

    const consecutive = ((prevAlert?.consecutive_months_over as number | undefined) ?? 0) + 1

    const { error: insertErr } = await supabase.from('fair_use_alerts').upsert(
      {
        organization_id: sub.organization_id,
        month_iso: monthIso,
        missions_count: missionsCount,
        cap_threshold: cap,
        consecutive_months_over: consecutive,
      },
      { onConflict: 'organization_id,month_iso' },
    )
    if (insertErr) {
      stats.errors += 1
      continue
    }
    stats.newOverages += 1
  }

  // 2) Pour chaque alert >= 3 mois consécutifs ET email_sent_at IS NULL → envoi email
  const { data: pendingAlerts } = await supabase
    .from('fair_use_alerts')
    .select('organization_id, month_iso, missions_count, cap_threshold, consecutive_months_over, email_sent_at')
    .gte('consecutive_months_over', 3)
    .is('email_sent_at', null)

  for (const alert of (pendingAlerts ?? []) as AlertRow[]) {
    // Lookup tier courant + email contact
    const { data: subRow } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('organization_id', alert.organization_id)
      .maybeSingle()

    const currentTier = (subRow?.tier as string | undefined) ?? 'pro'
    const suggested = suggestUpgrade(currentTier, alert.missions_count)

    // Récupère email du proprio de l'org
    const { data: orgMembers } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', alert.organization_id)
      .eq('role', 'owner')
      .limit(1)

    const userId = orgMembers?.[0]?.user_id as string | undefined
    if (!userId) {
      stats.errors += 1
      continue
    }

    const { data: userProfile } = await supabase
      .from('users_profile')
      .select('email, first_name, last_name')
      .eq('user_id', userId)
      .maybeSingle()

    const email = (userProfile?.email as string | undefined) ?? null
    const firstName = (userProfile?.first_name as string | undefined) ?? 'cher diagnostiqueur'
    if (!email) {
      stats.errors += 1
      continue
    }

    // Envoi email Resend
    if (resendApiKey) {
      try {
        const subject = `KOVAS — Votre forfait ${currentTier} semble un peu juste`
        const html = `
          <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 580px; margin: 0 auto;">
            <p>Bonjour ${firstName},</p>
            <p>
              Vous avez réalisé <strong>${alert.missions_count} missions</strong> en ${monthIso},
              soit au-dessus du seuil indicatif (${alert.cap_threshold}) de votre tier
              <strong>${currentTier}</strong>. C'est le 3e mois consécutif.
            </p>
            <p>
              Rien ne change pour vous : aucun surplus n'est facturé, vos missions continuent
              de fonctionner normalement. C'est juste qu'à votre volume, le tier
              <strong>${suggested}</strong> est plus tranquille — et souvent moins cher au final.
            </p>
            <p>
              <a href="https://kovas.fr/app/account" style="display: inline-block; background: #0F1419; color: #fff; padding: 12px 24px; border-radius: 999px; text-decoration: none;">
                Voir la comparaison
              </a>
            </p>
            <p style="color: #666; font-size: 13px; margin-top: 32px;">
              Vous restez sur ${currentTier} si vous préférez, on ne vous force pas la main.
              Benjamin, KOVAS.
            </p>
          </div>
        `
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'KOVAS <hello@kovas.fr>',
            to: [email],
            subject,
            html,
          }),
        })
        if (!resp.ok) {
          stats.errors += 1
          continue
        }
      } catch (_err) {
        stats.errors += 1
        continue
      }
    }

    // Marque email_sent_at
    await supabase
      .from('fair_use_alerts')
      .update({ email_sent_at: new Date().toISOString() })
      .eq('organization_id', alert.organization_id)
      .eq('month_iso', alert.month_iso)

    stats.alertsSent += 1
  }

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
