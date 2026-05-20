/**
 * Analytics produit — section /admin/produit.
 *
 * Mesure l'adoption des features V1 (Capture-First, Live voice, post-photo notes,
 * Import/Export Liciel, calendrier .ics, mode mission) sur la fenêtre du mois en
 * cours (Europe/Paris). Toutes les requêtes passent par createAdminClient
 * (service_role) — la page parent /admin/produit est protégée par le layout
 * (gated) qui vérifie verifyAdminAccess.
 *
 * Stratégie V1 : on charge des projections minimales (idéalement count head:true)
 * puis on agrège côté JS. Volumes encore modestes (quelques milliers de rows max
 * sur les tables capture-first à M6-M12). À refactoriser en RPC SQL (CTE,
 * percentile_cont, GROUP BY) si latence > 1s.
 *
 * Tables non encore présentes dans le Database type généré (cf. CLAUDE.md §22) :
 *   - mission_sessions, dossier_exports, dossier_field_values, mission_text_notes,
 *     user_preferences, import_jobs.
 * On les adresse via cast `as unknown as` typé localement, comme audit-log.ts.
 */

import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminSupabase = SupabaseClient<Database>

// ============================================
// Types publics
// ============================================

export type FeatureKey =
  | 'capture_first'
  | 'live_voice'
  | 'post_photo_text'
  | 'import_liciel'
  | 'export_liciel'
  | 'calendar_sync'
  | 'mission_mode'

export interface FeatureAdoptionRow {
  feature: FeatureKey
  label: string
  adoptionPct: number
  activeOrgs: number
  totalOrgs: number
}

export interface CaptureVsClassicSplit {
  capture: number
  classic: number
  capturePct: number
}

export interface ExtractionQualityStats {
  avgConfidence: number
  validatedPct: number
  conflictPct: number
  totalFields: number
}

export interface MostCorrectedField {
  fieldPath: string
  diagnostic: string
  editCount: number
  totalCount: number
  correctionRate: number
}

export interface MissionDurationBucket {
  bucket: string
  count: number
}

export interface UsageHeatmapCell {
  /** 0 = lundi, 6 = dimanche (convention FR — alors que Postgres dow renvoie 0 = dim). */
  dayOfWeek: number
  /** Heure 0-23 (Europe/Paris). */
  hour: number
  count: number
}

// ============================================
// Helpers temps (Europe/Paris)
// ============================================

function startOfMonthParisIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00'
  const y = Number(get('year'))
  const m = Number(get('month'))
  // 1er du mois 00:00 Paris : on utilise UTC en supposant offset commun (DST tolérance 1h/an).
  const utcMidnight = Date.UTC(y, m - 1, 1)
  const tzParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    timeZoneName: 'shortOffset',
  }).formatToParts(new Date(utcMidnight))
  const offsetPart = tzParts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+1'
  const offsetMatch = offsetPart.match(/GMT([+-])(\d+)/)
  const sign = offsetMatch?.[1] === '-' ? -1 : 1
  const hours = offsetMatch ? Number(offsetMatch[2]) : 1
  const offsetMs = sign * hours * 3600_000
  return new Date(utcMidnight - offsetMs).toISOString()
}

function daysAgoIso(days: number): string {
  const ts = Date.now() - days * 24 * 3600_000
  return new Date(ts).toISOString()
}

// ============================================
// Helpers DB (tables non typées dans Database)
// ============================================

interface RawPhotoVisionStatus {
  organization_id: string
  vision_status: string | null
}

interface RawVoiceAttachedPhoto {
  organization_id: string
  attached_photo_id: string | null
}

interface RawMissionTextNote {
  organization_id: string
}

interface RawImportJob {
  organization_id: string
  status: string
}

interface RawDossierExport {
  organization_id: string
  destination: string
}

interface RawMissionSession {
  organization_id: string
  duration_seconds: number | null
}

interface RawUserPref {
  terrain_mode: string
  user_id: string
}

interface RawFieldValueRow {
  diagnostic_type: string
  field_path: string
  source_type: string
  confidence: number | null
  validated_by_user: boolean | null
  has_conflict: boolean | null
  manually_edited_at: string | null
}

interface RawDossierCreated {
  organization_id: string
  created_at: string
}

/**
 * Charge l'ensemble des orgs qui ont eu au moins une activité (création dossier
 * ou photo ou voice_note) sur la fenêtre `sinceIso`. Sert de dénominateur pour
 * l'adoption — autrement on diviserait par toutes les orgs jamais créées (bruit).
 */
