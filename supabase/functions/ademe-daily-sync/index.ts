// KOVAS — Edge Function `ademe-daily-sync`
//
// Cron quotidien :
//
//     SCHEDULE: 0 2 * * *   (tous les jours à 02:00 UTC = 03:00 Paris hiver / 04:00 été)
//
// Wiring suggéré via pg_cron + Supabase secrets :
//
//     SELECT cron.schedule(
//       'ademe-daily-sync',
//       '0 2 * * *',
//       $$ SELECT net.http_post(
//            url := current_setting('app.settings.supabase_functions_url') || '/ademe-daily-sync',
//            headers := jsonb_build_object(
//              'Content-Type', 'application/json',
//              'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
//            )
//          ); $$
//     );
//
// Responsabilité :
//   1. Lister les utilisateurs avec un certificat RGE renseigné (lecture depuis
//      `profiles.linguistic_profile.certificat_rge` — convention V1, en attendant
//      une colonne dédiée Phase 2).
//   2. Pour chaque user, fetch l'API ADEME (`dpe-v2-logements-existants`) filtré
//      par `NUM_CERTIFICAT_RGE`. Rate limit 8 req/s en interne, pagination par
//      `after` token data-fair.
//   3. Upsert dans `ademe_dpe_cache` (UNIQUE org_id + numero_dpe).
//   4. Recalculer les KPI snapshot du jour et INSERT dans `ademe_kpi_snapshots`
//      (UNIQUE org_id + snapshot_date + period + user_id).
//   5. Générer des alertes (`ademe_alerts`) si certains seuils sont franchis.
//
// Garde-fou : erreurs par user → log + continue (jamais de fail global).
//
// ⚠️ Limites V1 :
//   - Matching par RGE uniquement. Si user.linguistic_profile.certificat_rge est
//     absent → on saute le user (avec log). TODO Phase 2 : fallback fuzzy par
//     nom (Levenshtein ≤ 3 sur NOM_DIAGNOSTIQUEUR), avec disclaimer UI "résultats
//     non garantis — homonymes possibles".
//   - Coût API : ADEME data-fair est gratuit, soft rate limit ~10 req/s
//     constaté empiriquement.
//   - Volume : un user typique = ~80-150 DPE/an = 1-2 pages × 10k = 1 req. À
//     1000 users, le batch tient en ~2 minutes (8 req/s × 125 = 1000 user-reqs).

/// <reference lib="deno.ns" />

