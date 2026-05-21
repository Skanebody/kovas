/**
 * KOVAS — Edge Function : enrichissement open data par mission.
 *
 * Endpoint POST /functions/v1/open-data-enrichment
 *
 * Body :
 *   { mission_id: string, address?: string, force?: boolean }
 *
 * Workflow :
 *   1. Auth user (JWT) + résolution organization_id via memberships
 *   2. Charge la mission via supabaseUser (RLS-guarded) → property.address
 *   3. Si enrichissement existant < 7 jours et !force → renvoie le cache
 *   4. Appels parallèles : BAN → (lng,lat,citycode) → Cadastre + BDNB + RNB + Géorisques + DVF
 *   5. UPSERT open_data_enrichments
 *   6. Log AI usage (operation='open_data_enrichment', cost_eur=0 — APIs gratuites)
 *
 * Cache : 7 jours par tuple (organization_id, mission_id). Pas de cache "global"
 *         par adresse (RGPD : on garde la donnée scopée à l'org propriétaire de
 *         la mission, et la mutualisation entre orgs serait du data-leak).
 *
 * TODO config externe :
 *   - BDNB_API_KEY : si l'API BDNB rate-limite trop fortement en prod, demander
 *     une clé sur https://bdnb.io et la passer en variable d'env.
 *   - Cadastre IGN apicarto : pas de clé requise (V1), surveiller la migration
 *     éventuelle vers Géoplateforme (déjà annoncée 2026).
 *
 * Authority : CLAUDE.md §3 #3 + open-data-enrichments table.
 */

// @ts-nocheck — Deno-only Edge Function ; non compilée par tsc Node.

import { createClient } from 'jsr:@supabase/supabase-js@2'

import { geocodeBanAddress } from '../../../apps/web/src/lib/opendata/ban.ts'
import { fetchBdnbBuildingByPoint } from '../../../apps/web/src/lib/opendata/bdnb.ts'
import { fetchCadastreParcelByPoint } from '../../../apps/web/src/lib/opendata/cadastre.ts'
import { fetchDvfNearby } from '../../../apps/web/src/lib/opendata/dvf.ts'
import { fetchGeorisquesByLocation } from '../../../apps/web/src/lib/opendata/georisques.ts'
import { fetchRnbIdByPoint } from '../../../apps/web/src/lib/opendata/rnb.ts'

const CACHE_TTL_DAYS = 7

interface RequestBody {
  mission_id: string
  address?: string
  force?: boolean
}

interface MissionRow {
  id: string
  organization_id: string
  property_id: string
}

interface PropertyRow {
  address: string
  city: string | null
  postal_code: string | null
  insee_code: string | null
}