async function getActiveOrgIdsThisMonth(supabase: AdminSupabase): Promise<Set<string>> {
  const sinceIso = startOfMonthParisIso()
  const orgs = new Set<string>()

  const dossiers = await supabase
    .from('dossiers')
    .select('organization_id')
    .gte('created_at', sinceIso)
  for (const row of dossiers.data ?? []) {
    if (row.organization_id) orgs.add(row.organization_id)
  }

  const photos = await supabase.from('photos').select('organization_id').gte('created_at', sinceIso)
  for (const row of photos.data ?? []) {
    if (row.organization_id) orgs.add(row.organization_id)
  }

  const voices = await supabase
    .from('voice_notes')
    .select('organization_id')
    .gte('created_at', sinceIso)
  for (const row of voices.data ?? []) {
    if (row.organization_id) orgs.add(row.organization_id)
  }

  return orgs
}

// ============================================
// A. Feature adoption
// ============================================

export async function getFeatureAdoption(supabase: AdminSupabase): Promise<FeatureAdoptionRow[]> {
  const sinceIso = startOfMonthParisIso()
  const activeOrgs = await getActiveOrgIdsThisMonth(supabase)
  const totalActive = activeOrgs.size

  // ------ 1. Capture-First : orgs avec photos vision_status='analyzed' OU 'processing' ------
  const capturePhotos = await supabase
    .from('photos')
    .select('organization_id, vision_status')
    .gte('created_at', sinceIso)
    .not('vision_status', 'is', null)
  const captureOrgs = new Set<string>()
  for (const row of (capturePhotos.data ?? []) as RawPhotoVisionStatus[]) {
    if (
      row.organization_id &&
      row.vision_status &&
      row.vision_status !== 'pending' &&
      activeOrgs.has(row.organization_id)
    ) {
      captureOrgs.add(row.organization_id)
    }
  }

  // ------ 2. Live voice : orgs avec voice_notes attached_photo_id IS NOT NULL ------
  // attached_photo_id n'est PAS dans le Database type généré → cast typé.
  const liveVoiceRes = (await (
    supabase.from('voice_notes') as unknown as {
      select: (cols: string) => {
        gte: (
          col: string,
          val: string,
        ) => {
          not: (
            col: string,
            op: string,
            val: null,
          ) => Promise<{ data: RawVoiceAttachedPhoto[] | null; error: { message: string } | null }>
        }
      }
    }
  )
    .select('organization_id, attached_photo_id')
    .gte('created_at', sinceIso)
    .not('attached_photo_id', 'is', null)) as {
    data: RawVoiceAttachedPhoto[] | null
    error: { message: string } | null
  }
  const liveVoiceOrgs = new Set<string>()
  for (const row of liveVoiceRes.data ?? []) {
    if (row.organization_id && activeOrgs.has(row.organization_id)) {
      liveVoiceOrgs.add(row.organization_id)
    }
  }

  // ------ 3. Post-photo text notes : table mission_text_notes (non typée) ------
  const textNotesRes = (await (
    supabase.from('mission_text_notes') as unknown as {
      select: (cols: string) => {
        gte: (
          col: string,
          val: string,
        ) => Promise<{ data: RawMissionTextNote[] | null; error: { message: string } | null }>
      }
    }
  )
    .select('organization_id')
    .gte('created_at', sinceIso)) as {
    data: RawMissionTextNote[] | null
    error: { message: string } | null
  }
  const textNotesOrgs = new Set<string>()
  for (const row of textNotesRes.data ?? []) {
    if (row.organization_id && activeOrgs.has(row.organization_id)) {
      textNotesOrgs.add(row.organization_id)
    }
  }

  // ------ 4. Import Liciel : import_jobs status='completed' ce mois ------
  const importJobsRes = (await (
    supabase.from('import_jobs') as unknown as {
      select: (cols: string) => {
        gte: (
          col: string,
          val: string,
        ) => {
          eq: (
            col: string,
            val: string,
          ) => Promise<{ data: RawImportJob[] | null; error: { message: string } | null }>
        }
      }
    }
  )
    .select('organization_id, status')
    .gte('created_at', sinceIso)
    .eq('status', 'completed')) as {
    data: RawImportJob[] | null
    error: { message: string } | null
  }
  const importOrgs = new Set<string>()
  for (const row of importJobsRes.data ?? []) {
    if (row.organization_id && activeOrgs.has(row.organization_id)) {
      importOrgs.add(row.organization_id)
    }
  }

  // ------ 5. Export Liciel ZIP : dossier_exports destination='liciel_zip' ------
  const exportLicielRes = (await (
    supabase.from('dossier_exports') as unknown as {
      select: (cols: string) => {
        gte: (
          col: string,
          val: string,
        ) => {
          eq: (
            col: string,
            val: string,
          ) => Promise<{ data: RawDossierExport[] | null; error: { message: string } | null }>
        }
      }
    }
  )
    .select('organization_id, destination')
    .gte('created_at', sinceIso)
    .eq('destination', 'liciel_zip')) as {
    data: RawDossierExport[] | null
    error: { message: string } | null
  }
  const exportOrgs = new Set<string>()
  for (const row of exportLicielRes.data ?? []) {
    if (row.organization_id && activeOrgs.has(row.organization_id)) {
      exportOrgs.add(row.organization_id)
    }
  }

  // ------ 6. Calendar sync : pas de table dédiée encore, stub V1 = 0% ------
  // TODO V2 : créer table `calendar_subscriptions` ou tracker access logs sur
  // route /api/calendar/[orgId]/[token].ics. Pour V1 on renvoie 0 orgs / total.
  const calendarOrgs = new Set<string>()

  // ------ 7. Mission mode : mission_sessions ce mois ------
  const missionSessionsRes = (await (
    supabase.from('mission_sessions') as unknown as {
      select: (cols: string) => {
        gte: (
          col: string,
          val: string,
        ) => Promise<{ data: RawMissionSession[] | null; error: { message: string } | null }>
      }
    }
  )
    .select('organization_id, duration_seconds')
    .gte('created_at', sinceIso)) as {
    data: RawMissionSession[] | null
    error: { message: string } | null
  }
  const missionModeOrgs = new Set<string>()
  for (const row of missionSessionsRes.data ?? []) {
    if (row.organization_id && activeOrgs.has(row.organization_id)) {
      missionModeOrgs.add(row.organization_id)
    }
  }

  const rows: FeatureAdoptionRow[] = [
    {
      feature: 'capture_first',
      label: 'Mode Capture-First (photos Vision)',
      adoptionPct: totalActive > 0 ? (captureOrgs.size / totalActive) * 100 : 0,
      activeOrgs: captureOrgs.size,
      totalOrgs: totalActive,
    },
    {
      feature: 'live_voice',
      label: 'Voix attachée à une photo (LiveCapture)',
      adoptionPct: totalActive > 0 ? (liveVoiceOrgs.size / totalActive) * 100 : 0,
      activeOrgs: liveVoiceOrgs.size,
      totalOrgs: totalActive,
    },
    {
      feature: 'post_photo_text',
      label: 'Note texte post-photo',
      adoptionPct: totalActive > 0 ? (textNotesOrgs.size / totalActive) * 100 : 0,
      activeOrgs: textNotesOrgs.size,
      totalOrgs: totalActive,
    },
    {
      feature: 'import_liciel',
      label: 'Import Liciel (job complété)',
      adoptionPct: totalActive > 0 ? (importOrgs.size / totalActive) * 100 : 0,
      activeOrgs: importOrgs.size,
      totalOrgs: totalActive,
    },
    {
      feature: 'export_liciel',
      label: 'Export Liciel ZIP',
      adoptionPct: totalActive > 0 ? (exportOrgs.size / totalActive) * 100 : 0,
      activeOrgs: exportOrgs.size,
      totalOrgs: totalActive,
    },
    {
      feature: 'calendar_sync',
      label: 'Synchronisation calendrier (.ics)',
      adoptionPct: 0,
      activeOrgs: calendarOrgs.size,
      totalOrgs: totalActive,
    },
    {
      feature: 'mission_mode',
      label: 'Mode mission (session démarrée)',
      adoptionPct: totalActive > 0 ? (missionModeOrgs.size / totalActive) * 100 : 0,
      activeOrgs: missionModeOrgs.size,
      totalOrgs: totalActive,
    },
  ]

  // Tri par adoption desc — utile pour le bar chart horizontal.
  return rows.sort((a, b) => b.adoptionPct - a.adoptionPct)
}