import { type SupabaseClient, createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

// ────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────

const ADEME_API_BASE_URL =
  Deno.env.get('ADEME_API_BASE_URL') ?? 'https://data.ademe.fr/data-fair/api/v1'
const DATASET_DPE_V2 = 'dpe-v2-logements-existants'
const MAX_PAGE_SIZE = 10_000
const MAX_REQUESTS_PER_SECOND = 8
const MAX_RETRIES = 4
const RETRY_BASE_DELAY_MS = 500

// Seuils alertes (mirror snapshot-calculator côté Node).
const VOLUME_CRITICAL_YEARLY = 950
const VOLUME_WARNING_YEARLY = 800
const VOLUME_WARNING_DAILY = 6

// ────────────────────────────────────────────────────────────
// Types miroir DB (les types Database ne sont pas encore régénérés
// pour les tables ADEME — UNIQUE migrations 20260525100000-104000).
// ────────────────────────────────────────────────────────────

interface ProfileRow {
  id: string
  default_org_id: string | null
  full_name: string | null
  linguistic_profile: Record<string, unknown> | null
}

interface AdemeDpe {
  Numero_DPE?: string
  Ancien_Numero_DPE?: string
  Date_etablissement_DPE?: string
  Date_visite_diagnostiqueur?: string
  Date_fin_validite_DPE?: string
  NUM_CERTIFICAT_RGE?: string
  Nom_diagnostiqueur?: string
  Adresse_complete?: string
  Code_postal_brut?: string
  Code_postal_BAN?: string
  Nom_commune_BAN?: string
  Code_INSEE_BAN?: string
  Latitude?: number
  Longitude?: number
  Type_batiment?: string
  Annee_construction?: number
  Surface_habitable_logement?: number
  Type_energie_principale_chauffage?: string
  Type_installation_chauffage?: string
  Type_climatisation?: string
  Type_installation_ECS?: string
  Type_ventilation?: string
  Etiquette_DPE?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  Etiquette_GES?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  Conso_5_usages_par_m2_ep?: number
  Emission_GES_5_usages_par_m2?: number
  [key: string]: unknown
}

interface DataFairResponse {
  total: number
  results: AdemeDpe[]
  next?: string
}

interface SyncResult {
  user_id: string
  org_id: string
  certificat: string | null
  dpe_fetched: number
  dpe_upserted: number
  alerts_emitted: number
  error?: string
}

// ────────────────────────────────────────────────────────────
// Rate limiter (fenêtre glissante 1s)
// ────────────────────────────────────────────────────────────

class RateLimiter {
  private readonly timestamps: number[] = []
  constructor(private readonly maxPerSecond: number) {}

  async acquire(): Promise<void> {
    const now = Date.now()
    while (this.timestamps.length > 0 && now - (this.timestamps[0] ?? 0) > 1000) {
      this.timestamps.shift()
    }
    if (this.timestamps.length >= this.maxPerSecond) {
      const oldest = this.timestamps[0] ?? now
      const waitMs = Math.max(0, 1000 - (now - oldest)) + 5
      await sleep(waitMs)
      return this.acquire()
    }
    this.timestamps.push(Date.now())
  }
}

const limiter = new RateLimiter(MAX_REQUESTS_PER_SECOND)

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ────────────────────────────────────────────────────────────
// Fetch ADEME (1 page) avec retry exponentiel
// ────────────────────────────────────────────────────────────

async function fetchAdemePage(
  certificat: string,
  after: string | undefined,
): Promise<DataFairResponse> {
  const url = new URL(`${ADEME_API_BASE_URL}/datasets/${DATASET_DPE_V2}/lines`)
  url.searchParams.set('size', String(MAX_PAGE_SIZE))
  url.searchParams.set('select', '*')
  url.searchParams.set('qs', `NUM_CERTIFICAT_RGE:"${certificat.replace(/"/g, '\\"')}"`)
  if (after) url.searchParams.set('after', after)

  await limiter.acquire()

  let attempt = 0
  let lastError: unknown
  while (attempt <= MAX_RETRIES) {
    try {
      const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        attempt += 1
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1))
        continue
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`ADEME ${res.status} ${res.statusText} — ${body.slice(0, 200)}`)
      }
      return (await res.json()) as DataFairResponse
    } catch (err) {
      lastError = err
      attempt += 1
      if (attempt > MAX_RETRIES) break
      await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('ADEME fetch failed')
}

async function fetchAllDpeByCertificat(certificat: string): Promise<AdemeDpe[]> {
  const all: AdemeDpe[] = []
  let after: string | undefined
  let safety = 0
  do {
    const page = await fetchAdemePage(certificat, after)
    all.push(...page.results)
    after = page.next
    safety += 1
    if (safety > 50) throw new Error(`Pagination runaway > ${safety}`)
  } while (after)
  return all
}

// ────────────────────────────────────────────────────────────
// Upsert cache + recalcul snapshot + alertes
// ────────────────────────────────────────────────────────────

