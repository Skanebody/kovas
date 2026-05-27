import { sendLevelUnlockedEmail } from '@/lib/email/send'
import type { SupabaseClient } from '@supabase/supabase-js'
import { type Level, type LevelId, getLevelById, highestLevelFor, nextLevel } from './levels'

const LEVEL_EMAIL_MIN_INTERVAL_DAYS = 30

/**
 * Moteur de progression — calcule le niveau courant et le déblocage.
 *
 * Appelé :
 *   - au login (cf. middleware ou layout)
 *   - après chaque mission complétée (Server Action)
 *   - cron hebdo via Edge Function `recompute-all-levels`
 *
 * Side-effects :
 *   - upsert `user_progression`
 *   - insert `user_level_history` pour chaque palier franchi
 */

export interface ProgressDelta {
  missions?: { current: number; needed: number }
  subscriptionDays?: { current: number; needed: number }
  referralsPaid?: { current: number; needed: number }
  ademeScore?: { current: number; needed: number }
}

export interface RecomputeResult {
  currentLevel: Level
  nextLevel: Level | null
  progressToNext: ProgressDelta
  unlocked: Level[]
  stats: {
    totalMissions: number
    subscriptionDays: number
    totalReferralsPaid: number
    ademeExportScore: number | null
  }
}

/**
 * Calcule + persiste le niveau courant pour un utilisateur.
 * Idempotent — peut être appelé plusieurs fois sans effet de bord
 * (l'historique n'est inséré que sur transitions réelles).
 */
export async function recomputeUserLevel(
  supabase: SupabaseClient,
  userId: string,
  orgId: string | null,
): Promise<RecomputeResult> {
  // 1. Récolte des compteurs courants
  const stats = await collectStats(supabase, userId, orgId)

  // 2. Détermine le niveau cible
  const targetLevel = highestLevelFor(stats)

  // 3. Lit le niveau actuellement persisté
  const { data: progRow } = await supabase
    .from('user_progression')
    .select('current_level, current_level_unlocked_at')
    .eq('user_id', userId)
    .maybeSingle()

  const previousLevelId = (progRow as { current_level: number } | null)?.current_level ?? 1

  const nowIso = new Date().toISOString()
  const unlocked: Level[] = []

  // 4. Si progression : insertion de l'historique pour chaque palier franchi
  if (targetLevel.id > previousLevelId) {
    for (let lvl = previousLevelId + 1; lvl <= targetLevel.id; lvl++) {
      const stepLevel = getLevelById(lvl)
      if (!stepLevel) continue
      unlocked.push(stepLevel)
      await supabase.from('user_level_history').insert({
        user_id: userId,
        from_level: lvl - 1,
        to_level: lvl,
        unlocked_at: nowIso,
        reason: reasonFor(stepLevel, stats),
      })
    }

    // Notification email — uniquement pour le niveau le plus haut atteint,
    // avec rate-limit 1 email / 30 jours pour éviter le spam en cas de
    // progression multi-paliers d'un seul coup (ex: backfill).
    await maybeNotifyLevelUnlocked(supabase, userId, targetLevel)
  }

  // 5. Upsert état courant
  await supabase.from('user_progression').upsert(
    {
      user_id: userId,
      current_level: targetLevel.id,
      current_level_unlocked_at:
        targetLevel.id > previousLevelId
          ? nowIso
          : ((progRow as { current_level_unlocked_at: string } | null)?.current_level_unlocked_at ??
            nowIso),
      total_missions: stats.totalMissions,
      total_referrals_paid: stats.totalReferralsPaid,
      subscription_age_days: stats.subscriptionDays,
      ademe_export_score: stats.ademeExportScore,
      last_recomputed_at: nowIso,
    },
    { onConflict: 'user_id' },
  )

  return {
    currentLevel: targetLevel,
    nextLevel: nextLevel(targetLevel.id as LevelId),
    progressToNext: computeProgressDelta(targetLevel.id as LevelId, stats),
    unlocked,
    stats,
  }
}

/**
 * Récolte des compteurs nécessaires depuis Supabase :
 *   - total_missions : COUNT missions (organisation, statut done/exported)
 *   - subscriptionDays : Math.floor((now - subscription.created_at) / 86400000)
 *   - totalReferralsPaid : COUNT referrals (referrer_id=user, status in paid_invoice_1/rewarded)
 *   - ademeExportScore : moyenne `dossiers.ademe_score` si la colonne existe, sinon null
 */