// ============================================
// B. Capture vs Classic split
// ============================================

export async function getCaptureVsClassicSplit(
  supabase: AdminSupabase,
): Promise<CaptureVsClassicSplit> {
  // Approche : on lit user_preferences.terrain_mode. Si la table est vide
  // (tous les users sont en defaut 'capture' implicite), on tombe en mode "fallback"
  // qui compte les missions par usage photos vision (capture) vs sans (classic).
  const prefsRes = (await (
    supabase.from('user_preferences') as unknown as {
      select: (
        cols: string,
      ) => Promise<{ data: RawUserPref[] | null; error: { message: string } | null }>
    }
  ).select('terrain_mode, user_id')) as {
    data: RawUserPref[] | null
    error: { message: string } | null
  }

  const prefs = prefsRes.data ?? []
  if (prefs.length > 0) {
    let capture = 0
    let classic = 0
    for (const p of prefs) {
      if (p.terrain_mode === 'classic') classic += 1
      else capture += 1
    }
    const total = capture + classic
    return {
      capture,
      classic,
      capturePct: total > 0 ? (capture / total) * 100 : 0,
    }
  }

  // Fallback : on compte les dossiers actifs ce mois avec/sans photos vision_status='analyzed'.
  const sinceIso = startOfMonthParisIso()
  const dossiers = await supabase.from('dossiers').select('id').gte('created_at', sinceIso)
  const allDossierIds = (dossiers.data ?? []).map((d) => d.id)

  if (allDossierIds.length === 0) {
    return { capture: 0, classic: 0, capturePct: 0 }
  }

  const photosWithVision = await supabase
    .from('photos')
    .select('dossier_id, vision_status')
    .in('dossier_id', allDossierIds)
    .not('vision_status', 'is', null)
  const capturedDossiers = new Set<string>()
  for (const row of (photosWithVision.data ?? []) as Array<{
    dossier_id: string
    vision_status: string | null
  }>) {
    if (row.vision_status && row.vision_status !== 'pending') {
      capturedDossiers.add(row.dossier_id)
    }
  }
  const capture = capturedDossiers.size
  const classic = allDossierIds.length - capture
  return {
    capture,
    classic,
    capturePct: allDossierIds.length > 0 ? (capture / allDossierIds.length) * 100 : 0,
  }
}