async function upsertDpeCache(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  dpeData: AdemeDpe[],
): Promise<number> {
  if (dpeData.length === 0) return 0

  const rows = dpeData
    .filter((d) => typeof d.Numero_DPE === 'string' && d.Numero_DPE.length > 0)
    .map((d) => ({
      organization_id: orgId,
      fetched_by: userId,
      numero_dpe: d.Numero_DPE,
      ancien_numero_dpe: d.Ancien_Numero_DPE ?? null,
      certificat_number: d.NUM_CERTIFICAT_RGE ?? null,
      address: d.Adresse_complete ?? null,
      city: d.Nom_commune_BAN ?? null,
      postal_code: d.Code_postal_BAN ?? d.Code_postal_brut ?? null,
      insee_code: d.Code_INSEE_BAN ?? null,
      latitude: typeof d.Latitude === 'number' ? d.Latitude : null,
      longitude: typeof d.Longitude === 'number' ? d.Longitude : null,
      type_batiment: d.Type_batiment ?? null,
      annee_construction: typeof d.Annee_construction === 'number' ? d.Annee_construction : null,
      surface_habitable_m2:
        typeof d.Surface_habitable_logement === 'number' ? d.Surface_habitable_logement : null,
      type_chauffage: d.Type_installation_chauffage ?? d.Type_energie_principale_chauffage ?? null,
      type_climatisation: d.Type_climatisation ?? null,
      type_ecs: d.Type_installation_ECS ?? null,
      type_ventilation: d.Type_ventilation ?? null,
      etiquette_dpe: d.Etiquette_DPE ?? null,
      etiquette_ges: d.Etiquette_GES ?? null,
      consommation_kwh_m2:
        typeof d.Conso_5_usages_par_m2_ep === 'number' ? d.Conso_5_usages_par_m2_ep : null,
      emissions_kgco2_m2:
        typeof d.Emission_GES_5_usages_par_m2 === 'number' ? d.Emission_GES_5_usages_par_m2 : null,
      date_etablissement: d.Date_etablissement_DPE ?? null,
      date_visite: d.Date_visite_diagnostiqueur ?? null,
      date_fin_validite: d.Date_fin_validite_DPE ?? null,
      raw_payload: d as unknown as Record<string, unknown>,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(), // 30j TTL
    }))

  if (rows.length === 0) return 0

  // Upsert par chunks de 500 pour éviter les payload > 1MB
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('ademe_dpe_cache')
      .upsert(slice, { onConflict: 'organization_id,numero_dpe' })
    if (error) throw new Error(`upsert ademe_dpe_cache: ${error.message}`)
  }
  return rows.length
}

function computeSnapshotCounts(dpe: AdemeDpe[], now: Date) {
  const today = now.toISOString().slice(0, 10)
  const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10)
  const dist = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 }
  const ges = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 }
  let count12m = 0
  let countToday = 0
  let totalDpe = 0
  let totalPublished = 0
  let surfaceSum = 0
  let surfaceCount = 0
  let energySum = 0
  let energyCount = 0
  let gesSum = 0
  let gesCount = 0

  for (const d of dpe) {
    totalDpe += 1
    if (d.Numero_DPE) totalPublished += 1
    if (d.Etiquette_DPE && d.Etiquette_DPE in dist) dist[d.Etiquette_DPE] += 1
    if (d.Etiquette_GES && d.Etiquette_GES in ges) ges[d.Etiquette_GES] += 1
    if (typeof d.Surface_habitable_logement === 'number') {
      surfaceSum += d.Surface_habitable_logement
      surfaceCount += 1
    }
    if (typeof d.Conso_5_usages_par_m2_ep === 'number') {
      energySum += d.Conso_5_usages_par_m2_ep
      energyCount += 1
    }
    if (typeof d.Emission_GES_5_usages_par_m2 === 'number') {
      gesSum += d.Emission_GES_5_usages_par_m2
      gesCount += 1
    }
    if (d.Date_etablissement_DPE) {
      if (d.Date_etablissement_DPE >= twelveMonthsAgo) count12m += 1
      if (d.Date_etablissement_DPE === today) countToday += 1
    }
  }
  const totalLabeled = dist.A + dist.B + dist.C + dist.D + dist.E + dist.F + dist.G
  const ratioFg = totalLabeled > 0 ? (dist.F + dist.G) / totalLabeled : 0
  return {
    dist,
    ges,
    totalDpe,
    totalPublished,
    count12m,
    countToday,
    ratioFg,
    avgSurface: surfaceCount > 0 ? surfaceSum / surfaceCount : null,
    avgEnergy: energyCount > 0 ? energySum / energyCount : null,
    avgGes: gesCount > 0 ? gesSum / gesCount : null,
    today,
  }
}

