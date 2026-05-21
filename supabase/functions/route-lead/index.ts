// ============================================
// KOVAS Annuaire — Edge Function : route-lead
//
// Mission : pour un lead B2C (quote_requests) validé OTP, calculer la
//   stratégie de routing géographique et notifier les diagnostiqueurs
//   éligibles. Multi-envoi first-come-first-served (jusqu'à 5 diag
//   simultanément). 3 étapes en cascade :
//     A. find_subscribed_diagnosticians_nearby   (KOVAS 360 actifs)
//     B. find_claimed_non_subscribed_nearby      (upsell cible)
//     C. find_eligible_for_onboarding_gift       (ghosts à activer)
//
// Si A < 3 diag : on tombe en B pour compléter (mix premium + basic).
// Si A+B < 3 : on ajoute C (onboarding_gift).
//
// Strategy retenue (champ routing_strategy) :
//   - 'subscribed_nearby'      si au moins 1 subscribed trouvé
//   - 'claimed_non_subscribed' si A=0 ET B>0
//   - 'onboarding_gift'        si A=0 ET B=0 ET C>0
//   - 'none'                   si tous vides
//
// Auth   : Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY} OU
//          x-cron-secret: ${CRON_SECRET}
//
// Body   : { leadId: 'uuid' }
//
// Réponse: { ok, strategy, assignedCount, assignments[], durationMs }
// ============================================

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

// ============================================
// Types
// ============================================

interface RequestBody {
  leadId?: string
}

interface LeadRow {
  id: string
  property_geo_lat: number | null
  property_geo_lng: number | null
  property_postal_code: string | null
  property_city: string | null
  diagnostics_requested: string[] | null
  otp_verified_at: string | null
  routed_at: string | null
  requester_email: string | null
}

interface NearbyDiagRow {
  id: string
  full_name: string
  distance_km: number
  activity_score: number | null
}

type AssignmentType = 'subscribed' | 'claimed_non_subscribed' | 'onboarding_gift'

type RoutingStrategy =
  | 'subscribed_nearby'
  | 'claimed_non_subscribed'
  | 'onboarding_gift'
  | 'manual'
  | 'none'

interface AssignmentResult {
  diagnosticianId: string
  score: number | null
  distanceKm: number
  expiresAt: string
  assignmentType: AssignmentType
}

interface RoutingResponse {
  ok: boolean
  strategy: RoutingStrategy
  assignedCount: number
  assignments: AssignmentResult[]
  durationMs: number
  error?: string
}

interface DiagContactRow {
  id: string
  official_email: string | null
  first_name: string | null
  last_name: string | null
}

// ============================================
// Constantes
// ============================================

const DEFAULT_RADIUS_KM = 30
const TOTAL_TARGET = 5 // max diag simultanés
const MIN_SUBSCRIBED_THRESHOLD = 3 // si >= 3 subscribed, pas de fallback
const ASSIGNMENT_TTL_HOURS = 48

// ============================================
// Helper : extraction coords du lead
// ============================================
// Si pas de coords directes, on tente un fallback "ville centre" via
// api-adresse.data.gouv.fr (gratuit, pas de clé). Pas de cache ici car
// les appels par lead sont rares (1 par création).

interface Coords {
  lat: number
  lng: number
}

async function geocodeFromCityPostal(
  city: string | null,
  postal: string | null,
): Promise<Coords | null> {
  if (!city && !postal) return null
  const q = [postal, city].filter((s) => s && s.trim().length > 0).join(' ')
  if (q.length === 0) return null

  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = (await res.json()) as {
      features?: Array<{ geometry?: { coordinates?: [number, number] } }>
    }
    const coords = data.features?.[0]?.geometry?.coordinates
    if (coords && coords.length === 2) {
      return { lng: coords[0], lat: coords[1] }
    }
    return null
  } catch {
    return null
  }
}