// ============================================
// C. Extraction quality stats
// ============================================

export async function getExtractionQualityStats(
  supabase: AdminSupabase,
): Promise<ExtractionQualityStats> {
  // Lecture brute de dossier_field_values source_type='photo_vision' — agrégation JS.
  const fieldsRes = (await (
    supabase.from('dossier_field_values') as unknown as {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ data: RawFieldValueRow[] | null; error: { message: string } | null }>
      }
    }
  )
    .select(
      'diagnostic_type, field_path, source_type, confidence, validated_by_user, has_conflict, manually_edited_at',
    )
    .eq('source_type', 'photo_vision')) as {
    data: RawFieldValueRow[] | null
    error: { message: string } | null
  }

  const rows = fieldsRes.data ?? []
  const total = rows.length
  if (total === 0) {
    return { avgConfidence: 0, validatedPct: 0, conflictPct: 0, totalFields: 0 }
  }

  let confSum = 0
  let confCount = 0
  let validated = 0
  let conflict = 0
  for (const r of rows) {
    if (typeof r.confidence === 'number') {
      confSum += r.confidence
      confCount += 1
    }
    if (r.validated_by_user) validated += 1
    if (r.has_conflict) conflict += 1
  }

  return {
    avgConfidence: confCount > 0 ? confSum / confCount : 0,
    validatedPct: (validated / total) * 100,
    conflictPct: (conflict / total) * 100,
    totalFields: total,
  }
}

// ============================================
// D. Most corrected fields (top édités après extraction IA)
// ============================================

export async function getMostCorrectedFields(
  supabase: AdminSupabase,
  limit = 10,
): Promise<MostCorrectedField[]> {
  // On lit tous les rows source_type='photo_vision' puis on bucketise par
  // diagnostic_type+field_path. correctionRate = edits / total pour le couple.
  const res = (await (
    supabase.from('dossier_field_values') as unknown as {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ data: RawFieldValueRow[] | null; error: { message: string } | null }>
      }
    }
  )
    .select(
      'diagnostic_type, field_path, source_type, confidence, validated_by_user, has_conflict, manually_edited_at',
    )
    .eq('source_type', 'photo_vision')) as {
    data: RawFieldValueRow[] | null
    error: { message: string } | null
  }

  const rows = res.data ?? []
  const map = new Map<string, { editCount: number; totalCount: number }>()
  for (const r of rows) {
    const key = `${r.diagnostic_type}::${r.field_path}`
    const bucket = map.get(key) ?? { editCount: 0, totalCount: 0 }
    bucket.totalCount += 1
    if (r.manually_edited_at !== null) bucket.editCount += 1
    map.set(key, bucket)
  }

  const results: MostCorrectedField[] = []
  for (const [key, { editCount, totalCount }] of map.entries()) {
    if (editCount === 0) continue
    const sepIdx = key.indexOf('::')
    const diagnostic = key.slice(0, sepIdx)
    const fieldPath = key.slice(sepIdx + 2)
    results.push({
      fieldPath,
      diagnostic,
      editCount,
      totalCount,
      correctionRate: totalCount > 0 ? (editCount / totalCount) * 100 : 0,
    })
  }

  return results.sort((a, b) => b.editCount - a.editCount).slice(0, limit)
}

