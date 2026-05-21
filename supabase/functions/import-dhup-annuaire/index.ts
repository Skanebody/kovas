// ============================================
// KOVAS — Edge Function : import-dhup-annuaire
// Mission A1 : import mensuel du dataset DHUP data.gouv.fr
//   "annuaire des diagnostiqueurs immobiliers certifies"
//   (Ministere du Logement, licence Etalab 2.0)
//
// Trigger : cron mensuel (1er du mois 03:00 CET) — cf. SQL pg_cron en bas du fichier.
// Auth    : Authorization: Bearer ${CRON_SECRET}
//
// Pipeline :
//   1) Download CSV/JSON depuis data.gouv.fr (resource_id env var)
//   2) Parse colonnes : nom, prenom, certifications, organisme, validite, ville, CP, dept
//   3) Geocode chaque ville via API BAN (api-adresse.data.gouv.fr) — best effort, cache local
//   4) Upsert dans diagnosticians via dhup_source_id (idempotent)
//   5) Genere slug via generate_unique_diag_slug(...) si nouveau
//
// Notes :
//   - L'URL exacte du dataset DHUP est instable (data.gouv.fr ne garantit pas
//     l'ID de resource). On utilise DHUP_RESOURCE_URL env var, configurable
//     sans redeploy. Fallback : seed mock (supabase/seed/diagnosticians-mock.sql).
//   - Aucune cle API requise (BAN + data.gouv.fr publics, Etalab 2.0).
// ============================================

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

interface DhupRow {
  /** ID stable cote DHUP (URL data.gouv.fr / clef metier). */
  dhup_source_id: string
  first_name: string
  last_name: string
  city: string
  postal_code: string | null
  department_code: string
  official_email: string | null
  official_phone: string | null
  official_company_name: string | null
  certifications: Array<{
    type: string
    organism: string | null
    number: string | null
    valid_until: string | null
    status: 'valid' | 'expired' | 'suspended'
  }>
}

interface BanFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: {
    label: string
    score: number
    postcode?: string
    citycode?: string
    city?: string
    context?: string
  }
}

interface BanResponse {
  features: BanFeature[]
}

interface ImportStats {
  rows_total: number
  rows_inserted: number
  rows_updated: number
  rows_skipped: number
  geocode_hits: number
  geocode_misses: number
  errors: string[]
  duration_ms: number
}

// ============================================
// Mapping department code <-> slug
// (76 -> seine-maritime). Subset : on slugifie le nom fourni par BAN context si dispo,
// sinon fallback table statique courte. La table complete est mise a jour V1.5.
// ============================================
const DEPT_SLUGS: Record<string, string> = {
  '01': 'ain', '02': 'aisne', '03': 'allier', '04': 'alpes-de-haute-provence',
  '05': 'hautes-alpes', '06': 'alpes-maritimes', '07': 'ardeche', '08': 'ardennes',
  '09': 'ariege', '10': 'aube', '11': 'aude', '12': 'aveyron',
  '13': 'bouches-du-rhone', '14': 'calvados', '15': 'cantal', '16': 'charente',
  '17': 'charente-maritime', '18': 'cher', '19': 'correze', '2A': 'corse-du-sud',
  '2B': 'haute-corse', '21': 'cote-dor', '22': 'cotes-darmor', '23': 'creuse',
  '24': 'dordogne', '25': 'doubs', '26': 'drome', '27': 'eure',
  '28': 'eure-et-loir', '29': 'finistere', '30': 'gard', '31': 'haute-garonne',
  '32': 'gers', '33': 'gironde', '34': 'herault', '35': 'ille-et-vilaine',
  '36': 'indre', '37': 'indre-et-loire', '38': 'isere', '39': 'jura',
  '40': 'landes', '41': 'loir-et-cher', '42': 'loire', '43': 'haute-loire',
  '44': 'loire-atlantique', '45': 'loiret', '46': 'lot', '47': 'lot-et-garonne',
  '48': 'lozere', '49': 'maine-et-loire', '50': 'manche', '51': 'marne',
  '52': 'haute-marne', '53': 'mayenne', '54': 'meurthe-et-moselle', '55': 'meuse',
  '56': 'morbihan', '57': 'moselle', '58': 'nievre', '59': 'nord',
  '60': 'oise', '61': 'orne', '62': 'pas-de-calais', '63': 'puy-de-dome',
  '64': 'pyrenees-atlantiques', '65': 'hautes-pyrenees', '66': 'pyrenees-orientales',
  '67': 'bas-rhin', '68': 'haut-rhin', '69': 'rhone', '70': 'haute-saone',
  '71': 'saone-et-loire', '72': 'sarthe', '73': 'savoie', '74': 'haute-savoie',
  '75': 'paris', '76': 'seine-maritime', '77': 'seine-et-marne', '78': 'yvelines',
  '79': 'deux-sevres', '80': 'somme', '81': 'tarn', '82': 'tarn-et-garonne',
  '83': 'var', '84': 'vaucluse', '85': 'vendee', '86': 'vienne',
  '87': 'haute-vienne', '88': 'vosges', '89': 'yonne', '90': 'territoire-de-belfort',
  '91': 'essonne', '92': 'hauts-de-seine', '93': 'seine-saint-denis', '94': 'val-de-marne',
  '95': 'val-doise', '971': 'guadeloupe', '972': 'martinique', '973': 'guyane',
  '974': 'la-reunion', '976': 'mayotte',
}

