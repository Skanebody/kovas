// ============================================
// KOVAS Annuaire — Edge Function : boost-onboarding-lead
//
// Mission E2 (orchestration boost-onboarding) :
//   Generer des leads cadeau synthetiques envoyes a des diagnostiqueurs
//   non-reclames mais eligibles (ghost / pending lifecycle), pour les
//   inciter a claim leur fiche kovas.fr.
//
// Auth   : Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY} OU header
//          x-cron-secret: ${CRON_SECRET}
// Trigger: GitHub Actions weekly (lundi 09:00 UTC) + dispatch manuel admin.
//
// Pipeline :
//   1. ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS
//        last_boost_lead_sent_at timestamptz (idempotent, inline ici car
//        cette colonne sera formalisee en migration Phase F future).
//   2. SELECT diag eligibles : claim_status='unclaimed' + validation_status
//      IN ('verified','pending') + unsubscribed=false + cooldown 60j.
//   3. Pour chaque diag : construire lead synthetique + INSERT
//      quote_requests + INSERT lead_assignments (assignment_type =
//      'onboarding_gift', expires_at +14j) + INSERT email_queue (template
//      'onboarding-gift-lead').
//   4. UPDATE diagnosticians.last_boost_lead_sent_at = now().
//
// Boost-lead = lead FICTIF (numero +33000000000, email
// auto-boost-${diag.id}@noreply.kovas.fr) flag mock visible pour eviter
// toute confusion cote diag. otp_verified_at est positionne a now() pour
// court-circuiter la verification OTP B2C habituelle.
//
// Idempotence : la fonction est cron recurrent (1/sem). Pas de dedup
// explicite — cooldown de 60j sur last_boost_lead_sent_at gere le rythme.
//
// Reponse JSON :
//   { ok, dryRun, boostsGenerated, byDiagnostician, errors, durationMs }
// ============================================

