/**
 * Types partagés Prescripteurs (CRM relations agence/notaire/syndic).
 * Source : 20260525153000_prescriber_relationships.sql + 20260525150000_quotes_contacts.sql
 */

export const PRESCRIBER_TIERS = ['platinum', 'gold', 'silver', 'bronze'] as const
export type PrescriberTier = (typeof PRESCRIBER_TIERS)[number]

export const PRESCRIBER_TIER_LABELS: Record<PrescriberTier, string> = {
  platinum: 'Platine',
  gold: 'Or',
  silver: 'Argent',
  bronze: 'Bronze',
}

/** Tailwind classes pour les badges tiers (sage / dark / chartreuse compatible). */
export const PRESCRIBER_TIER_BADGE_CLASS: Record<PrescriberTier, string> = {
  platinum: 'bg-navy/10 text-navy border-navy/30',
  gold: 'bg-orange-mist text-[#7C3F0A] border-amber/30',
  silver: 'bg-cream-deep text-ink-mute border-rule',
  bronze: 'bg-paper text-ink-faint border-rule/60',
}

export type ContactKind = 'client' | 'prescriber' | 'supplier'

export interface PrescriberContact {
  id: string
  display_name: string
  kind: ContactKind
  email: string | null
  phone: string | null
  company_name: string | null
}

export interface PrescriberRelationshipRow {
  id: string
  organization_id: string
  contact_id: string
  user_id: string | null
  tier: PrescriberTier
  revenue_12m_eur: number
  missions_12m_count: number
  acceptance_rate: number | null
  avg_basket_eur: number | null
  last_mission_at: string | null
  last_contact_at: string | null
  silent_since_days: number | null
  notes: string | null
  next_action_at: string | null
  next_action_type: string | null
  created_at: string
  updated_at: string
}

export interface PrescriberRowWithContact extends PrescriberRelationshipRow {
  contact: PrescriberContact | null
}

export const PRESCRIBER_SILENT_THRESHOLD_DAYS = 30

export function isSilent(row: Pick<PrescriberRelationshipRow, 'silent_since_days'>): boolean {
  return (row.silent_since_days ?? 0) > PRESCRIBER_SILENT_THRESHOLD_DAYS
}

export function prescriberTypeLabel(kind: string | null): string {
  switch (kind) {
    case 'agence':
      return 'Agence immobilière'
    case 'notaire':
      return 'Notaire'
    case 'syndic':
      return 'Syndic'
    case 'prescriber':
      return 'Prescripteur'
    default:
      return kind ?? 'Inconnu'
  }
}