async function collectStats(
  supabase: SupabaseClient,
  userId: string,
  orgId: string | null,
): Promise<RecomputeResult['stats']> {
  // Missions (compté sur l'organisation du user, status terminé)
  let totalMissions = 0
  if (orgId) {
    const { count } = await supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('status', ['done', 'exported'])
    totalMissions = count ?? 0
  }

  // Ancienneté d'abonnement
  let subscriptionDays = 0
  if (orgId) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('created_at')
      .eq('organization_id', orgId)
      .maybeSingle()
    if (sub) {
      const created = new Date((sub as { created_at: string }).created_at).getTime()
      subscriptionDays = Math.floor((Date.now() - created) / (24 * 60 * 60 * 1000))
    }
  }

  // Filleuls payants
  const { count: refPaidCount } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_id', userId)
    .in('status', ['paid_invoice_1', 'rewarded'])

  // Score ADEME — best-effort (la table peut ne pas avoir cette colonne en V1)
  const ademeExportScore: number | null = null
  // V1 : pas de colonne ademe_score sur dossiers — on garde null.
  // V2 (post cert ADEME) : SELECT AVG(ademe_score) FROM dossiers WHERE organization_id=...
  // pour ne pas casser le typecheck en V1, on stub à null.

  return {
    totalMissions,
    subscriptionDays,
    totalReferralsPaid: refPaidCount ?? 0,
    ademeExportScore,
  }
}

/**
 * Envoie un email "nouveau statut débloqué" sous conditions :
 *  - le user a un email valide
 *  - aucun email équivalent envoyé depuis 30 jours (rate-limit)
 *
 * Best-effort — n'échoue jamais le flux principal.
 */
async function maybeNotifyLevelUnlocked(
  supabase: SupabaseClient,
  userId: string,
  level: Level,
): Promise<void> {
  try {
    const cutoffIso = new Date(
      Date.now() - LEVEL_EMAIL_MIN_INTERVAL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString()

    const { count } = await supabase
      .from('user_level_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('unlocked_at', cutoffIso)
      .lt('to_level', level.id) // exclut la ligne tout juste insérée

    // Si déjà 1+ déblocage(s) dans la fenêtre, on a déjà notifié -> skip
    if ((count ?? 0) > 0) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle()

    const p = profile as { email: string; full_name: string | null } | null
    if (!p?.email) return

    const firstName = (p.full_name ?? p.email).split(/\s+/)[0]
    await sendLevelUnlockedEmail({
      to: p.email,
      firstName,
      levelLabel: level.label,
      levelDescription: level.description,
    })
  } catch (err) {
    console.warn('level unlock email failed:', err)
  }
}

function reasonFor(level: Level, stats: RecomputeResult['stats']): string {
  const triggers: string[] = []
  const c = level.unlockCriteria
  if (c.missions && stats.totalMissions >= c.missions) {
    triggers.push(`${stats.totalMissions} missions réalisées`)
  }
  if (c.subscriptionDays && stats.subscriptionDays >= c.subscriptionDays) {
    triggers.push(`${stats.subscriptionDays} jours d'abonnement`)
  }
  if (c.referralsPaid && stats.totalReferralsPaid >= c.referralsPaid) {
    triggers.push(`${stats.totalReferralsPaid} filleuls payants`)
  }
  if (c.ademeScore && (stats.ademeExportScore ?? 0) >= c.ademeScore) {
    triggers.push(`score ADEME ${Math.round((stats.ademeExportScore ?? 0) * 100)} %`)
  }
  return triggers.length > 0
    ? `Statut ${level.label} débloqué — ${triggers.join(', ')}.`
    : `Statut ${level.label} débloqué.`
}

function computeProgressDelta(
  currentLevelId: LevelId,
  stats: RecomputeResult['stats'],
): ProgressDelta {
  const next = nextLevel(currentLevelId)
  if (!next) return {}

  const delta: ProgressDelta = {}
  const c = next.unlockCriteria
  if (c.missions !== undefined) {
    delta.missions = { current: stats.totalMissions, needed: c.missions }
  }
  if (c.subscriptionDays !== undefined) {
    delta.subscriptionDays = { current: stats.subscriptionDays, needed: c.subscriptionDays }
  }
  if (c.referralsPaid !== undefined) {
    delta.referralsPaid = { current: stats.totalReferralsPaid, needed: c.referralsPaid }
  }
  if (c.ademeScore !== undefined) {
    delta.ademeScore = {
      current: stats.ademeExportScore ?? 0,
      needed: c.ademeScore,
    }
  }
  return delta
}

export interface LevelHistoryEntry {
  id: string
  fromLevel: number
  toLevel: number
  unlockedAt: string
  reason: string | null
}

export async function getLevelHistory(
  supabase: SupabaseClient,
  userId: string,
): Promise<LevelHistoryEntry[]> {
  const { data } = await supabase
    .from('user_level_history')
    .select('id, from_level, to_level, unlocked_at, reason')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false })
    .limit(20)

  if (!data) return []

  return (
    data as {
      id: string
      from_level: number
      to_level: number
      unlocked_at: string
      reason: string | null
    }[]
  ).map((d) => ({
    id: d.id,
    fromLevel: d.from_level,
    toLevel: d.to_level,
    unlockedAt: d.unlocked_at,
    reason: d.reason,
  }))
}
