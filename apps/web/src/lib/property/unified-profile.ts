/**
 * KOVAS — Algo A1.3.4 — Profil unifié propriété (cross-source data lake).
 *
 * **Pierre angulaire des algorithmes acqui-target** : fondation sur laquelle
 * reposent A1.3.1 (DPE shopping), A1.3.2 (cohérence cadastre) et le cockpit
 * fraude diagnostiqueur-facing.
 *
 * Cross-sources :
 *   1. BAN (adresse.data.gouv.fr) — référence adresse normalisée
 *   2. IGN Cadastre (apicarto.ign.fr) — parcelle + surface bâti officielle
 *   3. ADEME Observatoire DPE — historique DPE 12 mois
 *   4. DVF Etalab — historique transactions immobilières
 *   5. Géorisques (georisques.gouv.fr) — ERP naturels/techno/miniers + radon
 *   6. Internal — densité diagnostiqueurs zone (via RPC PostGIS)
 *
 * Performance budget :
 *   - Cache miss (build complet) : < 3 s
 *   - Cache hit (Vercel KV 7j) : < 50 ms
 *
 * Dégradation gracieuse :
 *   - Si BAN failed → erreur 502 (référence obligatoire)
 *   - Si autres sources failed → profil partiel + meta.partial_failures: [...]
 *
 * Authority : docs/refonte-2026-05/REFONTE-ACQUI-TARGET-V2.md chapitre 10.
 */

export interface PropertyUnifiedProfile {
  ban: {
    id: string
    lat: number
    lng: number
    postcode: string
    city: string
    city_insee_code: string
    department: string
  }
  parcelle: {
    id: string
    surface_terrain_m2: number | null
    surface_bati_m2: number | null
    year_built_estimated: number | null
    building_type: string | null
  } | null
  transactions: Array<{
    date: string
    price_eur: number
    surface_m2: number | null
    type: string
  }>
  dpe_history: Array<{
    date: string
    class_dpe: string
    class_ges: string
    surface_m2: number | null
    methode: string | null
    ademe_dpe_id: string
  }>
  erp_risks: {
    naturels: string[]
    technologiques: string[]
    miniers: string[]
    radon_level: number | null
    seismique: string | null
  }
  diagnostiqueurs_zone: Array<{
    anonymous_id: string
    count_operations_5km: number
    last_active: string | null
  }>
  meta: {
    last_synced_at: string
    source_versions: Record<string, string>
    freshness_score: number
    partial_failures?: string[]
  }
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Source fetchers — chacun isolé, retry exponentiel, dégradation gracieuse */
/* ──────────────────────────────────────────────────────────────────────── */

interface BanResult {
  id: string
  lat: number
  lng: number
  postcode: string
  city: string
  city_insee_code: string
  department: string
}

/** Géocode une adresse libre via BAN. Renvoie null si non trouvée. */
export async function fetchBan(address: string): Promise<BanResult | null> {
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!r.ok) return null
    const data = (await r.json()) as {
      features?: Array<{
        properties: {
          id: string
          postcode: string
          city: string
          citycode: string
          context: string
        }
        geometry: { coordinates: [number, number] }
      }>
    }
    const f = data.features?.[0]
    if (!f) return null
    const [lng, lat] = f.geometry.coordinates
    return {
      id: f.properties.id,
      lat,
      lng,
      postcode: f.properties.postcode,
      city: f.properties.city,
      city_insee_code: f.properties.citycode,
      department: f.properties.context.split(',')[0]?.trim() ?? '',
    }
  } catch {
    return null
  }
}

/** Récupère parcelle cadastrale via IGN à partir de lat/lng. */
export async function fetchParcelleFromIGN(
  lat: number,
  lng: number,
): Promise<{
  id: string
  surface_terrain_m2: number | null
  surface_bati_m2: number | null
  year_built_estimated: number | null
  building_type: string | null
} | null> {
  const geom = encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lng, lat] }))
  const url = `https://apicarto.ign.fr/api/cadastre/parcelle?geom=${geom}`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const data = (await r.json()) as {
      features?: Array<{
        properties: {
          idu?: string
          contenance?: number
          contenance_bati?: number
          type?: string
        }
      }>
    }
    const p = data.features?.[0]
    if (!p?.properties.idu) return null
    return {
      id: p.properties.idu,
      surface_terrain_m2: p.properties.contenance ?? null,
      surface_bati_m2: p.properties.contenance_bati ?? null,
      year_built_estimated: null,
      building_type: p.properties.type ?? null,
    }
  } catch {
    return null
  }
}

