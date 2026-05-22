/**
 * Types partagés du système d'alertes KOVAS.
 */

export type AlertSeverity = 'critical' | 'warning' | 'info'

export type AlertCategory =
  | 'coherence'
  | 'pre_export'
  | 'fraud'
  | 'compliance'
  | 'proactive'
  | 'gamification'
  | 'lead'

/**
 * Finding générique — unité de base manipulée par AlertManager.
 * `id` doit être stable pour dédup / dismiss.
 */
export interface Finding {
  id: string
  type: string
  subtype?: string
  severity: AlertSeverity
  category: AlertCategory
  message: string
  detail?: string
  href?: string
  context?: Record<string, unknown>
  /** Score interne 0-100 pour priorisation lorsqu’on doit consolider. */
  priorityScore?: number
}

export interface AlertPreferences {
  organizationId: string
  fraudDetectionEnabled: boolean
  fraudSensitivity: 'normal' | 'low' | 'very_low'
  preExportEnabled: boolean
  preExportStrictness: 'standard' | 'permissive'
  proactiveSuggestionsMode: 'disabled' | 'checkout_only' | 'in_mission'
  coachAiEnabled: boolean
  coachAiFrequency: 'weekly' | 'monthly' | 'quarterly' | 'disabled'
  leadNotificationsEnabled: boolean
  leadQuietHoursStart: string // 'HH:MM'
  leadQuietHoursEnd: string // 'HH:MM'
  leadWeekendNotifications: boolean
  gamificationEnabled: boolean
  levelNotificationsEnabled: boolean
}

export const DEFAULT_ALERT_PREFERENCES: Omit<AlertPreferences, 'organizationId'> = {
  fraudDetectionEnabled: true,
  fraudSensitivity: 'normal',
  preExportEnabled: true,
  preExportStrictness: 'standard',
  proactiveSuggestionsMode: 'checkout_only',
  coachAiEnabled: false,
  coachAiFrequency: 'weekly',
  leadNotificationsEnabled: true,
  leadQuietHoursStart: '20:00',
  leadQuietHoursEnd: '08:00',
  leadWeekendNotifications: false,
  gamificationEnabled: true,
  levelNotificationsEnabled: true,
}

/** Plafond strict d’alertes affichées simultanément. */
export const MAX_ALERTS_PER_MISSION = 3

/** Seuil d’ignorances consécutives au-delà duquel un type d’alerte est auto-désactivé. */
export const AUTO_DISABLE_THRESHOLD = 5

/** Plafond strict de suggestions proactives par jour et par utilisateur. */
export const MAX_PROACTIVE_SUGGESTIONS_PER_DAY = 1
