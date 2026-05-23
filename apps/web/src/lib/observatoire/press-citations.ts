/**
 * Helpers d'accès Supabase pour les citations presse de l'Observatoire.
 *
 * FIX-E (2026-05-24) : la section "Des données reprises par la presse
 * nationale" de /observatoire est désormais alimentée par la table
 * `observatoire_press_citations` (migration `20260524100000`).
 *
 * Sécurité : RLS expose publiquement uniquement `status = 'verified'`.
 * Les helpers admin contournent via le client service-role.
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import { createClient } from '@/lib/supabase/server'

export type PressCitationStatus = 'pending_review' | 'verified' | 'rejected'

export interface PressCitation {
  readonly id: string
  readonly mediaSlug: string
  readonly articleUrl: string
  readonly articleTitle: string
  readonly quoteExcerpt: string
  readonly author: string | null
  readonly publishedAt: string
  readonly status: PressCitationStatus
  readonly displayOrder: number
  readonly clickCount: number
  readonly verifiedBy: string | null
  readonly verifiedAt: string | null
  readonly rejectionReason: string | null
}

interface PressCitationRow {
  id: string
  media_slug: string
  article_url: string
  article_title: string
  quote_excerpt: string
  author: string | null
  published_at: string
  status: PressCitationStatus
  display_order: number
  click_count: number
  verified_by: string | null
  verified_at: string | null
  rejection_reason: string | null
}

function mapRow(row: PressCitationRow): PressCitation {
  return {
    id: row.id,
    mediaSlug: row.media_slug,
    articleUrl: row.article_url,
    articleTitle: row.article_title,
    quoteExcerpt: row.quote_excerpt,
    author: row.author,
    publishedAt: row.published_at,
    status: row.status,
    displayOrder: row.display_order,
    clickCount: row.click_count,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    rejectionReason: row.rejection_reason,
  }
}

const SELECT_COLUMNS =
  'id, media_slug, article_url, article_title, quote_excerpt, author, published_at, status, display_order, click_count, verified_by, verified_at, rejection_reason'

/**
 * Liste publique des citations vérifiées (utilisé par `/observatoire`).
 * RLS s'occupe du filtre `status = 'verified'`.
 */
export async function listPublicPressCitations(): Promise<PressCitation[]> {
  const supabase = await createClient()
  // biome-ignore lint/suspicious/noExplicitAny: table pas encore dans Database.types
  const { data, error } = await (supabase as any)
    .from('observatoire_press_citations')
    .select(SELECT_COLUMNS)
    .order('display_order', { ascending: true })
    .order('published_at', { ascending: false })

  if (error) {
    console.error('listPublicPressCitations error:', error.message)
    return []
  }
  return ((data ?? []) as PressCitationRow[]).map(mapRow)
}

/**
 * Récupère une citation par id (utilisé par `/observatoire/citation/[id]`).
 * Filtre `status = 'verified'` côté RLS pour la page publique.
 */
export async function getPublicPressCitation(id: string): Promise<PressCitation | null> {
  const supabase = await createClient()
  // biome-ignore lint/suspicious/noExplicitAny: table pas encore dans Database.types
  const { data, error } = await (supabase as any)
    .from('observatoire_press_citations')
    .select(SELECT_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('getPublicPressCitation error:', error.message)
    return null
  }
  if (!data) return null
  return mapRow(data as PressCitationRow)
}

/**
 * Liste admin : toutes les citations (tous statuts), pour la page de
 * modération `/admin/observatoire/citations/[id]`.
 */
export async function listAllPressCitationsAdmin(): Promise<PressCitation[]> {
  const supabase = createAdminClient()
  // biome-ignore lint/suspicious/noExplicitAny: table pas encore dans Database.types
  const { data, error } = await (supabase as any)
    .from('observatoire_press_citations')
    .select(SELECT_COLUMNS)
    .order('status', { ascending: true })
    .order('display_order', { ascending: true })

  if (error) {
    console.error('listAllPressCitationsAdmin error:', error.message)
    return []
  }
  return ((data ?? []) as PressCitationRow[]).map(mapRow)
}

/**
 * Récupère une citation côté admin (sans filtre RLS — voit tous statuts).
 */
export async function getPressCitationAdmin(id: string): Promise<PressCitation | null> {
  const supabase = createAdminClient()
  // biome-ignore lint/suspicious/noExplicitAny: table pas encore dans Database.types
  const { data, error } = await (supabase as any)
    .from('observatoire_press_citations')
    .select(SELECT_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('getPressCitationAdmin error:', error.message)
    return null
  }
  if (!data) return null
  return mapRow(data as PressCitationRow)
}