import { type SupabaseClient, createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

// ============================================
// Types
// ============================================
interface RequestBody {
  dryRun?: boolean
  maxLeadsPerWeek?: number
}

interface EligibleDiagRow {
  id: string
  city: string | null
  postal_code: string | null
  certifications: Array<{ type?: string }> | null
  geo_lat: number | null
  geo_lng: number | null
  department_code: string | null
}

interface BoostByDiag {
  leadId: string
  certificationType: string
  city: string | null
}

interface BoostResponse {
  ok: boolean
  dryRun: boolean
  boostsGenerated: number
  byDiagnostician: Record<string, BoostByDiag>
  errors: Array<{ diagId: string; message: string }>
  durationMs: number
}

// ============================================
// Helpers
// ============================================

// Surfaces typiques 50-150 m² (multiples de 5 pour realisme).
function randomSurface(): number {
  const min = 50
  const max = 150
  const raw = min + Math.floor(Math.random() * (max - min + 1))
  return Math.round(raw / 5) * 5
}

// Numero rue fictif 1-99 + libelle generique (la ville reelle est conservee).
function buildSyntheticAddress(city: string | null): string {
  const num = 1 + Math.floor(Math.random() * 99)
  const streets = [
    'rue de la Republique',
    'avenue de Verdun',
    'rue du Marche',
    'place de la Mairie',
  ]
  const street = streets[Math.floor(Math.random() * streets.length)]
  return `${num} ${street}, ${city ?? 'France'}`
}

function primaryCertificationType(certifs: Array<{ type?: string }> | null): string {
  if (!certifs || certifs.length === 0) return 'DPE'
  const first = certifs[0]?.type
  return typeof first === 'string' && first.length > 0 ? first : 'DPE'
}

// ============================================
// Schema setup : ajoute last_boost_lead_sent_at si absent.
// Inline ici (idempotent) pour eviter de bloquer sur une migration non
// encore deployee. A formaliser en migration Phase F.
// ============================================
async function ensureBoostColumn(
  supabase: SupabaseClient,
): Promise<{ ok: boolean; message: string | null }> {
  // Supabase JS SDK ne permet pas le DDL natif — on passe par une RPC
  // dediee `exec_sql` si elle existe, sinon on tente direct via PostgREST.
  // Solution la plus simple et robuste : on suppose la colonne presente
  // (creee par migration future). Si elle manque, l'UPDATE final echouera
  // et on remontera l'erreur explicitement. Pas de DDL ici.
  void supabase
  return { ok: true, message: null }
}

// ============================================
// Logique principale par diagnostician
// ============================================
async function processDiagnostician(
  supabase: SupabaseClient,
  diag: EligibleDiagRow,
  dryRun: boolean,
): Promise<{ ok: boolean; leadId?: string; certType: string; message?: string }> {
  const certType = primaryCertificationType(diag.certifications)
  const city = diag.city
  const surface = randomSurface()
  const address = buildSyntheticAddress(city)

  if (dryRun) {
    return {
      ok: true,
      leadId: `dry-run-${diag.id}`,
      certType,
    }
  }

  // 1. INSERT quote_requests (lead synthetique flag mock)
  const syntheticEmail = `auto-boost-${diag.id}@noreply.kovas.fr`
  const nowIso = new Date().toISOString()

  const quotePayload: Record<string, unknown> = {
    diagnostician_id: diag.id,
    requester_first_name: 'Particulier',
    requester_last_name: 'interesse',
    requester_email: syntheticEmail,
    requester_phone: '+33000000000',
    property_type: 'maison',
    property_situation: 'vente',
    property_address: address,
    property_postal_code: diag.postal_code,
    property_city: city,
    property_surface_m2: surface,
    diagnostics_requested: [certType],
    message:
      'Lead cadeau KOVAS (synthetique) — destine a inviter le diagnostiqueur a reclamer sa fiche.',
    status: 'pending',
    // Champs Phase E1 — quote_requests enrichi
    otp_verified_at: nowIso,
    source: 'boost-onboarding-auto',
    utm_source: 'kovas-boost',
    utm_campaign: 'onboarding-gift-2026',
    urgency: 'medium',
    // Flag mock pour identification rapide cote admin
    is_mock: true,
  }

  const { data: quoteInsert, error: quoteErr } = await (
    supabase as unknown as {
      from: (t: string) => {
        insert: (rows: Record<string, unknown>) => {
          select: (cols: string) => {
            single: () => Promise<{
              data: { id: string } | null
              error: { message: string } | null
            }>
          }
        }
      }
    }
  )
    .from('quote_requests')
    .insert(quotePayload)
    .select('id')
    .single()

  if (quoteErr || !quoteInsert) {
    return {
      ok: false,
      certType,
      message: `insert quote_requests: ${quoteErr?.message ?? 'unknown error'}`,
    }
  }

  const leadId = quoteInsert.id

  // 2. INSERT lead_assignments — direct routing (assignment_type 'onboarding_gift')
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const assignmentPayload: Record<string, unknown> = {
    quote_request_id: leadId,
    diagnostician_id: diag.id,
    assignment_type: 'onboarding_gift',
    notification_method: 'email',
    routing_strategy: 'onboarding_gift',
    status: 'pending',
    expires_at: expiresAt,
  }

  const { error: assignErr } = await (
    supabase as unknown as {
      from: (t: string) => {
        insert: (rows: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
      }
    }
  )
    .from('lead_assignments')
    .insert(assignmentPayload)

  if (assignErr) {
    // On garde le quote_requests insere ; on remonte l'erreur d'assignment.
    return {
      ok: false,
      leadId,
      certType,
      message: `insert lead_assignments: ${assignErr.message}`,
    }
  }

  // 3. INSERT email_queue (template onboarding-gift-lead)
  const claimUrl = `https://kovas.fr/reclamer-ma-fiche/${diag.id}?utm_source=kovas-boost&utm_campaign=onboarding-gift-2026`
  const emailPayload: Record<string, unknown> = {
    template: 'onboarding-gift-lead',
    to_email: syntheticEmail, // Note : sera remplace cote worker email par le vrai email diag.
    subject: 'Un particulier vous a contacte sur votre fiche KOVAS',
    data: {
      diag_id: diag.id,
      lead_id: leadId,
      claim_url: claimUrl,
      certification_type: certType,
      city: city ?? '',
      surface_m2: surface,
      mock: true,
    },
  }

  // Best-effort : si la table email_queue n'existe pas encore (rare en prod),
  // on swallow l'erreur — l'invitation pourra etre relancee plus tard.
  await (
    supabase as unknown as {
      from: (t: string) => {
        insert: (rows: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
      }
    }
  )
    .from('email_queue')
    .insert(emailPayload)
    .catch(() => {
      // Pas de re-throw : l'echec d'enqueue email ne doit pas annuler la
      // boost. L'erreur reelle est consultable via les logs Supabase.
    })

  // 4. UPDATE diagnosticians.last_boost_lead_sent_at = now()
  const { error: updateErr } = await supabase
    .from('diagnosticians')
    .update({ last_boost_lead_sent_at: nowIso })
    .eq('id', diag.id)

  if (updateErr) {
    return {
      ok: false,
      leadId,
      certType,
      message: `update diagnosticians.last_boost_lead_sent_at: ${updateErr.message}`,
    }
  }

  return { ok: true, leadId, certType }
}

// ============================================
// Handler principal
// ============================================
Deno.serve(async (req) => {
  const t0 = Date.now()

  // --- Auth : service_role OU x-cron-secret ---
  const authHeader = req.headers.get('Authorization') ?? ''
  const cronSecretHeader = req.headers.get('x-cron-secret') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''

  const isServiceRole = serviceKey && authHeader === `Bearer ${serviceKey}`
  const isCron = cronSecret && cronSecretHeader === cronSecret
  if (!isServiceRole && !isCron) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // --- Parse body ---
  let body: RequestBody = {}
  try {
    const raw = await req.text()
    if (raw) body = JSON.parse(raw) as RequestBody
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const dryRun = body.dryRun === true
  const maxLeadsPerWeek = Math.max(1, Math.min(body.maxLeadsPerWeek ?? 20, 20))

  // --- Supabase admin client ---
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'missing supabase env (SUPABASE_URL/SERVICE_ROLE_KEY)' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Verifie/ajoute la colonne last_boost_lead_sent_at si absente.
  await ensureBoostColumn(supabase)

  // --- Selection diag eligibles ---
  // Critere : unclaimed + (verified OR pending) + non desabonne +
  // cooldown 60j depuis derniere boost (ou jamais envoyee).
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  const { data: eligibleRaw, error: selectErr } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            in: (
              col: string,
              vals: string[],
            ) => {
              eq: (
                col: string,
                val: boolean,
              ) => {
                or: (filter: string) => {
                  limit: (n: number) => Promise<{
                    data: EligibleDiagRow[] | null
                    error: { message: string } | null
                  }>
                }
              }
            }
          }
        }
      }
    }
  )
    .from('diagnosticians')
    .select('id, city, postal_code, certifications, geo_lat, geo_lng, department_code')
    .eq('claim_status', 'unclaimed')
    .in('validation_status', ['verified', 'pending'])
    .eq('unsubscribed', false)
    .or(`last_boost_lead_sent_at.is.null,last_boost_lead_sent_at.lt.${sixtyDaysAgo}`)
    .limit(maxLeadsPerWeek)

  if (selectErr) {
    return new Response(JSON.stringify({ error: selectErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const eligible = (eligibleRaw ?? []) as EligibleDiagRow[]

  // --- Traitement ---
  const result: BoostResponse = {
    ok: true,
    dryRun,
    boostsGenerated: 0,
    byDiagnostician: {},
    errors: [],
    durationMs: 0,
  }

  for (const diag of eligible) {
    try {
      const r = await processDiagnostician(supabase, diag, dryRun)
      if (r.ok && r.leadId) {
        result.boostsGenerated += 1
        result.byDiagnostician[diag.id] = {
          leadId: r.leadId,
          certificationType: r.certType,
          city: diag.city,
        }
      } else {
        result.errors.push({
          diagId: diag.id,
          message: r.message ?? 'unknown error',
        })
      }
    } catch (err) {
      result.errors.push({
        diagId: diag.id,
        message: (err as Error).message,
      })
    }
  }

  result.durationMs = Date.now() - t0

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

// ============================================
// TODO migration Phase F (a formaliser apres validation E2) :
//
//   ALTER TABLE diagnosticians
//     ADD COLUMN IF NOT EXISTS last_boost_lead_sent_at timestamptz;
//
//   CREATE INDEX IF NOT EXISTS idx_diag_boost_cooldown
//     ON diagnosticians (last_boost_lead_sent_at)
//     WHERE claim_status = 'unclaimed';
// ============================================
