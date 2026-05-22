/**
 * Edge Function — recalibrate-alerts-for-user
 *
 * Tourne en cron hebdomadaire (lundi 06:00 Europe/Paris).
 * Pour chaque organisation :
 *   1. Scanne `alert_dismissals` des 30 derniers jours
 *   2. Group by (alert_type, alert_subtype)
 *   3. Si une combinaison dépasse AUTO_DISABLE_THRESHOLD ignorances :
 *        upsert dans `alert_auto_disabled`
 *   4. Pas de notification user (silencieux — visible dans rapport mensuel)
 *
 * Déploiement :
 *   supabase functions deploy recalibrate-alerts-for-user --no-verify-jwt
 *   supabase secrets set CRON_SECRET=...
 *
 * Trigger via Supabase Scheduled Jobs ou GitHub Action cron.
 */

// @ts-expect-error Deno runtime — pas de types côté Node
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
// @ts-expect-error Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AUTO_DISABLE_THRESHOLD = 5

interface DismissalRow {
  organization_id: string
  alert_type: string
  alert_subtype: string | null
}

interface RecalibrateResult {
  organizationsScanned: number
  newAutoDisabled: number
  details: Array<{
    organization_id: string
    alert_type: string
    alert_subtype: string | null
    count: number
  }>
}

serve(async (req: Request) => {
  // @ts-expect-error Deno env
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  // @ts-expect-error Deno env
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  // @ts-expect-error Deno env
  const CRON_SECRET = Deno.env.get('CRON_SECRET')

  // Auth basique pour scheduler externe.
  const auth = req.headers.get('authorization') ?? ''
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // Fenêtre : dismissals des 30 derniers jours.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('alert_dismissals')
    .select('organization_id, alert_type, alert_subtype')
    .gte('dismissed_at', thirtyDaysAgo)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const rows = (data ?? []) as DismissalRow[]

  // Group by (org, type, subtype)
  const counts = new Map<string, { row: DismissalRow; count: number }>()
  for (const r of rows) {
    const key = `${r.organization_id}::${r.alert_type}::${r.alert_subtype ?? ''}`
    const cur = counts.get(key)
    if (cur) cur.count += 1
    else counts.set(key, { row: r, count: 1 })
  }

  const result: RecalibrateResult = {
    organizationsScanned: new Set(rows.map((r) => r.organization_id)).size,
    newAutoDisabled: 0,
    details: [],
  }

  for (const { row, count } of counts.values()) {
    if (count < AUTO_DISABLE_THRESHOLD) continue
    const { error: upsertError } = await supabase.from('alert_auto_disabled').upsert(
      {
        organization_id: row.organization_id,
        alert_type: row.alert_type,
        alert_subtype: row.alert_subtype,
        reason: `auto: ${count} ignorances sur 30 jours`,
      },
      { onConflict: 'organization_id,alert_type,alert_subtype' },
    )
    if (!upsertError) {
      result.newAutoDisabled += 1
      result.details.push({
        organization_id: row.organization_id,
        alert_type: row.alert_type,
        alert_subtype: row.alert_subtype,
        count,
      })
    }
  }

  return new Response(JSON.stringify(result), {
    headers: { 'content-type': 'application/json' },
  })
})