const VALID_CERT_TYPES = new Set([
  'DPE', 'AMIANTE', 'PLOMB', 'GAZ', 'ELECTRICITE', 'TERMITES', 'CARREZ', 'ERP',
])

// ============================================
// Helpers
// ============================================
function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function departmentSlug(code: string): string {
  return DEPT_SLUGS[code] ?? `dept-${code}`
}

/** Geocode best-effort via BAN (gratuit, sans cle). 5 req/s soft cap. */
async function geocodeBan(
  city: string,
  postal: string | null,
): Promise<{ lat: number; lng: number } | null> {
  const query = postal ? `${city} ${postal}` : city
  const url = new URL('https://api-adresse.data.gouv.fr/search/')
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '1')
  url.searchParams.set('type', 'municipality')

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = (await res.json()) as BanResponse
    const feature = data.features?.[0]
    if (!feature) return null
    const [lng, lat] = feature.geometry.coordinates
    return { lat, lng }
  } catch {
    return null
  }
}

/** Sleep helper pour respecter rate-limit BAN (~5 req/s soft). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Parse CSV DHUP minimal — colonnes attendues (best effort, headers DHUP variable selon version) :
 *   "nom", "prenom", "certifications" (concatenees), "organisme_certif",
 *   "n_certification", "date_validite", "ville", "code_postal", "departement",
 *   "email", "telephone", "raison_sociale"
 *
 * Le format precis DHUP n'est pas figé contractuellement. On supporte :
 *   - CSV avec headers en français (encoding UTF-8 ou ISO-8859-1)
 *   - JSON array (si endpoint API)
 *
 * Si format non reconnu : retourne [] et marque erreur dans stats.
 */
