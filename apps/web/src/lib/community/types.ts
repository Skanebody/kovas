/**
 * Types partagés pour le module Communauté KOVAS (référentiel cas anonymisés).
 *
 * Source : migrations
 *   - 20260525170000_community_cases.sql
 *   - 20260525171000_community_votes_responses.sql
 *
 * Les types DB générés n'incluent pas encore ces tables ; on définit
 * les contrats TypeScript localement pour rester strict.
 */

export const COMMUNITY_BUILDING_TYPES = [
  'maison',
  'appartement',
  'immeuble',
  'local_commercial',
  'bureau',
  'autre',
] as const
export type CommunityBuildingType = (typeof COMMUNITY_BUILDING_TYPES)[number]

export const COMMUNITY_BUILDING_TYPE_LABELS: Record<CommunityBuildingType, string> = {
  maison: 'Maison',
  appartement: 'Appartement',
  immeuble: 'Immeuble',
  local_commercial: 'Local commercial',
  bureau: 'Bureau',
  autre: 'Autre',
}

export const COMMUNITY_YEAR_RANGES = [
  '<1949',
  '1949-1974',
  '1975-1990',
  '1991-2005',
  '>2005',
] as const
export type CommunityYearRange = (typeof COMMUNITY_YEAR_RANGES)[number]

export const COMMUNITY_YEAR_RANGE_LABELS: Record<CommunityYearRange, string> = {
  '<1949': 'Avant 1949',
  '1949-1974': '1949 – 1974',
  '1975-1990': '1975 – 1990',
  '1991-2005': '1991 – 2005',
  '>2005': 'Après 2005',
}

export const COMMUNITY_SURFACE_RANGES = ['<50', '50-80', '80-120', '120-200', '>200'] as const
export type CommunitySurfaceRange = (typeof COMMUNITY_SURFACE_RANGES)[number]

export const COMMUNITY_SURFACE_RANGE_LABELS: Record<CommunitySurfaceRange, string> = {
  '<50': '< 50 m²',
  '50-80': '50 – 80 m²',
  '80-120': '80 – 120 m²',
  '120-200': '120 – 200 m²',
  '>200': '> 200 m²',
}

export const COMMUNITY_DIAGNOSTIC_KINDS = [
  'dpe',
  'amiante',
  'plomb',
  'gaz',
  'elec',
  'termites',
  'carrez',
  'erp',
] as const
export type CommunityDiagnosticKind = (typeof COMMUNITY_DIAGNOSTIC_KINDS)[number]

export const COMMUNITY_DIAGNOSTIC_LABELS: Record<CommunityDiagnosticKind, string> = {
  dpe: 'DPE',
  amiante: 'Amiante',
  plomb: 'Plomb',
  gaz: 'Gaz',
  elec: 'Électricité',
  termites: 'Termites',
  carrez: 'Carrez / Boutin',
  erp: 'ERP',
}

export type CommunityCaseStatus = 'pending' | 'approved' | 'rejected' | 'archived'

export interface CommunityCaseRow {
  id: string
  author_user_id: string | null
  title: string
  building_type: CommunityBuildingType | null
  year_built_range: CommunityYearRange | null
  surface_range: CommunitySurfaceRange | null
  diagnostic_kinds: CommunityDiagnosticKind[] | null
  region_anonymised: string | null
  context_description: string
  question: string
  decision_made: string | null
  justification: string | null
  status: CommunityCaseStatus
  upvotes_count: number
  downvotes_count: number
  responses_count: number
  views_count: number
  tags: string[] | null
  /** "Validé par expert" — clé tag "expert_validated" (ou metadata si ajouté ultérieurement). */
  created_at: string
  updated_at: string
}

/**
 * Le tag "expert_validated" sur un cas signale une validation par un membre
 * de la communauté disposant du flag interne expert. La logique est codifiée
 * ici côté UI pour éviter d'ajouter une colonne dédiée tant que la modération
 * fonctionne par tags admins.
 */
export const COMMUNITY_EXPERT_TAG = 'expert_validated'

export function isExpertValidated(c: Pick<CommunityCaseRow, 'tags'>): boolean {
  return !!c.tags?.includes(COMMUNITY_EXPERT_TAG)
}

export function netVotes(c: Pick<CommunityCaseRow, 'upvotes_count' | 'downvotes_count'>): number {
  return c.upvotes_count - c.downvotes_count
}

/** Anonymisation d'auteur côté UI : "Diagnostiqueur #abcd" (4 premiers hex). */
export function authorPseudonym(authorUserId: string | null): string {
  if (!authorUserId) return 'Diagnostiqueur anonyme'
  const compact = authorUserId.replace(/-/g, '')
  const short = compact.slice(0, 4)
  return `Diagnostiqueur #${short}`
}

export interface CommunityCaseResponseRow {
  id: string
  case_id: string
  author_user_id: string | null
  body: string
  status: 'published' | 'flagged' | 'hidden' | 'deleted'
  upvotes_count: number
  downvotes_count: number
  created_at: string
  updated_at: string
}

export interface CommunityCaseVoteRow {
  id: string
  case_id: string
  user_id: string
  value: -1 | 1
  created_at: string
  updated_at: string
}
