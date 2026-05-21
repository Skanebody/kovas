// ============================================
// KOVAS — Cron cycle vie diag fantôme (Mission K1)
// Schedule : tous les jours 6h CET (`0 5 * * *` en UTC)
// Auth : Authorization: Bearer ${CRON_SECRET}
// ============================================
//
// Workflow :
//  1. Appelle la RPC `recompute_diag_ghost_status` :
//     - Marque les recipients 'sent' > 7j sans interaction → 'ignored'
//     - Recompute `ghost_status` selon seuils 5/10/15 leads ignorés
//     - Marque 'archived' si pas d'interaction depuis 6 mois (claimed only)
//  2. Récupère les diag dont `ghost_status` vient de changer ET dont
//     `ghost_notification_sent_at` est null ou ancien → envoie email
//     warning / demoted / soft_disabled correspondant.
//  3. Idempotent : envoi 1 seul email par transition de statut (tracking
//     via `ghost_notification_sent_at`).
//
// Auth interne : on appelle l'endpoint Next.js /api/internal/ghost-notify
// pour les emails (templates HTML pas accessibles depuis Edge function).
// ============================================

// @ts-expect-error : import deno standard, résolu à runtime par Supabase Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-expect-error : Deno global disponible au runtime Edge
const Deno = globalThis.Deno as {
  env: { get(key: string): string | undefined }
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}

interface DiagRow {
  id: string
  display_name: string
  city: string | null
  official_email: string | null
  ghost_status: string
  ghost_status_updated_at: string | null
  ghost_notification_sent_at: string | null
  consecutive_ignored_leads: number | null
}

interface RecomputeResult {
  warned: number
  demoted: number
  soft_disabled: number
  archived: number
  computed_at: string
}

Deno.serve(async (req: Request) => {
  // Auth Bearer CRON_SECRET
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://kovas.fr'
  const internalSecret = Deno.env.get('INTERNAL_CRON_SECRET') ?? cronSecret

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        error: 'Supabase env not configured (SUPABASE_URL/SERVICE_ROLE_KEY)',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Recompute ghost_status (idempotent SQL RPC)
  const { data: recomputeData, error: recomputeErr } = await admin.rpc(
    'recompute_diag_ghost_status',
  )

  if (recomputeErr) {
    console.error('[ghost-lifecycle-cron] recompute failed', recomputeErr)
    return new Response(
      JSON.stringify({ error: 'recompute failed', details: recomputeErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const stats = (recomputeData ?? null) as RecomputeResult | null

  // 2. Fetch les diag à notifier (transition récente non encore notifiée)
  // Critère : ghost_status_updated_at > ghost_notification_sent_at OR
  //           ghost_notification_sent_at IS NULL, et ghost_status != 'active'
  const { data: candidatesRaw, error: fetchErr } = await admin
    .from('diagnosticians')
    .select(
      'id, display_name, city, official_email, ghost_status, ghost_status_updated_at, ghost_notification_sent_at, consecutive_ignored_leads',
    )
    .in('ghost_status', ['warned', 'demoted', 'soft_disabled'])
    .not('official_email', 'is', null)
    .limit(500)

  if (fetchErr) {
    console.error('[ghost-lifecycle-cron] fetch candidates failed', fetchErr)
    return new Response(
      JSON.stringify({ error: 'fetch failed', details: fetchErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const candidates = ((candidatesRaw ?? []) as DiagRow[]).filter((d) => {
    if (!d.ghost_status_updated_at) return false
    if (!d.ghost_notification_sent_at) return true
    return (
      new Date(d.ghost_status_updated_at).getTime() >
      new Date(d.ghost_notification_sent_at).getTime()
    )
  })

  let notified = 0
  let failed = 0

  // 3. Pour chaque candidat → call l'endpoint Next.js qui envoie l'email
  for (const diag of candidates) {
    try {
      const res = await fetch(`${appUrl}/api/internal/ghost-notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({
          diagnosticianId: diag.id,
          status: diag.ghost_status,
        }),
      })

      if (res.ok) {
        // Marque notification envoyée
        await admin
          .from('diagnosticians')
          .update({ ghost_notification_sent_at: new Date().toISOString() })
          .eq('id', diag.id)
        notified += 1
      } else {
        console.error('[ghost-lifecycle-cron] notify failed', diag.id, res.status)
        failed += 1
      }
    } catch (err) {
      console.error('[ghost-lifecycle-cron] notify exception', diag.id, err)
      failed += 1
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      recompute: stats,
      candidates: candidates.length,
      notified,
      failed,
      ran_at: new Date().toISOString(),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