function parseDhupCsv(csvText: string): DhupRow[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return []

  // Parse header (separateur , ou ; — DHUP varie selon export)
  const firstLine = lines[0] ?? ''
  const separator = firstLine.includes(';') ? ';' : ','
  const headers = firstLine.split(separator).map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase())

  const colIdx = (...names: string[]): number => {
    for (const name of names) {
      const idx = headers.indexOf(name)
      if (idx !== -1) return idx
    }
    return -1
  }

  const iNom = colIdx('nom', 'last_name', 'lastname')
  const iPrenom = colIdx('prenom', 'prénom', 'first_name', 'firstname')
  const iVille = colIdx('ville', 'commune', 'city')
  const iCP = colIdx('code_postal', 'cp', 'postal_code', 'postcode')
  const iDept = colIdx('departement', 'département', 'dept', 'department_code')
  const iCertif = colIdx('certifications', 'certification', 'domaines')
  const iOrganisme = colIdx('organisme', 'organisme_certif', 'organisme_certificateur')
  const iNumero = colIdx('numero', 'n_certification', 'numero_certification')
  const iValid = colIdx('date_validite', 'validite', 'valid_until', 'date_fin_validite')
  const iEmail = colIdx('email', 'courriel', 'mail')
  const iTel = colIdx('telephone', 'téléphone', 'phone', 'tel')
  const iRaison = colIdx('raison_sociale', 'entreprise', 'company', 'societe')

  if (iNom === -1 || iPrenom === -1 || iVille === -1) {
    return []
  }

  const rows: DhupRow[] = []

  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]
    if (!line) continue
    const cells = line
      .split(separator)
      .map((c) => c.replace(/^"|"$/g, '').trim())

    const last_name = cells[iNom] ?? ''
    const first_name = cells[iPrenom] ?? ''
    const city = cells[iVille] ?? ''
    if (!last_name || !first_name || !city) continue

    const postal = iCP !== -1 ? cells[iCP] ?? null : null
    const dept = iDept !== -1
      ? cells[iDept] ?? (postal ? postal.substring(0, 2) : '')
      : postal
        ? postal.substring(0, 2)
        : ''
    if (!dept) continue

    const certifRaw = iCertif !== -1 ? cells[iCertif] ?? '' : ''
    const organism = iOrganisme !== -1 ? cells[iOrganisme] ?? null : null
    const number = iNumero !== -1 ? cells[iNumero] ?? null : null
    const validUntil = iValid !== -1 ? cells[iValid] ?? null : null

    const certifications = certifRaw
      .split(/[,;|/]/)
      .map((c) => normalizeCertType(c.trim()))
      .filter((c): c is string => c !== null)
      .map((type) => ({
        type,
        organism,
        number,
        valid_until: validUntil,
        status: 'valid' as const,
      }))

    const dhup_source_id = `dhup_${slugify(last_name)}_${slugify(first_name)}_${postal ?? dept}`

    rows.push({
      dhup_source_id,
      first_name,
      last_name,
      city,
      postal_code: postal,
      department_code: dept,
      official_email: iEmail !== -1 ? cells[iEmail] ?? null : null,
      official_phone: iTel !== -1 ? cells[iTel] ?? null : null,
      official_company_name: iRaison !== -1 ? cells[iRaison] ?? null : null,
      certifications,
    })
  }

  return rows
}

/** Normalise un libelle certification DHUP vers nos types canoniques. */
function normalizeCertType(label: string): string | null {
  const up = label.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (up.includes('DPE') || up.includes('PERFORMANCE')) return 'DPE'
  if (up.includes('AMIANTE')) return 'AMIANTE'
  if (up.includes('PLOMB') || up.includes('CREP')) return 'PLOMB'
  if (up.includes('GAZ')) return 'GAZ'
  if (up.includes('ELEC')) return 'ELECTRICITE'
  if (up.includes('TERMITE')) return 'TERMITES'
  if (up.includes('CARREZ') || up.includes('BOUTIN') || up.includes('SURFACE')) return 'CARREZ'
  if (up.includes('ERP') || up.includes('RISQUE')) return 'ERP'
  return VALID_CERT_TYPES.has(up) ? up : null
}

