/**
 * /app/veille — Page d'accueil veille réglementaire.
 *
 * Server component layout 3 colonnes (desktop) :
 *   1. Filtres (sticky)
 *   2. Timeline chronologique
 *   3. Évolutions à venir (effective_at > now)
 *
 * Mobile : stack vertical.
 *
 * Query params : modules, doc_types, importance, date_from, date_to.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { RegulatoryFiltersBar } from '@/components/regulatory/RegulatoryFiltersBar'
import { RegulatoryTimeline } from '@/components/regulatory/RegulatoryTimeline'
import { UpcomingChangesPanel } from '@/components/regulatory/UpcomingChangesPanel'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  ALL_DOC_TYPES,
  ALL_IMPORTANCES,
  ALL_MODULES,
  type RegulatoryDocType,
  type RegulatoryDocumentListItem,
  type RegulatoryImportance,
  type RegulatoryModule,
} from '@/lib/regulatory/types'
import { Sparkles } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Veille réglementaire',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  searchParams: Promise<{
    modules?: string
    doc_types?: string
    importance?: string
    date_from?: string
    date_to?: string
  }>
}

interface RawDocRow {
  id: string
  doc_type: string
  title: string
  url: string
  published_at: string | null
  effective_at: string | null
  ai_summary: string | null
  topics: string[] | null
  diagnostic_kinds: string[] | null
  importance: string
  is_superseded: boolean
  processed_at: string | null
  regulatory_sources:
    | { id: string; name: string; authority: string }
    | { id: string; name: string; authority: string }[]
    | null
}

interface DocsQueryBuilder {
  select: (cols: string) => DocsQueryBuilder
  eq: (col: string, val: string | boolean) => DocsQueryBuilder
  in: (col: string, vals: string[]) => DocsQueryBuilder
  overlaps: (col: string, vals: string[]) => DocsQueryBuilder
  not: (col: string, op: string, val: null) => DocsQueryBuilder
  gte: (col: string, val: string) => DocsQueryBuilder
  lte: (col: string, val: string) => DocsQueryBuilder
  gt: (col: string, val: string) => DocsQueryBuilder
  order: (col: string, opts: { ascending: boolean; nullsFirst?: boolean }) => DocsQueryBuilder
  limit: (n: number) => Promise<{ data: RawDocRow[] | null; error: { message: string } | null }>
}

function parseList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function unwrapSource(
  value:
    | { id: string; name: string; authority: string }
    | { id: string; name: string; authority: string }[]
    | null,
): { id: string; name: string; authority: string } | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function mapRow(r: RawDocRow): RegulatoryDocumentListItem {
  return {
    id: r.id,
    doc_type: r.doc_type as RegulatoryDocType,
    title: r.title,
    url: r.url,
    published_at: r.published_at,
    effective_at: r.effective_at,
    ai_summary: r.ai_summary,
    topics: r.topics ?? [],
    diagnostic_kinds: r.diagnostic_kinds ?? [],
    importance: r.importance as RegulatoryImportance,
    is_superseded: r.is_superseded,
    processed_at: r.processed_at,
    source: unwrapSource(r.regulatory_sources),
  }
}

export default async function VeillePage({ searchParams }: PageProps) {
  const sp = await searchParams
  const { supabase, user } = await getCurrentUser()

  const modulesParam = parseList(sp.modules).filter((v): v is RegulatoryModule =>
    (ALL_MODULES as string[]).includes(v),
  )
  const docTypesParam = parseList(sp.doc_types).filter((v): v is RegulatoryDocType =>
    (ALL_DOC_TYPES as string[]).includes(v),
  )
  const importanceParam = parseList(sp.importance).filter((v): v is RegulatoryImportance =>
    (ALL_IMPORTANCES as string[]).includes(v),
  )

  // ── 1. Timeline principale ────────────────────────────────
  let timelineQb = (supabase.from('regulatory_documents') as unknown as DocsQueryBuilder)
    .select(
      'id, doc_type, title, url, published_at, effective_at, ai_summary, topics, diagnostic_kinds, importance, is_superseded, processed_at, regulatory_sources:regulatory_sources!source_id ( id, name, authority )',
    )
    .eq('is_superseded', false)
    .not('processed_at', 'is', null)
  if (modulesParam.length > 0) timelineQb = timelineQb.overlaps('topics', modulesParam)
  if (docTypesParam.length > 0) timelineQb = timelineQb.in('doc_type', docTypesParam)
  if (importanceParam.length > 0) timelineQb = timelineQb.in('importance', importanceParam)
  if (sp.date_from) timelineQb = timelineQb.gte('published_at', sp.date_from)
  if (sp.date_to) timelineQb = timelineQb.lte('published_at', `${sp.date_to}T23:59:59`)
  timelineQb = timelineQb.order('published_at', { ascending: false, nullsFirst: false })
  const { data: timelineRaw } = await timelineQb.limit(30)
  const timelineItems = (timelineRaw ?? []).map(mapRow)

  // ── 2. Évolutions à venir (effective_at futur) ───────────
  const nowIso = new Date().toISOString().slice(0, 10)
  let upcomingQb = (supabase.from('regulatory_documents') as unknown as DocsQueryBuilder)
    .select(
      'id, doc_type, title, url, published_at, effective_at, ai_summary, topics, diagnostic_kinds, importance, is_superseded, processed_at, regulatory_sources:regulatory_sources!source_id ( id, name, authority )',
    )
    .eq('is_superseded', false)
    .not('processed_at', 'is', null)
    .gt('effective_at', nowIso)
  upcomingQb = upcomingQb.order('effective_at', { ascending: true, nullsFirst: false })
  const { data: upcomingRaw } = await upcomingQb.limit(6)
  const upcomingItems = (upcomingRaw ?? []).map(mapRow)

  // ── 3. Set des doc_id non lus pour le user ───────────────
  const { data: unreadRaw } = await supabase
    .from('regulatory_notifications')
    .select('document_id')
    .eq('user_id', user.id)
    .is('read_at', null)
    .is('dismissed_at', null)
  const unreadDocIds = new Set<string>(
    ((unreadRaw ?? []) as Array<{ document_id: string }>).map((r) => r.document_id),
  )

  const initialFilters = {
    modules: modulesParam,
    docTypes: docTypesParam,
    importance: importanceParam,
    dateFrom: sp.date_from ?? '',
    dateTo: sp.date_to ?? '',
  }

  return (
    <div className="space-y-7 max-w-7xl mx-auto w-full">
      {/* Header — V5 sobre AppPageHeader */}
      <AppPageHeader
        eyebrow="Veille réglementaire"
        title="Reste"
        accent="à jour"
        description="Arrêtés, décrets, guides ADEME et FAQ Cofrac — résumés par l'IA KOVAS."
        action={
          <Button asChild variant="accent" size="default">
            <Link href="/dashboard/veille/chat" className="inline-flex items-center gap-2">
              <Sparkles className="size-4" />
              Poser une question
            </Link>
          </Button>
        }
      />

      {/* Grille 3 colonnes desktop / stack vertical mobile */}
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <RegulatoryFiltersBar initial={initialFilters} />

        <section aria-label="Documents récents" className="min-w-0">
          <RegulatoryTimeline
            items={timelineItems}
            unreadDocIds={unreadDocIds}
            emptyMessage="Aucune évolution réglementaire pour tes critères. La veille tourne chaque nuit à 01:00 UTC — tout nouveau document détecté sera ajouté automatiquement."
          />
        </section>

        <UpcomingChangesPanel items={upcomingItems} />
      </div>
    </div>
  )
}