async function insertSnapshot(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  certificat: string,
  dpe: AdemeDpe[],
): Promise<{ count12m: number; countToday: number; ratioFg: number }> {
  const stats = computeSnapshotCounts(dpe, new Date())

  const row = {
    organization_id: orgId,
    user_id: userId,
    certificat_number: certificat,
    snapshot_date: stats.today,
    period: 'daily',
    count_a: stats.dist.A,
    count_b: stats.dist.B,
    count_c: stats.dist.C,
    count_d: stats.dist.D,
    count_e: stats.dist.E,
    count_f: stats.dist.F,
    count_g: stats.dist.G,
    ges_count_a: stats.ges.A,
    ges_count_b: stats.ges.B,
    ges_count_c: stats.ges.C,
    ges_count_d: stats.ges.D,
    ges_count_e: stats.ges.E,
    ges_count_f: stats.ges.F,
    ges_count_g: stats.ges.G,
    total_dpe: stats.totalDpe,
    total_published: stats.totalPublished,
    total_anomalies: 0,
    total_corrections: 0,
    error_rate: 0,
    avg_surface_m2: stats.avgSurface !== null ? Number(stats.avgSurface.toFixed(2)) : null,
    avg_energy_value: stats.avgEnergy !== null ? Number(stats.avgEnergy.toFixed(2)) : null,
    avg_ges_value: stats.avgGes !== null ? Number(stats.avgGes.toFixed(2)) : null,
    source: 'ademe_api',
    metadata: {
      dpe_count_12m: stats.count12m,
      dpe_count_today: stats.countToday,
      ratio_fg: Number(stats.ratioFg.toFixed(4)),
      computed_at: new Date().toISOString(),
    },
  }

  const { error } = await supabase
    .from('ademe_kpi_snapshots')
    .upsert(row, { onConflict: 'organization_id,snapshot_date,period,user_id' })
  if (error) throw new Error(`upsert ademe_kpi_snapshots: ${error.message}`)
  return { count12m: stats.count12m, countToday: stats.countToday, ratioFg: stats.ratioFg }
}

async function emitVolumeAlerts(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  stats: { count12m: number; countToday: number },
): Promise<number> {
  const alerts: Array<{
    organization_id: string
    user_id: string
    alert_code: string
    severity: 'info' | 'warning' | 'error' | 'critical'
    title: string
    message: string
    context: Record<string, unknown>
  }> = []

  if (stats.count12m >= VOLUME_CRITICAL_YEARLY) {
    alerts.push({
      organization_id: orgId,
      user_id: userId,
      alert_code: 'VOLUME_YEARLY_CRITICAL',
      severity: 'critical',
      title: 'Volume DPE critique (12 mois)',
      message: `${stats.count12m} DPE publiés sur 12 mois — seuil critique ${VOLUME_CRITICAL_YEARLY} dépassé. Risque de contrôle ADEME.`,
      context: { count_12m: stats.count12m, threshold: VOLUME_CRITICAL_YEARLY },
    })
  } else if (stats.count12m >= VOLUME_WARNING_YEARLY) {
    alerts.push({
      organization_id: orgId,
      user_id: userId,
      alert_code: 'VOLUME_YEARLY_WARNING',
      severity: 'warning',
      title: 'Volume DPE élevé (12 mois)',
      message: `${stats.count12m} DPE publiés sur 12 mois — approche du seuil de surveillance.`,
      context: { count_12m: stats.count12m, threshold: VOLUME_WARNING_YEARLY },
    })
  }
  if (stats.countToday >= VOLUME_WARNING_DAILY) {
    alerts.push({
      organization_id: orgId,
      user_id: userId,
      alert_code: 'VOLUME_DAILY_WARNING',
      severity: 'warning',
      title: 'Cadence quotidienne anormale',
      message: `${stats.countToday} DPE publiés aujourd'hui — cadence anormale.`,
      context: { count_today: stats.countToday, threshold: VOLUME_WARNING_DAILY },
    })
  }

  if (alerts.length === 0) return 0
  const { error } = await supabase.from('ademe_alerts').insert(alerts)
  if (error) throw new Error(`insert ademe_alerts: ${error.message}`)
  return alerts.length
}

