/**
 * Types partagés pour broadcasts admin (envois emails de masse) et email templates.
 *
 * Tables broadcast_history + email_templates absentes du Database type généré
 * (migration 2026-05-21) — types locaux jusqu'à `pnpm db:gen-types`.
 */

export type BroadcastStatus = 'draft' | 'sending' | 'sent' | 'failed' | 'cancelled'

export type BroadcastAudiencePlan =
  | 'all'
  | 'decouverte'
  | 'standard'
  | 'volume'
  | 'founder'
  | 'cabinet'

export type BroadcastAudienceStatus = 'all' | 'active' | 'trialing' | 'cancelled'

export type BroadcastCustomSegment =
  | 'top_ai_consumers'
  | 'no_mission_30d'
  | 'past_due'
  | 'recent_signup_7d'

export interface BroadcastAudienceFilter {
  plans: BroadcastAudiencePlan[]
  statuses: BroadcastAudienceStatus[]
  custom_segments: BroadcastCustomSegment[]
}

export interface BroadcastHistoryRow {
  id: string
  subject: string
  body_html: string
  body_text: string | null
  audience_filter: BroadcastAudienceFilter
  recipients_count: number
  status: BroadcastStatus
  sent_at: string | null
  delivered_count: number
  opened_count: number
  clicked_count: number
  error_count: number
  created_at: string
  created_by: string
}

export interface EmailTemplateRow {
  id: string
  key: string
  name: string
  subject: string
  body_html: string
  body_text: string | null
  variables: string[]
  active: boolean
  created_at: string
  updated_at: string
}

export interface EmailTemplateInsert {
  key: string
  name: string
  subject: string
  body_html: string
  body_text?: string | null
  variables?: string[]
  active?: boolean
}

export interface EmailTemplateUpdate {
  name?: string
  subject?: string
  body_html?: string
  body_text?: string | null
  variables?: string[]
  active?: boolean
}

export const BROADCAST_CONFIRM_THRESHOLD = 50
export const BROADCAST_MAX_RECIPIENTS = 100