// ============================================
// Handler
// ============================================
Deno.serve(async (req) => {
  const t0 = Date.now()
  const stats: ImportStats = {
    rows_total: 0,
    rows_inserted: 0,
    rows_updated: 0,
    rows_skipped: 0,
    geocode_hits: 0,
    geocode_misses: 0,
    errors: [],
    duration_ms: 0,
  }

  // --- Auth ---
  const authHeader = req.headers.get('Authorization') ?? ''
  const expected = `Bearer ${Deno.env.get('CRON_SECRET') ?? ''}`
  if (!Deno.env.get('CRON_SECRET') || authHeader !== expected) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // --- Supabase admin client ---
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'missing supabase env' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // --- Download DHUP dataset ---
  // URL configurable via env (l'ID de resource data.gouv.fr peut changer).
  // Fallback : pas d'import (renvoie warning, seed mock disponible).
  const dhupUrl = Deno.env.get('DHUP_RESOURCE_URL')
  if (!dhupUrl) {
    stats.errors.push(
      'DHUP_RESOURCE_URL non configuree. Utiliser le seed mock supabase/seed/diagnosticians-mock.sql en attendant.',
    )
    stats.duration_ms = Date.now() - t0
    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let rows: DhupRow[] = []
  try {
    const res = await fetch(dhupUrl, {
      headers: { Accept: 'text/csv, application/json' },
    })
    if (!res.ok) {
      stats.errors.push(`Download DHUP failed: HTTP ${res.status}`)
      stats.duration_ms = Date.now() - t0
      return new Response(JSON.stringify(stats), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const contentType = res.headers.get('content-type') ?? ''
    const body = await res.text()

    if (contentType.includes('application/json')) {
      const parsed = JSON.parse(body)
      rows = Array.isArray(parsed) ? (parsed as DhupRow[]) : []
    } else {
      rows = parseDhupCsv(body)
    }
  } catch (err) {
    stats.errors.push(`fetch/parse error: ${(err as Error).message}`)
    stats.duration_ms = Date.now() - t0
    return new Response(JSON.stringify(stats), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  stats.rows_total = rows.length

  if (rows.length === 0) {
    stats.errors.push('Dataset DHUP vide ou format non reconnu')
    stats.duration_ms = Date.now() - t0
    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // --- Upsert loop ---
  for (const row of rows) {
    try {
      // 1) Geocode (~5 req/s — pause 250ms)
      const geo = await geocodeBan(row.city, row.postal_code)
      if (geo) stats.geocode_hits++
      else stats.geocode_misses++
      await sleep(250)

      // 2) Lookup existant via dhup_source_id
      const { data: existing } = await supabase
        .from('diagnosticians')
        .select('id, slug')
        .eq('dhup_source_id', row.dhup_source_id)
        .maybeSingle()

      // 3) Slug
      let slug: string
      if (existing?.slug) {
        slug = existing.slug
      } else {
        const { data: slugData, error: slugErr } = await supabase.rpc(
          'generate_unique_diag_slug',
          {
            p_first: row.first_name,
            p_last: row.last_name,
            p_postal: row.postal_code ?? row.department_code,
          },
        )
        if (slugErr) {
          stats.errors.push(`slug rpc ${row.dhup_source_id}: ${slugErr.message}`)
          stats.rows_skipped++
          continue
        }
        slug = String(slugData)
      }

      const slugCity = slugify(row.city)
      const slugDept = departmentSlug(row.department_code)

      const payload = {
        dhup_source_id: row.dhup_source_id,
        first_name: row.first_name,
        last_name: row.last_name,
        city: row.city,
        postal_code: row.postal_code,
        department_code: row.department_code,
        geo_lat: geo?.lat ?? null,
        geo_lng: geo?.lng ?? null,
        certifications: row.certifications,
        official_email: row.official_email,
        official_phone: row.official_phone,
        official_company_name: row.official_company_name,
        slug,
        slug_city: slugCity,
        slug_dept: slugDept,
        dhup_last_synced_at: new Date().toISOString(),
      }

      if (existing) {
        const { error } = await supabase
          .from('diagnosticians')
          .update(payload)
          .eq('id', existing.id)
        if (error) {
          stats.errors.push(`update ${row.dhup_source_id}: ${error.message}`)
          stats.rows_skipped++
          continue
        }
        stats.rows_updated++
      } else {
        const { error } = await supabase
          .from('diagnosticians')
          .insert({ ...payload, dhup_imported_at: new Date().toISOString() })
        if (error) {
          stats.errors.push(`insert ${row.dhup_source_id}: ${error.message}`)
          stats.rows_skipped++
          continue
        }
        stats.rows_inserted++
      }
    } catch (err) {
      stats.errors.push(`row ${row.dhup_source_id}: ${(err as Error).message}`)
      stats.rows_skipped++
    }
  }

  stats.duration_ms = Date.now() - t0

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

// ============================================
// Setup cron mensuel (a executer une fois cote SQL, supabase/functions Studio) :
//
//   SELECT cron.schedule(
//     'import-dhup-monthly',
//     '0 3 1 * *',  -- 1er du mois 03:00 CET
//     $$
//     SELECT net.http_post(
//       url := 'https://<project-ref>.supabase.co/functions/v1/import-dhup-annuaire',
//       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret', true))
//     );
//     $$
//   );
//
// Pre-requis : extension pg_cron + pg_net activees, secret 'app.cron_secret'
// configure en variable session ou via Vault.
// ============================================
