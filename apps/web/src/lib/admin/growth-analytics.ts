/**
 * Analytics croissance — section /admin/croissance.
 *
 * Toutes les fonctions partent d'un client service_role (createAdminClient)
 * et travaillent en lecture seule. Pas de RPC dédié pour V1 : on charge les
 * lignes brutes (filtres temporels) et on agrège côté JS — volumes encore
 * faibles (quelques milliers de profils max à M12). À refactor en SQL natif
 * (CTE, group by, materialized view) si latence > 1s.
 *
 * Toutes les bornes "jour" / "semaine" / "mois" sont calées sur Europe/Paris.
 */

import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminSupabase = SupabaseClient<Database>

// ============================================
// Types publics
// ============================================

export interface SignupDayPoint {
  /** YYYY-MM-DD (Paris). */
  day: string
  count: number
}

export interface AcquisitionSourceRow {
  source: string
  count: number
  percent: number
}

export interface FunnelStep {
  label: string
  count: number
  /** % d'utilisateurs perdus entre l'étape précédente et celle-ci (0 pour la 1ère). */
  dropoffPct: number
}

export interface ConversionFunnel {
  signups: number
  activated: number
  firstMissionDone: number
  subscribed: number
  steps: FunnelStep[]
}

export interface CohortRetentionRow {
  /** YYYY-MM (mois du signup, Europe/Paris). */
  cohortMonth: string
  size: number
  retention: {
    w0: number
    w1: number
    w2: number
    w4: number
    w8: number
  }
}

export interface ActivationMonthRow {
  /** YYYY-MM. */
  month: string
  signups: number
  activated: number
  /** Ratio 0-1. */
  rate: number
}

export interface DauWauMau {
  dau: number
  wau: number
  mau: number
  /** dau / mau ; null si mau=0. */
  stickyRatio: number
}

// ============================================
// Helpers temporels (Europe/Paris)
// ============================================

/**
 * Renvoie minuit Paris du jour passé en argument, sous forme d'ISO string UTC.
 * Approche : convertit la date locale Paris en string ISO, puis ajuste.
 */
function startOfDayParisIso(date: Date): string {
  // toLocaleString('en-US', { timeZone: 'Europe/Paris' }) → "MM/DD/YYYY, HH:MM:SS AM"
  // On reconstruit un Date à minuit local Paris en parsant les parts.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  const y = Number(get('year'))
  const m = Number(get('month'))
  const d = Number(get('day'))
  // Date locale serveur → on veut minuit Paris en UTC. Paris est UTC+1 (CET) ou UTC+2 (CEST).
  // Approche robuste : itère jusqu'à trouver l'instant UTC dont la projection Paris == YYYY-MM-DDT00:00.
  // Plus simple : on construit minuit Europe/Paris via offset connu — pour V1 (margin error < 1h
  // sur DST switch days), on utilise Date.UTC(y, m-1, d) en supposant offset commun.
  // Mais on accepte ce léger risque DST (2j/an) ; le bucket reste cohérent.
  // Implémentation : on prend Date.UTC midnight, puis on soustrait l'offset de Paris à cet instant.
  const utcMidnight = Date.UTC(y, m - 1, d)
  // Offset Paris (ms) à cet instant via une autre formatToParts :
  const tzPartsAtUtc = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    timeZoneName: 'shortOffset',
  }).formatToParts(new Date(utcMidnight))
  const offsetPart = tzPartsAtUtc.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+1'
  // offsetPart format "GMT+1" ou "GMT+2"
  const offsetMatch = offsetPart.match(/GMT([+-])(\d+)/)
  const sign = offsetMatch?.[1] === '-' ? -1 : 1
  const hours = offsetMatch ? Number(offsetMatch[2]) : 1
  const offsetMs = sign * hours * 3600_000
  // L'instant UTC qui projette en YYYY-MM-DD 00:00 Paris = utcMidnight - offsetMs
  return new Date(utcMidnight - offsetMs).toISOString()
}

