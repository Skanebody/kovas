/**
 * KOVAS — Helpers d'accès aux communiqués de presse dynamiques
 * (Game Changer 5 acqui-target, REFONTE-ACQUI-TARGET-V2 §6.5).
 *
 * Les communiqués dynamiques sont générés mensuellement par l'Edge Function
 * `send-monthly-press-release` (Claude Sonnet 1200-1800 mots) puis revus et
 * publiés manuellement par l'admin.
 *
 * La page publique `/presse` fusionne ces communiqués dynamiques avec les
 * placeholders éditoriaux historiques (`lib/institutional/press-mentions.ts`).
 *
 * Sécurité : RLS expose uniquement `status = 'sent'` et `embargo_until` levé.
 */

import { createClient } from '@/lib/supabase/server'

export interface DynamicPressRelease {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly subtitle: string | null
  readonly dateline: string | null
  readonly category: 'observatoire' | 'milestone' | 'partnership' | 'product_launch' | 'study'
  readonly bodyMarkdown: string
  readonly keyQuotes: ReadonlyArray<{ author: string; role: string; quote: string }>
  readonly keyFigures: ReadonlyArray<{ label: string; value: string; source: string }>
  readonly pdfUrl: string | null
  readonly sentAt: string | null
}

interface PressReleaseRow {
  id: string
  slug: string
  title: string
  subtitle: string | null
  dateline: string | null
  category: DynamicPressRelease['category']
  body_markdown: string
  key_quotes: unknown
  key_figures: unknown
  pdf_url: string | null
  sent_at: string | null
}

interface QuoteRecord {
  author?: string
  role?: string
  quote?: string
}

interface FigureRecord {
  label?: string
  value?: string
  source?: string
}

function isQuoteRecord(value: unknown): value is QuoteRecord {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.author === 'string' && typeof v.quote === 'string'
}

function isFigureRecord(value: unknown): value is FigureRecord {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.label === 'string' && typeof v.value === 'string'
}

function safeQuotes(raw: unknown): DynamicPressRelease['keyQuotes'] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isQuoteRecord).map((q) => ({
    author: q.author ?? 'Benjamin Bel',
    role: q.role ?? 'fondateur de KOVAS',
    quote: q.quote ?? '',
  }))
}

function safeFigures(raw: unknown): DynamicPressRelease['keyFigures'] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isFigureRecord).map((f) => ({
    label: f.label ?? '',
    value: f.value ?? '',
    source: f.source ?? '',
  }))
}

function mapRow(row: PressReleaseRow): DynamicPressRelease {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    dateline: row.dateline,
    category: row.category,
    bodyMarkdown: row.body_markdown,
    keyQuotes: safeQuotes(row.key_quotes),
    keyFigures: safeFigures(row.key_figures),
    pdfUrl: row.pdf_url,
    sentAt: row.sent_at,
  }
}

const SELECT_COLUMNS =
  'id, slug, title, subtitle, dateline, category, body_markdown, key_quotes, key_figures, pdf_url, sent_at'

/**
 * Liste publique des communiqués envoyés (consommé par `/presse`).
 * RLS filtre `status = 'sent'` + `embargo_until <= now()`.
 */
export async function listPublicPressReleases(limit = 24): Promise<DynamicPressRelease[]> {
  const supabase = await createClient()
  // biome-ignore lint/suspicious/noExplicitAny: table press_releases pas encore dans Database.types
  const { data, error } = await (supabase as any)
    .from('press_releases')
    .select(SELECT_COLUMNS)
    .order('sent_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error('listPublicPressReleases error:', error.message)
    return []
  }
  return ((data ?? []) as PressReleaseRow[]).map(mapRow)
}

/**
 * Récupère un communiqué par slug (page détail `/presse/[slug]` future).
 */
export async function getPublicPressReleaseBySlug(
  slug: string,
): Promise<DynamicPressRelease | null> {
  const supabase = await createClient()
  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { data, error } = await (supabase as any)
    .from('press_releases')
    .select(SELECT_COLUMNS)
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error('getPublicPressReleaseBySlug error:', error.message)
    return null
  }
  if (!data) return null
  return mapRow(data as PressReleaseRow)
}

export interface PressMentionsStats {
  readonly totalMentions: number
  readonly uniqueOutlets: number
  readonly totalReleasesSent: number
  readonly activePressContacts: number
  readonly lastMentionAt: string | null
  readonly lastReleaseSentAt: string | null
}

/**
 * Récupère les compteurs presse consolidés via la vue `v_press_mentions_stats`.
 * Fallback à 0 si la vue n'existe pas encore (migration pas appliquée).
 */
export async function getPressMentionsStats(): Promise<PressMentionsStats> {
  const supabase = await createClient()
  // biome-ignore lint/suspicious/noExplicitAny: vue pas dans Database.types
  const { data, error } = await (supabase as any)
    .from('v_press_mentions_stats')
    .select('*')
    .maybeSingle()

  if (error || !data) {
    return {
      totalMentions: 0,
      uniqueOutlets: 0,
      totalReleasesSent: 0,
      activePressContacts: 0,
      lastMentionAt: null,
      lastReleaseSentAt: null,
    }
  }

  const row = data as Record<string, unknown>
  return {
    totalMentions: Number(row.total_mentions ?? 0),
    uniqueOutlets: Number(row.unique_outlets ?? 0),
    totalReleasesSent: Number(row.total_releases_sent ?? 0),
    activePressContacts: Number(row.active_press_contacts ?? 0),
    lastMentionAt: (row.last_mention_at as string | null) ?? null,
    lastReleaseSentAt: (row.last_release_sent_at as string | null) ?? null,
  }
}