async function getLeadCoords(lead: LeadRow): Promise<Coords | null> {
  if (
    typeof lead.property_geo_lat === 'number' &&
    typeof lead.property_geo_lng === 'number'
  ) {
    return { lat: lead.property_geo_lat, lng: lead.property_geo_lng }
  }
  return geocodeFromCityPostal(lead.property_city, lead.property_postal_code)
}

// ============================================
// Helper : vérifie la présence d'une table (tolérance migrations partielles)
// ============================================

async function tableExists(
  supabase: SupabaseClient,
  table: string,
): Promise<boolean> {
  const { error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .limit(0)
  return !error
}

// ============================================
// Helper : insère assignments + notif emails
// ============================================

async function createAssignments(
  supabase: SupabaseClient,
  leadId: string,
  diags: NearbyDiagRow[],
  assignmentType: AssignmentType,
  certificationType: string,
  emailQueueAvailable: boolean,
): Promise<AssignmentResult[]> {
  if (diags.length === 0) return []

  const expiresAt = new Date(Date.now() + ASSIGNMENT_TTL_HOURS * 3600 * 1000).toISOString()

  const rows = diags.map((d) => ({
    lead_id: leadId,
    diagnostician_id: d.id,
    assignment_type: assignmentType,
    notification_method: 'email',
    status: 'pending',
    score: d.activity_score,
    distance_km: d.distance_km,
    expires_at: expiresAt,
  }))

  const { data: inserted, error } = await supabase
    .from('lead_assignments')
    .upsert(rows, { onConflict: 'lead_id,diagnostician_id', ignoreDuplicates: true })
    .select('id, diagnostician_id, score, distance_km, expires_at')

  if (error) {
    console.error(`createAssignments insert error: ${error.message}`)
    return []
  }

  const results: AssignmentResult[] = (inserted ?? []).map((row) => ({
    diagnosticianId: row.diagnostician_id as string,
    score: (row.score as number | null) ?? null,
    distanceKm: (row.distance_km as number | null) ?? 0,
    expiresAt: (row.expires_at as string) ?? expiresAt,
    assignmentType,
  }))

  // Notification email (best-effort, silencieux si table absente)
  if (emailQueueAvailable && results.length > 0) {
    const diagIds = results.map((r) => r.diagnosticianId)
    const { data: contacts } = await supabase
      .from('diagnosticians')
      .select('id, official_email, first_name, last_name')
      .in('id', diagIds)

    const contactMap = new Map<string, DiagContactRow>()
    for (const c of (contacts as DiagContactRow[] | null) ?? []) {
      contactMap.set(c.id, c)
    }

    const emailRows = results
      .map((r) => {
        const contact = contactMap.get(r.diagnosticianId)
        if (!contact?.official_email) return null
        return {
          template: `lead-notification-${assignmentType}`,
          to_email: contact.official_email,
          subject:
            assignmentType === 'subscribed'
              ? 'Nouvelle demande KOVAS Annuaire dans votre zone'
              : assignmentType === 'claimed_non_subscribed'
                ? 'Vous avez raté ce lead — abonnez-vous pour recevoir les suivants'
                : 'Cadeau KOVAS Annuaire : un lead offert pour démarrer',
          data: {
            lead_id: leadId,
            assignment_type: assignmentType,
            certification_type: certificationType,
            distance_km: r.distanceKm,
            expires_at: r.expiresAt,
          },
          status: 'pending',
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)

    if (emailRows.length > 0) {
      const { error: emailErr } = await supabase.from('email_queue').insert(emailRows)
      if (emailErr) {
        console.warn(`email_queue insert skipped: ${emailErr.message}`)
      }
    }
  }

  return results
}

// ============================================
// Helper : trigger upsell pour les claimed_non_subscribed
// ============================================

async function triggerUpsell(
  supabase: SupabaseClient,
  diagIds: string[],
  upsellAvailable: boolean,
): Promise<void> {
  if (!upsellAvailable || diagIds.length === 0) return

  // On récupère le claimed_by_user_id pour chaque diag (la suggestion
  // pointe sur l'utilisateur, pas la fiche)
  const { data: diags, error: diagErr } = await supabase
    .from('diagnosticians')
    .select('id, claimed_by_user_id')
    .in('id', diagIds)

  if (diagErr || !diags) {
    console.warn(`triggerUpsell diag lookup skipped: ${diagErr?.message ?? 'no data'}`)
    return
  }

  const rows = (diags as Array<{ id: string; claimed_by_user_id: string | null }>)
    .filter((d) => d.claimed_by_user_id !== null)
    .map((d) => ({
      user_id: d.claimed_by_user_id as string,
      suggestion_type: 'tier_upgrade',
      suggested_target: 'annuaire_pro',
      reason_label: 'Lead manqué dans votre zone',
      reason_benefit:
        'Vous avez raté ce lead — abonnez-vous pour recevoir les suivants automatiquement.',
      estimated_value_eur: 150,
      priority: 70,
      status: 'pending',
    }))

  if (rows.length === 0) return

  const { error: upsellErr } = await supabase.from('upsell_suggestions').insert(rows)
  if (upsellErr) {
    console.warn(`upsell_suggestions insert skipped: ${upsellErr.message}`)
  }
}

// ============================================
// Handler principal
// ============================================

Deno.serve(async (req: Request): Promise<Response> => {
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

  if (!body.leadId) {
    return new Response(JSON.stringify({ error: 'leadId requis' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // --- Supabase admin client ---
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'missing supabase env (SUPABASE_URL/SERVICE_ROLE_KEY)' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
  const supabase: SupabaseClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // --- Fetch lead ---
  const { data: leadData, error: leadErr } = await supabase
    .from('quote_requests')
    .select(
      'id, property_geo_lat, property_geo_lng, property_postal_code, property_city, diagnostics_requested, otp_verified_at, routed_at, requester_email',
    )
    .eq('id', body.leadId)
    .maybeSingle()

  if (leadErr) {
    return new Response(JSON.stringify({ error: leadErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!leadData) {
    return new Response(JSON.stringify({ error: 'lead not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const lead = leadData as LeadRow

  if (!lead.otp_verified_at) {
    return new Response(JSON.stringify({ error: 'OTP not verified' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (lead.routed_at) {
    return new Response(JSON.stringify({ error: 'Already routed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // --- Détermine certification_type principal (1er du tableau) ---
  const certificationType =
    Array.isArray(lead.diagnostics_requested) && lead.diagnostics_requested.length > 0
      ? lead.diagnostics_requested[0]
      : 'DPE'

  // --- Coords (direct ou fallback BAN) ---
  const coords = await getLeadCoords(lead)
  if (!coords) {
    return new Response(
      JSON.stringify({
        error: 'unable to resolve lead coords (no geo + BAN fallback failed)',
      }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // --- Détection tables optionnelles (tolérance migrations partielles) ---
  const [upsellAvailable, emailQueueAvailable] = await Promise.all([
    tableExists(supabase, 'upsell_suggestions'),
    tableExists(supabase, 'email_queue'),
  ])

  const allAssignments: AssignmentResult[] = []
  let candidatesCount = 0

  // --- Étape A : subscribed_nearby ---
  const { data: subscribedData, error: subscribedErr } = await supabase.rpc(
    'find_subscribed_diagnosticians_nearby',
    {
      p_lat: coords.lat,
      p_lng: coords.lng,
      p_radius_km: DEFAULT_RADIUS_KM,
      p_certification_type: certificationType,
      p_limit: TOTAL_TARGET,
    },
  )

  if (subscribedErr) {
    return new Response(
      JSON.stringify({
        error: `find_subscribed_diagnosticians_nearby: ${subscribedErr.message}`,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const subscribedDiags = (subscribedData as NearbyDiagRow[] | null) ?? []
  candidatesCount += subscribedDiags.length

  const subscribedAssignments = await createAssignments(
    supabase,
    lead.id,
    subscribedDiags,
    'subscribed',
    certificationType,
    emailQueueAvailable,
  )
  allAssignments.push(...subscribedAssignments)

  // --- Étape B : claimed_non_subscribed (fallback / complément) ---
  let claimedDiags: NearbyDiagRow[] = []
  if (subscribedDiags.length < MIN_SUBSCRIBED_THRESHOLD) {
    const remaining = TOTAL_TARGET - subscribedDiags.length
    const { data: claimedData, error: claimedErr } = await supabase.rpc(
      'find_claimed_non_subscribed_nearby',
      {
        p_lat: coords.lat,
        p_lng: coords.lng,
        p_radius_km: DEFAULT_RADIUS_KM,
        p_certification_type: certificationType,
        p_limit: remaining,
      },
    )

    if (claimedErr) {
      console.warn(`find_claimed_non_subscribed_nearby failed: ${claimedErr.message}`)
    } else {
      claimedDiags = (claimedData as NearbyDiagRow[] | null) ?? []
      candidatesCount += claimedDiags.length

      const claimedAssignments = await createAssignments(
        supabase,
        lead.id,
        claimedDiags,
        'claimed_non_subscribed',
        certificationType,
        emailQueueAvailable,
      )
      allAssignments.push(...claimedAssignments)

      // Trigger upsell ciblé sur ces diag (best-effort)
      await triggerUpsell(
        supabase,
        claimedAssignments.map((a) => a.diagnosticianId),
        upsellAvailable,
      )
    }
  }

  // --- Étape C : onboarding_gift (si A+B < 3) ---
  const aPlusB = subscribedDiags.length + claimedDiags.length
  if (aPlusB < MIN_SUBSCRIBED_THRESHOLD) {
    const remaining = TOTAL_TARGET - aPlusB
    const { data: giftData, error: giftErr } = await supabase.rpc(
      'find_eligible_for_onboarding_gift',
      {
        p_lat: coords.lat,
        p_lng: coords.lng,
        p_radius_km: DEFAULT_RADIUS_KM,
        p_certification_type: certificationType,
        p_limit: remaining,
      },
    )

    if (giftErr) {
      console.warn(`find_eligible_for_onboarding_gift failed: ${giftErr.message}`)
    } else {
      const giftDiags = (giftData as NearbyDiagRow[] | null) ?? []
      candidatesCount += giftDiags.length

      const giftAssignments = await createAssignments(
        supabase,
        lead.id,
        giftDiags,
        'onboarding_gift',
        certificationType,
        emailQueueAvailable,
      )
      allAssignments.push(...giftAssignments)
    }
  }

  // --- Détermine strategy retenue ---
  let strategy: RoutingStrategy
  if (subscribedDiags.length > 0) {
    strategy = 'subscribed_nearby'
  } else if (claimedDiags.length > 0) {
    strategy = 'claimed_non_subscribed'
  } else if (allAssignments.some((a) => a.assignmentType === 'onboarding_gift')) {
    strategy = 'onboarding_gift'
  } else {
    strategy = 'none'
  }

  // --- UPDATE lead ---
  const topScore = allAssignments.reduce<number | null>((max, a) => {
    if (a.score === null) return max
    if (max === null) return a.score
    return a.score > max ? a.score : max
  }, null)

  const { error: updateErr } = await supabase
    .from('quote_requests')
    .update({
      routed_at: new Date().toISOString(),
      routing_strategy: strategy,
      routing_metadata: {
        candidates_count: candidatesCount,
        top_score: topScore,
        geo_radius_km: DEFAULT_RADIUS_KM,
        certification_type: certificationType,
        assignments_subscribed: subscribedDiags.length,
        assignments_claimed_non_subscribed: claimedDiags.length,
        assignments_onboarding_gift: allAssignments.filter(
          (a) => a.assignmentType === 'onboarding_gift',
        ).length,
      },
    })
    .eq('id', lead.id)

  if (updateErr) {
    return new Response(
      JSON.stringify({ error: `update quote_requests: ${updateErr.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const response: RoutingResponse = {
    ok: true,
    strategy,
    assignedCount: allAssignments.length,
    assignments: allAssignments,
    durationMs: Date.now() - t0,
  }

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
