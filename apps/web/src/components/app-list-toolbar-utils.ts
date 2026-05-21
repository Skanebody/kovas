/**
 * AppListToolbar — Helpers côté serveur extraits du composant client pour
 * pouvoir être importés depuis les `page.tsx` server components sans
 * franchir la frontière client/server (Next 15 strict).
 *
 * Le composant `<AppListToolbar>` reste dans `app-list-toolbar.tsx` avec
 * `'use client'`. Il re-exporte ces helpers pour rétro-compat des imports
 * legacy mais les server components doivent importer depuis ce fichier-ci.
 */

export const SEARCH_PARAM = 'q'
export const PAGE_PARAM = 'page'

export interface ParsedListParams<TFilterKey extends string = string> {
  q: string
  page: number
  pageSize: number
  offset: number
  filters: Record<TFilterKey, string | string[]>
}

/**
 * Parse un searchParams brut Next 15 en valeurs utiles pour pages liste.
 * À utiliser dans les `page.tsx` server components.
 */
export function parseListSearchParams<TFilterKey extends string = string>(
  raw: Record<string, string | string[] | undefined>,
  options: { pageSize?: number; filterKeys?: readonly TFilterKey[] } = {},
): ParsedListParams<TFilterKey> {
  const pageSize = options.pageSize ?? 25
  const qRaw = raw[SEARCH_PARAM]
  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw) ?? ''
  const pageRaw = raw[PAGE_PARAM]
  const pageVal = Array.isArray(pageRaw) ? pageRaw[0] : pageRaw
  const parsedPage = Number.parseInt(pageVal ?? '1', 10)
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const filters = {} as Record<TFilterKey, string | string[]>
  for (const key of options.filterKeys ?? []) {
    const v = raw[key]
    if (v !== undefined) filters[key] = v
  }

  return {
    q: q.trim(),
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    filters,
  }
}
