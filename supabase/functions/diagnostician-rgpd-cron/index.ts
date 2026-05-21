// ============================================
// KOVAS — Cron RGPD préalable diagnostiqueurs (Mission B1)
// Schedule : tous les jours 9h CET (cf. Supabase pg_cron : `0 8 * * *` en UTC)
// Auth : Authorization: Bearer ${CRON_SECRET}
// ============================================
//
// Comportement :
//  - Fetch diagnosticians where claim_status = 'unclaimed' (LIMIT 500)
//  - Pour chaque diag : calcule étape suivante via logique smart skip
//    (réplique de lib/emails/diagnostician-rgpd-sender.ts pour autonomie Edge)
//  - Si match : appelle l'endpoint Next.js /api/internal/rgpd-send (qui a accès
//    aux templates HTML et au helper sendEmail). L'edge function NE charge PAS
//    les templates elle-même (pas d'accès au fs Next.js).
//  - Logs JSON pour observabilité Sentry.
//
// Rate limiting : 500 diag max / run pour Resend (limite 10 req/s, 100/min sur free).
// Si pic d'inscription, le cron tourne 1x/jour donc 500 diag = 50s d'envoi étalé.
// ============================================

// @ts-expect-error : import deno standard, résolu à runtime par Supabase Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-expect-error : Deno global disponible au runtime Edge
const Deno = globalThis.Deno as { env: { get(key: string): string | undefined }; serve: (handler: (req: Request) => Response | Promise<Response>) => void }

const BATCH_LIMIT = 500
const MIN_DAYS_BETWEEN_SENDS = 7
const STEP_2_DELAY_DAYS = 7
const STEP_3_DELAY_DAYS = 14

interface DiagRow {
  id: string
  email: string | null
  claim_status: string
  unsubscribed: boolean | null
  withdrawal_requested: boolean | null
  pre_notification_email_1_sent_at: string | null
  pre_notification_email_2_sent_at: string | null
  pre_notification_email_3_sent_at: string | null
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24))
}

async function hasOpened(
  admin: ReturnType<typeof createClient>,
  diagnosticianId: string,
  step: 1 | 2,
): Promise<boolean> {
  const { count } = await admin
    .from('diagnostician_email_events')
    .select('*', { count: 'exact', head: true })
    .eq('diagnostician_id', diagnosticianId)
    .eq('email_step', step)
    .in('event_type', ['opened', 'clicked'])
  return (count ?? 0) > 0
}

async function decideStep(
  admin: ReturnType<typeof createClient>,
  diag: DiagRow,
): Promise<1 | 2 | 3 | null> {
  if (!diag.email) return null
  if (diag.unsubscribed) return null
  if (diag.withdrawal_requested) return null
  if (diag.claim_status !== 'unclaimed') return null

  const sent1 = diag.pre_notification_email_1_sent_at
  const sent2 = diag.pre_notification_email_2_sent_at
  const sent3 = diag.pre_notification_email_3_sent_at

  const lastSent =
    [sent1, sent2, sent3].filter((x): x is string => x !== null).sort().pop() ?? null
  const daysSinceLast = daysSince(lastSent)
  if (daysSinceLast !== null && daysSinceLast < MIN_DAYS_BETWEEN_SENDS) return null

  if (!sent1) return 1

  if (!sent2) {
    const d = daysSince(sent1)
    if (d !== null && d >= STEP_2_DELAY_DAYS) return 2
    return null
  }

  if (!sent3) {
    const d = daysSince(sent2)
    if (d !== null && d >= STEP_3_DELAY_DAYS) {
      const [opened1, opened2] = await Promise.all([
        hasOpened(admin, diag.id, 1),
        hasOpened(admin, diag.id, 2),
      ])
      if (!opened1 && !opened2) return null
      return 3
    }
    return null
  }

  return null
}

Deno.serve(async (req: Request) => {
  // Auth : Bearer CRON_SECRET
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
  const internalSecret = Deno.env.get('INTERNAL_RGPD_SECRET') ?? cronSecret

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Supabase env not configured (SUPABASE_URL/SERVICE_ROLE_KEY)' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Fetch candidats : unclaimed, non unsubscribed, non withdrawal
  const { data: candidates, error: fetchErr } = await admin
    .from('diagnosticians')
    .select(
      'id, email, claim_status, unsubscribed, withdrawal_requested, pre_notification_email_1_sent_at, pre_notification_email_2_sent_at, pre_notification_email_3_sent_at',
    )
    .eq('claim_status', 'unclaimed')
    .eq('unsubscribed', false)
    .eq('withdrawal_requested', false)
    .not('email', 'is', null)
    .limit(BATCH_LIMIT)

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rows = (candidates ?? []) as DiagRow[]

  let sentCount = 0
  let skippedCount = 0
  const errors: Array<{ diagId: string; error: string }> = []

  for (const diag of rows) {
    const step = await decideStep(admin, diag)
    if (step === null) {
      skippedCount++
      continue
    }

    // Délégation au handler Next.js qui a accès aux templates HTML
    try {
      const resp = await fetch(`${appUrl}/api/internal/rgpd-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({ diag_id: diag.id, step }),
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => `HTTP ${resp.status}`)
        errors.push({ diagId: diag.id, error: text.slice(0, 200) })
        continue
      }
      sentCount++
    } catch (err) {
      errors.push({
        diagId: diag.id,
        error: err instanceof Error ? err.message : 'Network error',
      })
    }

    // Throttle : ~10 req/s Resend free → 100ms entre envois
    await new Promise((r) => setTimeout(r, 120))
  }

  return new Response(
    JSON.stringify({
      run_at: new Date().toISOString(),
      candidates: rows.length,
      sent: sentCount,
      skipped: skippedCount,
      errors_count: errors.length,
      errors: errors.slice(0, 20),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
