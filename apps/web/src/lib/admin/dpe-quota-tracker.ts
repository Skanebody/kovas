/**
 * KOVAS — Tracker quota DPE annuel par diagnostiqueur (Phase A scheduling).
 *
 * Limite légale FR : 1000 DPE/an/diagnostiqueur (article R134-4-3 Code construction).
 *
 * Différence avec `lib/dpe-counter.ts` :
 *   - dpe-counter.ts compte au niveau **organisation** (par missions de l'org)
 *   - dpe-quota-tracker.ts compte au niveau **user** (par dossiers où created_by = user)
 *     car la limite légale est attachée à la personne physique, pas à la SASU.
 *
 * Fenêtre glissante 12 mois (vs année calendaire de dpe-counter.ts) pour suivre la
 * limite légale réelle (1000 sur 12 mois consécutifs).
 *
 * Dédup d'alertes : on n'insère pas deux fois une alerte de même `severity` pour le
 * même `user_id` dans un intervalle de 30 jours (anti-spam notification).
 *
 * Authority : briefing scheduling 2026-05-20.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const DPE_ANNUAL_LIMIT = Number(process.env.DPE_ANNUAL_LIMIT ?? 1000)

const DPE_MISSION_TYPES = ['dpe_vente', 'dpe_location', 'copropriete'] as const
const DEDUP_WINDOW_DAYS = 30

export interface QuotaWarning {
  severity: 'info' | 'warning' | 'critical'
  message: string
  count: number
  limit: number
  percentUsed: number
  /** Combien de jours avant que le DPE le plus ancien sorte de la fenêtre 12 mois. */
  daysUntilQuotaFrees: number
}

interface DossierRow {
  id: string
}

interface MissionDpeRow {
  dossier_id: string
  completed_at: string | null
  status: string
}

interface DossierBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      is: (
        col: string,
        val: null,
      ) => Promise<{
        data: DossierRow[] | null
        error: { message: string } | null
      }>
    }
  }
}

interface MissionBuilder {
  select: (cols: string) => {
    in: (
      col: string,
      vals: readonly string[],
    ) => {
      in: (
        col: string,
        vals: readonly string[],
      ) => {
        in: (
          col: string,
          vals: string[],
        ) => {
          gte: (
            col: string,
            val: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{
              data: MissionDpeRow[] | null
              error: { message: string } | null
            }>
          }
        }
      }
    }
  }
}

interface DpeAlertExistingRow {
  id: string
}

interface DpeAlertBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      eq: (
        col: string,
        val: string,
      ) => {
        gte: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: DpeAlertExistingRow | null
            error: { message: string } | null
          }>
        }
      }
    }
  }
  insert: (row: {
    user_id: string
    dpe_count: number
    percent_used: number
    severity: 'info' | 'warning' | 'critical'
  }) => Promise<{ error: { message: string } | null }>
}

/**
 * Determine la sévérité de l'alerte selon le pourcentage utilisé.
 * Seuils : 80% (info) / 95% (warning) / 100% (critical).
 */
function severityFor(percentUsed: number): 'info' | 'warning' | 'critical' | null {
  if (percentUsed >= 100) return 'critical'
  if (percentUsed >= 95) return 'warning'
  if (percentUsed >= 80) return 'info'
  return null
}

function messageFor(
  severity: 'info' | 'warning' | 'critical',
  count: number,
  limit: number,
  daysUntilQuotaFrees: number,
): string {
  const remaining = Math.max(limit - count, 0)
  switch (severity) {
    case 'critical':
      return `Limite légale atteinte (${count}/${limit} DPE). Le quota se libère dans ${daysUntilQuotaFrees} jours.`
    case 'warning':
      return `Plus que ${remaining} DPE possibles avant la limite légale (${count}/${limit}). Critique : revoyez votre planning.`
    default:
      return `Vous approchez de la limite (${count}/${limit} DPE). ${remaining} DPE restants sur les 12 derniers mois.`
  }
}