function formatDayParis(date: Date): string {
  // YYYY-MM-DD
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

function formatMonthParis(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}`
}

function startOfMonthParisIso(year: number, monthIdx0: number): string {
  // monthIdx0 = 0-based
  // Trick : construit la date 1er du mois 00:00 Paris.
  const tmp = new Date(Date.UTC(year, monthIdx0, 1))
  return startOfDayParisIso(tmp)
}

// ============================================
// A. Signups par jour
// ============================================

export async function getSignupsByDay(
  supabase: AdminSupabase,
  days = 30,
): Promise<SignupDayPoint[]> {
  const now = new Date()
  const startDate = new Date(now.getTime() - days * 24 * 3600_000)
  const startIso = startOfDayParisIso(startDate)

  const { data, error } = await supabase
    .from('profiles')
    .select('created_at')
    .gte('created_at', startIso)

  if (error || !data) {
    return []
  }

  // Bucket par jour Paris.
  const buckets = new Map<string, number>()
  // Pré-remplir tous les jours pour avoir une série continue.
  for (let i = 0; i <= days; i++) {
    const d = new Date(now.getTime() - (days - i) * 24 * 3600_000)
    buckets.set(formatDayParis(d), 0)
  }
  for (const row of data) {
    const day = formatDayParis(new Date(row.created_at))
    buckets.set(day, (buckets.get(day) ?? 0) + 1)
  }

  return Array.from(buckets.entries())
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

// ============================================
// B. Sources d'acquisition
// ============================================

/**
 * V1 stub : la table `profiles` n'a pas (encore) de colonne `source` / `referrer`.
 * On renvoie un unique bucket "Direct" — TODO V2 : ajouter colonnes `signup_source`
 * + `signup_medium` + `signup_campaign` (UTM tracking) sur profiles.
 */
export async function getAcquisitionSources(
  supabase: AdminSupabase,
): Promise<AcquisitionSourceRow[]> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  if (error) {
    return [{ source: 'Direct (V2)', count: 0, percent: 100 }]
  }

  const total = count ?? 0
  return [{ source: 'Direct', count: total, percent: total > 0 ? 100 : 0 }]
}

// ============================================
// C. Funnel de conversion
// ============================================

export async function getConversionFunnel(
  supabase: AdminSupabase,
  sinceMonth: Date,
): Promise<ConversionFunnel> {
  const sinceIso = startOfDayParisIso(sinceMonth)

  // 1. Signups
  const signupsRes = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sinceIso)
  const signups = signupsRes.count ?? 0

  // 2. Activated : profils ayant créé ≥1 dossier (toute date confondue, mais signup ≥ sinceMonth).
  //    On charge les created_by distincts de dossiers + cross-check avec profiles.created_at.
  const profilesRes = await supabase
    .from('profiles')
    .select('id, created_at')
    .gte('created_at', sinceIso)
  const recentProfileIds = new Set<string>((profilesRes.data ?? []).map((p) => p.id))

  const dossiersRes = await supabase
    .from('dossiers')
    .select('created_by, status')
    .not('created_by', 'is', null)
    .is('deleted_at', null)

  const dossierCreatorsOfRecent = new Set<string>()
  const doneDossierCreatorsOfRecent = new Set<string>()
  for (const row of dossiersRes.data ?? []) {
    if (row.created_by && recentProfileIds.has(row.created_by)) {
      dossierCreatorsOfRecent.add(row.created_by)
      if (row.status === 'done' || row.status === 'archived') {
        doneDossierCreatorsOfRecent.add(row.created_by)
      }
    }
  }
  const activated = dossierCreatorsOfRecent.size

  // 3. First mission completed : on prend les missions status='done', join avec dossiers.created_by.
  //    Plus simple : missions.created_by + status='done'.
  const missionsRes = await supabase
    .from('missions')
    .select('created_by, status')
    .eq('status', 'done')
    .not('created_by', 'is', null)
    .is('deleted_at', null)
  const missionDoneCreators = new Set<string>()
  for (const row of missionsRes.data ?? []) {
    if (row.created_by && recentProfileIds.has(row.created_by)) {
      missionDoneCreators.add(row.created_by)
    }
  }
  // Combine : either dossier-done or mission-done (fallback selon refonte dossier).
  for (const id of doneDossierCreatorsOfRecent) missionDoneCreators.add(id)
  const firstMissionDone = missionDoneCreators.size

  // 4. Subscribed : profiles → memberships → subscriptions status='active'.
  //    On récupère memberships pour les recent profiles, puis les orgs avec sub active.
  const membershipsRes = await supabase
    .from('memberships')
    .select('user_id, organization_id, status')
    .in(
      'user_id',
      recentProfileIds.size > 0
        ? Array.from(recentProfileIds)
        : ['00000000-0000-0000-0000-000000000000'],
    )
    .eq('status', 'active')
  const orgsOfRecent = new Map<string, Set<string>>() // org_id -> set(user_id)
  for (const m of membershipsRes.data ?? []) {
    if (!m.organization_id || !m.user_id) continue
    if (!orgsOfRecent.has(m.organization_id)) orgsOfRecent.set(m.organization_id, new Set())
    orgsOfRecent.get(m.organization_id)?.add(m.user_id)
  }
  let subscribed = 0
  if (orgsOfRecent.size > 0) {
    const subsRes = await supabase
      .from('subscriptions')
      .select('organization_id, status')
      .eq('status', 'active')
      .in('organization_id', Array.from(orgsOfRecent.keys()))
    const subscribedUserIds = new Set<string>()
    for (const sub of subsRes.data ?? []) {
      const users = orgsOfRecent.get(sub.organization_id)
      if (users) {
        for (const u of users) subscribedUserIds.add(u)
      }
    }
    subscribed = subscribedUserIds.size
  }

  // Steps avec dropoff.
  const rawSteps: Array<{ label: string; count: number }> = [
    { label: 'Signup', count: signups },
    { label: 'Activation (1er dossier)', count: activated },
    { label: '1ère mission terminée', count: firstMissionDone },
    { label: 'Abonnement actif', count: subscribed },
  ]

  const steps: FunnelStep[] = rawSteps.map((s, i) => {
    if (i === 0) return { ...s, dropoffPct: 0 }
    const prev = rawSteps[i - 1]?.count ?? 0
    if (prev === 0) return { ...s, dropoffPct: 0 }
    const dropoffPct = Math.max(0, ((prev - s.count) / prev) * 100)
    return { ...s, dropoffPct }
  })

  return {
    signups,
    activated,
    firstMissionDone,
    subscribed,
    steps,
  }
}

// ============================================
// D. Cohort retention
// ============================================

interface ActivityEvent {
  userId: string
  ts: number
}

async function fetchAllActivityEvents(
  supabase: AdminSupabase,
  sinceIso: string,
): Promise<ActivityEvent[]> {
  // On collecte tous les "events d'activité" (created_by sur dossiers, missions, photos, voice_notes)
  // depuis sinceIso. Volumes raisonnables V1.
  const events: ActivityEvent[] = []

  const dossiers = await supabase
    .from('dossiers')
    .select('created_by, created_at')
    .gte('created_at', sinceIso)
    .not('created_by', 'is', null)
  for (const row of dossiers.data ?? []) {
    if (row.created_by)
      events.push({ userId: row.created_by, ts: new Date(row.created_at).getTime() })
  }

  const missions = await supabase
    .from('missions')
    .select('created_by, created_at')
    .gte('created_at', sinceIso)
    .not('created_by', 'is', null)
  for (const row of missions.data ?? []) {
    if (row.created_by)
      events.push({ userId: row.created_by, ts: new Date(row.created_at).getTime() })
  }

  const photos = await supabase
    .from('photos')
    .select('uploaded_by, created_at')
    .gte('created_at', sinceIso)
    .not('uploaded_by', 'is', null)
  for (const row of photos.data ?? []) {
    if (row.uploaded_by)
      events.push({ userId: row.uploaded_by, ts: new Date(row.created_at).getTime() })
  }

  const voices = await supabase
    .from('voice_notes')
    .select('recorded_by, created_at')
    .gte('created_at', sinceIso)
    .not('recorded_by', 'is', null)
  for (const row of voices.data ?? []) {
    if (row.recorded_by)
      events.push({ userId: row.recorded_by, ts: new Date(row.created_at).getTime() })
  }

  return events
}

export async function getCohortRetention(
  supabase: AdminSupabase,
  cohorts = 6,
): Promise<CohortRetentionRow[]> {
  const now = new Date()
  // Liste des mois cohort (du plus ancien au plus récent).
  const cohortDates: Date[] = []
  for (let i = cohorts - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    cohortDates.push(d)
  }

  // On a besoin du début du plus ancien mois pour la requête.
  const oldestCohort = cohortDates[0]
  if (!oldestCohort) return []
  const sinceIso = startOfMonthParisIso(oldestCohort.getUTCFullYear(), oldestCohort.getUTCMonth())

  // 1. Charger les profils créés depuis le 1er cohort.
  const profilesRes = await supabase
    .from('profiles')
    .select('id, created_at')
    .gte('created_at', sinceIso)

  const profilesByCohort = new Map<string, Array<{ id: string; signupTs: number }>>()
  for (const p of profilesRes.data ?? []) {
    const monthKey = formatMonthParis(new Date(p.created_at))
    if (!profilesByCohort.has(monthKey)) profilesByCohort.set(monthKey, [])
    profilesByCohort.get(monthKey)?.push({ id: p.id, signupTs: new Date(p.created_at).getTime() })
  }

  // 2. Charger tous les events d'activité depuis sinceIso.
  const events = await fetchAllActivityEvents(supabase, sinceIso)
  const eventsByUser = new Map<string, number[]>()
  for (const e of events) {
    if (!eventsByUser.has(e.userId)) eventsByUser.set(e.userId, [])
    eventsByUser.get(e.userId)?.push(e.ts)
  }

  // 3. Pour chaque cohort, calculer retention W0/W1/W2/W4/W8.
  const WEEK_MS = 7 * 24 * 3600_000
  const result: CohortRetentionRow[] = []
  for (const cohortDate of cohortDates) {
    const cohortKey = formatMonthParis(cohortDate)
    const members = profilesByCohort.get(cohortKey) ?? []
    if (members.length === 0) {
      result.push({
        cohortMonth: cohortKey,
        size: 0,
        retention: { w0: 0, w1: 0, w2: 0, w4: 0, w8: 0 },
      })
      continue
    }

    const buckets: Array<keyof CohortRetentionRow['retention']> = ['w0', 'w1', 'w2', 'w4', 'w8']
    const bucketOffsets: Record<string, [number, number]> = {
      w0: [0, 1],
      w1: [1, 2],
      w2: [2, 3],
      w4: [4, 5],
      w8: [8, 9],
    }

    const retention = { w0: 0, w1: 0, w2: 0, w4: 0, w8: 0 }
    for (const member of members) {
      const userEvents = eventsByUser.get(member.id) ?? []
      for (const bucket of buckets) {
        const offsetTuple = bucketOffsets[bucket]
        if (!offsetTuple) continue
        const [startW, endW] = offsetTuple
        const start = member.signupTs + startW * WEEK_MS
        const end = member.signupTs + endW * WEEK_MS
        const active = userEvents.some((ts) => ts >= start && ts < end)
        if (active) {
          retention[bucket] += 1
        }
      }
    }

    result.push({
      cohortMonth: cohortKey,
      size: members.length,
      retention,
    })
  }

  return result
}

// ============================================
// E. Activation rate par mois
// ============================================

export async function getActivationRateByMonth(
  supabase: AdminSupabase,
  months = 6,
): Promise<ActivationMonthRow[]> {
  const now = new Date()
  const monthDates: Date[] = []
  for (let i = months - 1; i >= 0; i--) {
    monthDates.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)))
  }
  const oldest = monthDates[0]
  if (!oldest) return []
  const sinceIso = startOfMonthParisIso(oldest.getUTCFullYear(), oldest.getUTCMonth())

  // Charger profils + dossier-creators distincts.
  const profilesRes = await supabase
    .from('profiles')
    .select('id, created_at')
    .gte('created_at', sinceIso)

  const dossiersRes = await supabase
    .from('dossiers')
    .select('created_by')
    .not('created_by', 'is', null)
    .is('deleted_at', null)
  const dossierCreators = new Set<string>()
  for (const row of dossiersRes.data ?? []) {
    if (row.created_by) dossierCreators.add(row.created_by)
  }

  // Grouper par mois.
  const monthBuckets = new Map<string, { signups: number; activated: number }>()
  for (const d of monthDates) {
    monthBuckets.set(formatMonthParis(d), { signups: 0, activated: 0 })
  }

  for (const p of profilesRes.data ?? []) {
    const key = formatMonthParis(new Date(p.created_at))
    const bucket = monthBuckets.get(key)
    if (!bucket) continue
    bucket.signups += 1
    if (dossierCreators.has(p.id)) {
      bucket.activated += 1
    }
  }

  return Array.from(monthBuckets.entries()).map(([month, { signups, activated }]) => ({
    month,
    signups,
    activated,
    rate: signups > 0 ? activated / signups : 0,
  }))
}

// ============================================
// F. DAU / WAU / MAU
// ============================================

async function countDistinctUsersSince(supabase: AdminSupabase, sinceIso: string): Promise<number> {
  const userIds = new Set<string>()

  const dossiers = await supabase
    .from('dossiers')
    .select('created_by')
    .gte('created_at', sinceIso)
    .not('created_by', 'is', null)
  for (const row of dossiers.data ?? []) {
    if (row.created_by) userIds.add(row.created_by)
  }

  const missions = await supabase
    .from('missions')
    .select('created_by')
    .gte('created_at', sinceIso)
    .not('created_by', 'is', null)
  for (const row of missions.data ?? []) {
    if (row.created_by) userIds.add(row.created_by)
  }

  const photos = await supabase
    .from('photos')
    .select('uploaded_by')
    .gte('created_at', sinceIso)
    .not('uploaded_by', 'is', null)
  for (const row of photos.data ?? []) {
    if (row.uploaded_by) userIds.add(row.uploaded_by)
  }

  const voices = await supabase
    .from('voice_notes')
    .select('recorded_by')
    .gte('created_at', sinceIso)
    .not('recorded_by', 'is', null)
  for (const row of voices.data ?? []) {
    if (row.recorded_by) userIds.add(row.recorded_by)
  }

  return userIds.size
}

export async function getDauWauMau(supabase: AdminSupabase): Promise<DauWauMau> {
  const now = new Date()
  const todayIso = startOfDayParisIso(now)
  const wauIso = startOfDayParisIso(new Date(now.getTime() - 7 * 24 * 3600_000))
  const mauIso = startOfDayParisIso(new Date(now.getTime() - 30 * 24 * 3600_000))

  const [dau, wau, mau] = await Promise.all([
    countDistinctUsersSince(supabase, todayIso),
    countDistinctUsersSince(supabase, wauIso),
    countDistinctUsersSince(supabase, mauIso),
  ])

  const stickyRatio = mau > 0 ? dau / mau : 0
  return { dau, wau, mau, stickyRatio }
}