// ────────────────────────────────────────────────────────────
// Lecture utilisateurs avec certificat RGE
//
// Convention V1 : on stocke le certificat dans
// `profiles.linguistic_profile.certificat_rge` (JSONB libre, déjà existant).
// Phase 2 : migration `ALTER TABLE profiles ADD COLUMN certificat_rge text`
// + UI dédiée onboarding.
// ────────────────────────────────────────────────────────────

function readCertificat(profile: ProfileRow): string | null {
  const lp = profile.linguistic_profile
  if (!lp || typeof lp !== 'object') return null
  const rec = lp as Record<string, unknown>
  const v = rec.certificat_rge
  if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  return null
}

async function listEligibleUsers(supabase: SupabaseClient): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, default_org_id, full_name, linguistic_profile')
    .not('default_org_id', 'is', null)
  if (error) throw new Error(`list profiles: ${error.message}`)
  return (data ?? []) as ProfileRow[]
}

// ────────────────────────────────────────────────────────────
// Orchestrateur
// ────────────────────────────────────────────────────────────

async function syncOneUser(supabase: SupabaseClient, profile: ProfileRow): Promise<SyncResult> {
  const orgId = profile.default_org_id ?? ''
  const result: SyncResult = {
    user_id: profile.id,
    org_id: orgId,
    certificat: null,
    dpe_fetched: 0,
    dpe_upserted: 0,
    alerts_emitted: 0,
  }
  if (!orgId) {
    result.error = 'no_default_org'
    return result
  }
  const cert = readCertificat(profile)
  result.certificat = cert
  if (!cert) {
    // TODO Phase 2 : fallback fuzzy par profile.full_name (Levenshtein ≤ 3
    // sur NOM_DIAGNOSTIQUEUR ADEME). Disclaimer "résultats non garantis".
    result.error = 'no_certificat_rge'
    return result
  }

  try {
    const dpe = await fetchAllDpeByCertificat(cert)
    result.dpe_fetched = dpe.length
    result.dpe_upserted = await upsertDpeCache(supabase, orgId, profile.id, dpe)
    const stats = await insertSnapshot(supabase, orgId, profile.id, cert, dpe)
    result.alerts_emitted = await emitVolumeAlerts(supabase, orgId, profile.id, stats)
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  }
  return result
}

// ────────────────────────────────────────────────────────────
// Auth helper
// ────────────────────────────────────────────────────────────

function isAuthorized(req: Request): boolean {
  const expected = Deno.env.get('CRON_SECRET') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!expected) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${expected}`
}

function createServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    throw new Error('ademe-daily-sync: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquante')
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// ────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const startedAt = Date.now()
  const supabase = createServiceClient()
  const results: SyncResult[] = []
  let usersProcessed = 0
  let usersSkipped = 0
  let totalDpeUpserted = 0
  let totalAlerts = 0

  try {
    const profiles = await listEligibleUsers(supabase)
    // Traitement **séquentiel** pour respecter le rate limit ADEME (8 req/s
    // global, partagé entre tous les users). En parallèle on dépasserait
    // facilement et 429 deviendrait fréquent.
    for (const profile of profiles) {
      const r = await syncOneUser(supabase, profile)
      results.push(r)
      if (r.error) {
        usersSkipped += 1
      } else {
        usersProcessed += 1
        totalDpeUpserted += r.dpe_upserted
        totalAlerts += r.alerts_emitted
      }
    }
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        elapsed_ms: Date.now() - startedAt,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({
      ok: true,
      elapsed_ms: Date.now() - startedAt,
      users_processed: usersProcessed,
      users_skipped: usersSkipped,
      total_dpe_upserted: totalDpeUpserted,
      total_alerts: totalAlerts,
      results: results.slice(0, 50), // cap réponse pour ne pas saturer le JSON
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