/**
 * Vérifie le quota DPE d'un utilisateur sur les 12 derniers mois glissants.
 *
 * @returns null si l'utilisateur est < 80% du quota (pas d'alerte à émettre).
 *          Sinon un QuotaWarning avec sévérité + message + métadonnées.
 *
 * Effet de bord : INSERT dpe_quota_alerts si pas d'alerte de même sévérité dans
 * les 30 derniers jours (dédup anti-spam).
 */
export async function checkDpeQuota(
  userId: string,
  supabase: SupabaseClient,
): Promise<QuotaWarning | null> {
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  const twelveMonthsAgoIso = twelveMonthsAgo.toISOString()

  // 1. Récupérer les dossier_ids créés par ce user
  const dossierTable = supabase.from('dossiers') as unknown as DossierBuilder
  const { data: dossierRows } = await dossierTable
    .select('id')
    .eq('created_by', userId)
    .is('deleted_at', null)

  const dossierIds = (dossierRows ?? []).map((d) => d.id)
  if (dossierIds.length === 0) return null

  // 2. Compter les missions DPE liées à ces dossiers (statut done/exported, dans la fenêtre)
  // Pas de FK directe missions → dossiers dans le schéma actuel ; on suppose que les
  // missions d'un dossier partagent property_id/client_id. Ici on filtre par property_id
  // appartenant aux dossiers du user, ce qui est l'équivalent métier le plus proche.
  //
  // V1.5+ : quand `missions.dossier_id` sera ajouté, basculer sur cette colonne directe.
  const propertyIdsTable = supabase.from('dossiers') as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        is: (
          col: string,
          val: null,
        ) => Promise<{
          data: Array<{ property_id: string }> | null
          error: { message: string } | null
        }>
      }
    }
  }
  const { data: propRows } = await propertyIdsTable
    .select('property_id')
    .eq('created_by', userId)
    .is('deleted_at', null)
  const propertyIds = Array.from(new Set((propRows ?? []).map((p) => p.property_id)))
  if (propertyIds.length === 0) return null

  const missionTable = supabase.from('missions') as unknown as MissionBuilder
  const { data: missions } = await missionTable
    .select('dossier_id, completed_at, status')
    .in('type', DPE_MISSION_TYPES)
    .in('status', ['done', 'exported'])
    .in('property_id', propertyIds)
    .gte('completed_at', twelveMonthsAgoIso)
    .order('completed_at', { ascending: true })

  const completedMissions = (missions ?? []).filter((m) => m.completed_at !== null)
  const count = completedMissions.length
  const percentUsed = Math.round((count / DPE_ANNUAL_LIMIT) * 10000) / 100

  const severity = severityFor(percentUsed)
  if (!severity) return null

  // 3. Calcul daysUntilQuotaFrees = (oldest_completed_at + 12 mois) - now
  let daysUntilQuotaFrees = 0
  const oldest = completedMissions[0]?.completed_at
  if (oldest) {
    const oldestDate = new Date(oldest)
    const freeDate = new Date(oldestDate)
    freeDate.setMonth(freeDate.getMonth() + 12)
    daysUntilQuotaFrees = Math.max(
      Math.ceil((freeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      0,
    )
  }

  const warning: QuotaWarning = {
    severity,
    message: messageFor(severity, count, DPE_ANNUAL_LIMIT, daysUntilQuotaFrees),
    count,
    limit: DPE_ANNUAL_LIMIT,
    percentUsed,
    daysUntilQuotaFrees,
  }

  // 4. Dédup INSERT dpe_quota_alerts
  await maybeInsertAlert(userId, warning, supabase)

  return warning
}

async function maybeInsertAlert(
  userId: string,
  warning: QuotaWarning,
  supabase: SupabaseClient,
): Promise<void> {
  const dedupSince = new Date()
  dedupSince.setDate(dedupSince.getDate() - DEDUP_WINDOW_DAYS)

  const alertTable = supabase.from('dpe_quota_alerts') as unknown as DpeAlertBuilder
  const { data: existing } = await alertTable
    .select('id')
    .eq('user_id', userId)
    .eq('severity', warning.severity)
    .gte('created_at', dedupSince.toISOString())
    .maybeSingle()

  if (existing) return

  await alertTable.insert({
    user_id: userId,
    dpe_count: warning.count,
    percent_used: warning.percentUsed,
    severity: warning.severity,
  })
}
