/**
 * Lecture / écriture des préférences d'alertes par organisation.
 * Source de vérité : table `alert_preferences` (1 ligne par org).
 *
 * Convention : si la ligne n'existe pas → on retourne les DEFAULT_ALERT_PREFERENCES
 * sans écrire en DB (lazy upsert au premier `updateAlertPreferences`).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { type AlertPreferences, DEFAULT_ALERT_PREFERENCES } from './types'

interface AlertPreferencesRow {
  organization_id: string
  fraud_detection_enabled: boolean
  fraud_sensitivity: 'normal' | 'low' | 'very_low'
  pre_export_enabled: boolean
  pre_export_strictness: 'standard' | 'permissive'
  proactive_suggestions_mode: 'disabled' | 'checkout_only' | 'in_mission'
  coach_ai_enabled: boolean
  coach_ai_frequency: 'weekly' | 'monthly' | 'quarterly' | 'disabled'
  lead_notifications_enabled: boolean
  lead_notifications_quiet_hours_start: string
  lead_notifications_quiet_hours_end: string
  lead_notifications_weekend: boolean
  gamification_enabled: boolean
  level_notifications_enabled: boolean
}

function rowToPreferences(row: AlertPreferencesRow): AlertPreferences {
  return {
    organizationId: row.organization_id,
    fraudDetectionEnabled: row.fraud_detection_enabled,
    fraudSensitivity: row.fraud_sensitivity,
    preExportEnabled: row.pre_export_enabled,
    preExportStrictness: row.pre_export_strictness,
    proactiveSuggestionsMode: row.proactive_suggestions_mode,
    coachAiEnabled: row.coach_ai_enabled,
    coachAiFrequency: row.coach_ai_frequency,
    leadNotificationsEnabled: row.lead_notifications_enabled,
    leadQuietHoursStart: row.lead_notifications_quiet_hours_start,
    leadQuietHoursEnd: row.lead_notifications_quiet_hours_end,
    leadWeekendNotifications: row.lead_notifications_weekend,
    gamificationEnabled: row.gamification_enabled,
    levelNotificationsEnabled: row.level_notifications_enabled,
  }
}

function preferencesToRow(
  prefs: Partial<AlertPreferences> & { organizationId: string },
): Partial<AlertPreferencesRow> {
  const row: Partial<AlertPreferencesRow> = {
    organization_id: prefs.organizationId,
  }
  if (prefs.fraudDetectionEnabled !== undefined)
    row.fraud_detection_enabled = prefs.fraudDetectionEnabled
  if (prefs.fraudSensitivity !== undefined) row.fraud_sensitivity = prefs.fraudSensitivity
  if (prefs.preExportEnabled !== undefined) row.pre_export_enabled = prefs.preExportEnabled
  if (prefs.preExportStrictness !== undefined) row.pre_export_strictness = prefs.preExportStrictness
  if (prefs.proactiveSuggestionsMode !== undefined)
    row.proactive_suggestions_mode = prefs.proactiveSuggestionsMode
  if (prefs.coachAiEnabled !== undefined) row.coach_ai_enabled = prefs.coachAiEnabled
  if (prefs.coachAiFrequency !== undefined) row.coach_ai_frequency = prefs.coachAiFrequency
  if (prefs.leadNotificationsEnabled !== undefined)
    row.lead_notifications_enabled = prefs.leadNotificationsEnabled
  if (prefs.leadQuietHoursStart !== undefined)
    row.lead_notifications_quiet_hours_start = prefs.leadQuietHoursStart
  if (prefs.leadQuietHoursEnd !== undefined)
    row.lead_notifications_quiet_hours_end = prefs.leadQuietHoursEnd
  if (prefs.leadWeekendNotifications !== undefined)
    row.lead_notifications_weekend = prefs.leadWeekendNotifications
  if (prefs.gamificationEnabled !== undefined) row.gamification_enabled = prefs.gamificationEnabled
  if (prefs.levelNotificationsEnabled !== undefined)
    row.level_notifications_enabled = prefs.levelNotificationsEnabled
  return row
}

/**
 * Récupère les préférences de l'org. Retourne les défauts si la ligne n'existe pas.
 */
export async function getAlertPreferences(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<AlertPreferences> {
  const { data, error } = await supabase
    .from('alert_preferences')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) {
    console.warn('[alerts] getAlertPreferences failed, using defaults', error)
    return { organizationId, ...DEFAULT_ALERT_PREFERENCES }
  }
  if (!data) {
    return { organizationId, ...DEFAULT_ALERT_PREFERENCES }
  }
  return rowToPreferences(data as AlertPreferencesRow)
}

/**
 * Upsert des préférences. La première écriture crée la ligne.
 */
export async function updateAlertPreferences(
  supabase: SupabaseClient,
  prefs: Partial<AlertPreferences> & { organizationId: string },
): Promise<void> {
  const row = preferencesToRow(prefs)
  const { error } = await supabase
    .from('alert_preferences')
    .upsert(row, { onConflict: 'organization_id' })
  if (error) {
    throw new Error(`updateAlertPreferences failed: ${error.message}`)
  }
}