// ============================================
// E. Mission duration distribution
// ============================================

export async function getMissionDurationDistribution(
  supabase: AdminSupabase,
): Promise<MissionDurationBucket[]> {
  const res = (await (
    supabase.from('mission_sessions') as unknown as {
      select: (cols: string) => {
        not: (
          col: string,
          op: string,
          val: null,
        ) => Promise<{
          data: Array<{ duration_seconds: number | null }> | null
          error: { message: string } | null
        }>
      }
    }
  )
    .select('duration_seconds')
    .not('duration_seconds', 'is', null)) as {
    data: Array<{ duration_seconds: number | null }> | null
    error: { message: string } | null
  }

  const rows = res.data ?? []
  const buckets: MissionDurationBucket[] = [
    { bucket: '< 10 min', count: 0 },
    { bucket: '10-30 min', count: 0 },
    { bucket: '30-60 min', count: 0 },
    { bucket: '> 60 min', count: 0 },
  ]
  for (const r of rows) {
    const d = r.duration_seconds
    if (typeof d !== 'number') continue
    if (d < 600) {
      const b = buckets[0]
      if (b) b.count += 1
    } else if (d < 1800) {
      const b = buckets[1]
      if (b) b.count += 1
    } else if (d < 3600) {
      const b = buckets[2]
      if (b) b.count += 1
    } else {
      const b = buckets[3]
      if (b) b.count += 1
    }
  }
  return buckets
}

// ============================================
// F. Usage heatmap (jour × heure Europe/Paris)
// ============================================

export async function getUsageHeatmap(
  supabase: AdminSupabase,
  days = 30,
): Promise<UsageHeatmapCell[]> {
  const sinceIso = daysAgoIso(days)
  const res = await supabase.from('dossiers').select('created_at').gte('created_at', sinceIso)

  const rows = (res.data ?? []) as RawDossierCreated[] | Array<{ created_at: string }>

  // Grille pré-remplie 7×24 (lun..dim × 0..23).
  const grid = new Map<string, number>()
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      grid.set(`${d}-${h}`, 0)
    }
  }

  for (const row of rows) {
    const ts = row.created_at
    if (!ts) continue
    const dateUtc = new Date(ts)
    // Extraction date Paris.
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      weekday: 'short',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(dateUtc)
    const weekdayShort = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
    const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '00'
    // weekday → index (0 = lundi).
    const weekdayIdx: Record<string, number> = {
      Mon: 0,
      Tue: 1,
      Wed: 2,
      Thu: 3,
      Fri: 4,
      Sat: 5,
      Sun: 6,
    }
    const dow = weekdayIdx[weekdayShort] ?? 0
    // 'en-GB' avec hour12=false renvoie parfois '24' pour minuit → on normalise.
    const hourNumRaw = Number.parseInt(hourStr, 10)
    const hour = Number.isFinite(hourNumRaw) ? hourNumRaw % 24 : 0
    const key = `${dow}-${hour}`
    grid.set(key, (grid.get(key) ?? 0) + 1)
  }

  const cells: UsageHeatmapCell[] = []
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      cells.push({
        dayOfWeek: d,
        hour: h,
        count: grid.get(`${d}-${h}`) ?? 0,
      })
    }
  }
  return cells
}

// ============================================
// G. Feedback / support tickets (lecture brute)
// ============================================

export interface RecentFeedbackRow {
  id: string
  subject: string
  status: string
  priority: string | null
  createdAt: string
  orgId: string
}

export async function getRecentFeedback(
  supabase: AdminSupabase,
  limit = 10,
): Promise<RecentFeedbackRow[]> {
  // support_tickets EST typé (init_schema 2026-05-18). Pas de rating dédié V1 —
  // TODO V2 : ajouter colonne `rating` ou table `feedback` dédiée.
  const res = await supabase
    .from('support_tickets')
    .select('id, subject, status, priority, created_at, organization_id')
    .order('created_at', { ascending: false })
    .limit(limit)

  return (res.data ?? []).map((r) => ({
    id: r.id,
    subject: r.subject,
    status: r.status,
    priority: r.priority,
    createdAt: r.created_at,
    orgId: r.organization_id,
  }))
}