/** Récupère transactions DVF d'une parcelle. */
export async function fetchTransactionsFromDVF(
  communeInsee: string,
  parcelleId: string,
): Promise<PropertyUnifiedProfile['transactions']> {
  if (!communeInsee || !parcelleId) return []
  const url = `https://app.dvf.etalab.gouv.fr/api/mutations3/${communeInsee}/${parcelleId}`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const data = (await r.json()) as {
      mutations?: Array<{
        date_mutation: string
        valeur_fonciere: string | number
        surface_reelle_bati: string | number
        nature_mutation: string
      }>
    }
    return (data.mutations ?? []).map((m) => ({
      date: m.date_mutation,
      price_eur:
        typeof m.valeur_fonciere === 'string'
          ? Number.parseFloat(m.valeur_fonciere)
          : m.valeur_fonciere,
      surface_m2:
        typeof m.surface_reelle_bati === 'string'
          ? Number.parseFloat(m.surface_reelle_bati) || null
          : m.surface_reelle_bati || null,
      type: m.nature_mutation,
    }))
  } catch {
    return []
  }
}

/** Récupère historique DPE ADEME dans un rayon ~30m autour du point. */
export async function fetchDpeFromAdeme(
  lat: number,
  lng: number,
): Promise<PropertyUnifiedProfile['dpe_history']> {
  // Bounding box ~30m (lat ~ 0.00027°, lng ~ 0.0004° à 45°N)
  const latMin = lat - 0.00027
  const latMax = lat + 0.00027
  const lngMin = lng - 0.0004
  const lngMax = lng + 0.0004
  const where = `geo_point_2d_lat:[${latMin}+TO+${latMax}]+AND+geo_point_2d_lon:[${lngMin}+TO+${lngMax}]`
  const url = `https://observatoire-dpe-audit.ademe.fr/pub/dpe-france/lines?q_mode=simple&where=${encodeURIComponent(where)}&sort=date_etablissement_dpe&size=20`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return []
    const data = (await r.json()) as {
      results?: Array<{
        numero_dpe: string
        date_etablissement_dpe: string
        classe_consommation_energie: string
        classe_estimation_ges: string
        surface_habitable_logement?: string | number
        methode_application_dpe?: string
      }>
    }
    return (data.results ?? []).map((r) => ({
      date: r.date_etablissement_dpe,
      class_dpe: r.classe_consommation_energie,
      class_ges: r.classe_estimation_ges,
      surface_m2:
        typeof r.surface_habitable_logement === 'string'
          ? Number.parseFloat(r.surface_habitable_logement) || null
          : r.surface_habitable_logement || null,
      methode: r.methode_application_dpe ?? null,
      ademe_dpe_id: r.numero_dpe,
    }))
  } catch {
    return []
  }
}

/** Récupère ERP risques via API Géorisques. */
export async function fetchErpFromGeorisques(
  lat: number,
  lng: number,
): Promise<PropertyUnifiedProfile['erp_risks']> {
  const url = `https://www.georisques.gouv.fr/api/v1/risques/synthese?latlon=${lng},${lat}`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) {
      return { naturels: [], technologiques: [], miniers: [], radon_level: null, seismique: null }
    }
    const data = (await r.json()) as {
      risques?: {
        naturels?: Array<string | { libelle: string }>
        technologiques?: Array<string | { libelle: string }>
        miniers?: Array<string | { libelle: string }>
      }
      radon?: { niveau?: number }
      sismique?: { zone?: string }
    }
    const norm = (arr?: Array<string | { libelle: string }>): string[] =>
      (arr ?? []).map((x) => (typeof x === 'string' ? x : x.libelle))
    return {
      naturels: norm(data.risques?.naturels),
      technologiques: norm(data.risques?.technologiques),
      miniers: norm(data.risques?.miniers),
      radon_level: data.radon?.niveau ?? null,
      seismique: data.sismique?.zone ?? null,
    }
  } catch {
    return { naturels: [], technologiques: [], miniers: [], radon_level: null, seismique: null }
  }
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Compute freshness score                                                   */
/* ──────────────────────────────────────────────────────────────────────── */

/** Calcule le freshness score (0-100) en fonction des SLA par source. */
export function computeFreshnessScore(sourceVersions: Record<string, string>): number {
  const SLA_MS: Record<string, number> = {
    ban: 86400 * 1000,
    ign_cadastre: 86400 * 1000,
    ademe: 86400 * 1000,
    dvf: 100 * 86400 * 1000,
    georisques: 30 * 86400 * 1000,
    internal: 0,
  }
  const now = Date.now()
  let minRatio = 1.0
  for (const [key, sla] of Object.entries(SLA_MS)) {
    if (sla === 0) continue
    const versionStr = sourceVersions[key]
    if (!versionStr) continue
    const lastUpdate = new Date(versionStr).getTime()
    if (Number.isNaN(lastUpdate)) continue
    const age = now - lastUpdate
    const ratio = Math.max(0, 1 - age / sla)
    if (ratio < minRatio) minRatio = ratio
  }
  return Math.round(minRatio * 100)
}