interface EnrichmentRow {
  id: string
  updated_at: string
  ban_payload: unknown
  ign_payload: unknown
  bdnb_payload: unknown
  rnb_payload: unknown
  georisques_payload: unknown
  dvf_payload: unknown
  latitude: number | null
  longitude: number | null
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function isFresh(updatedAtIso: string): boolean {
  const updated = new Date(updatedAtIso).getTime()
  if (Number.isNaN(updated)) return false
  return Date.now() - updated < CACHE_TTL_DAYS * 24 * 3600 * 1000
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return jsonResponse({ error: 'missing_environment' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'unauthorized' }, 401)
  const jwt = authHeader.slice(7)

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await supabaseUser.auth.getUser(jwt)
  if (userErr || !userData.user) return jsonResponse({ error: 'unauthorized' }, 401)
  const userId = userData.user.id

  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: 'invalid_body' }, 400)
  }
  if (typeof body.mission_id !== 'string') {
    return jsonResponse({ error: 'mission_id_required' }, 400)
  }

  // 1. Mission + property (RLS-guarded via supabaseUser)
  const { data: mission, error: missionErr } = await supabaseUser
    .from('missions')
    .select('id, organization_id, property_id')
    .eq('id', body.mission_id)
    .maybeSingle<MissionRow>()
  if (missionErr || !mission) return jsonResponse({ error: 'mission_not_found' }, 404)

  const { data: property } = await supabaseUser
    .from('properties')
    .select('address, city, postal_code, insee_code')
    .eq('id', mission.property_id)
    .maybeSingle<PropertyRow>()

  const rawAddress = body.address ?? property?.address
  if (!rawAddress) return jsonResponse({ error: 'no_address' }, 400)

  // 2. Cache hit ?
  if (!body.force) {
    const { data: existing } = await supabaseAdmin
      .from('open_data_enrichments')
      .select(
        'id, updated_at, ban_payload, ign_payload, bdnb_payload, rnb_payload, georisques_payload, dvf_payload, latitude, longitude',
      )
      .eq('organization_id', mission.organization_id)
      .eq('mission_id', mission.id)
      .maybeSingle<EnrichmentRow>()
    if (existing && isFresh(existing.updated_at)) {
      return jsonResponse({
        cached: true,
        mission_id: mission.id,
        enrichment_id: existing.id,
        ban: existing.ban_payload,
        ign: existing.ign_payload,
        bdnb: existing.bdnb_payload,
        rnb: existing.rnb_payload,
        georisques: existing.georisques_payload,
        dvf: existing.dvf_payload,
        latitude: existing.latitude,
        longitude: existing.longitude,
      })
    }
  }

  const t0 = Date.now()
  const fetchErrors: Record<string, string> = {}

  // Base URLs (passées explicitement aux helpers — Deno n'a pas process.env)
  const banBase = Deno.env.get('BAN_API_BASE_URL') ?? undefined
  const cadastreBase = Deno.env.get('CADASTRE_API_BASE_URL') ?? undefined
  const bdnbBase = Deno.env.get('BDNB_API_BASE_URL') ?? undefined
  const bdnbKey = Deno.env.get('BDNB_API_KEY') ?? undefined
  const rnbBase = Deno.env.get('RNB_API_BASE_URL') ?? undefined
  const georisquesBase = Deno.env.get('GEORISQUES_API_BASE_URL') ?? undefined
  const dvfBase = Deno.env.get('DVF_API_BASE_URL') ?? undefined

  // 3. BAN d'abord (autres APIs en dépendent)
  const ban = await geocodeBanAddress(rawAddress, { baseUrl: banBase }).catch((e) => {
    fetchErrors['ban'] = e instanceof Error ? e.message : 'unknown'
    return null
  })
  if (!ban) {
    return jsonResponse({ error: 'address_not_geocoded', address: rawAddress }, 422)
  }

  // 4. Cadastre + BDNB + RNB + Géorisques + DVF en parallèle
  const codeInsee = ban.citycode ?? property?.insee_code ?? ''
  const [cadastre, bdnb, rnb, georisques, dvf] = await Promise.all([
    fetchCadastreParcelByPoint(ban.longitude, ban.latitude, { baseUrl: cadastreBase }).catch(
      (e) => {
        fetchErrors['cadastre'] = e instanceof Error ? e.message : 'unknown'
        return null
      },
    ),
    fetchBdnbBuildingByPoint(ban.longitude, ban.latitude, {
      baseUrl: bdnbBase,
      apiKey: bdnbKey,
    }).catch((e) => {
      fetchErrors['bdnb'] = e instanceof Error ? e.message : 'unknown'
      return null
    }),
    fetchRnbIdByPoint(ban.longitude, ban.latitude, { baseUrl: rnbBase }).catch((e) => {
      fetchErrors['rnb'] = e instanceof Error ? e.message : 'unknown'
      return null
    }),
    fetchGeorisquesByLocation(codeInsee, ban.latitude, ban.longitude, {
      baseUrl: georisquesBase,
    }).catch((e) => {
      fetchErrors['georisques'] = e instanceof Error ? e.message : 'unknown'
      return null
    }),
    fetchDvfNearby(ban.latitude, ban.longitude, 500, 5, { baseUrl: dvfBase }).catch((e) => {
      fetchErrors['dvf'] = e instanceof Error ? e.message : 'unknown'
      return null
    }),
  ])

  // 5. UPSERT
  const now = new Date().toISOString()
  const { data: upserted, error: upsertErr } = await supabaseAdmin
    .from('open_data_enrichments')
    .upsert(
      {
        organization_id: mission.organization_id,
        mission_id: mission.id,
        user_id: userId,
        latitude: ban.latitude,
        longitude: ban.longitude,
        ban_payload: ban,
        ign_payload: cadastre,
        bdnb_payload: bdnb,
        rnb_payload: rnb,
        georisques_payload: georisques,
        dvf_payload: dvf,
        ban_fetched_at: now,
        ign_fetched_at: cadastre ? now : null,
        bdnb_fetched_at: bdnb ? now : null,
        rnb_fetched_at: rnb ? now : null,
        georisques_fetched_at: georisques ? now : null,
        dvf_fetched_at: dvf ? now : null,
        fetch_errors: fetchErrors,
        updated_at: now,
      },
      { onConflict: 'organization_id,mission_id' },
    )
    .select('id')
    .single<{ id: string }>()
  if (upsertErr) return jsonResponse({ error: 'upsert_failed', details: upsertErr.message }, 500)

  // 6. Log usage (coût 0 — APIs publiques gratuites)
  await supabaseAdmin.from('ai_usage_log').insert({
    user_id: userId,
    operation: 'open_data_enrichment',
    ai_model: 'none',
    input_tokens: 0,
    output_tokens: 0,
    cost_eur: 0,
    duration_ms: Date.now() - t0,
    success: Object.keys(fetchErrors).length === 0,
    error_message: Object.keys(fetchErrors).length > 0 ? JSON.stringify(fetchErrors) : null,
  })

  return jsonResponse({
    cached: false,
    mission_id: mission.id,
    enrichment_id: upserted.id,
    ban,
    ign: cadastre,
    bdnb,
    rnb,
    georisques,
    dvf,
    latitude: ban.latitude,
    longitude: ban.longitude,
    fetch_errors: fetchErrors,
  })
})
