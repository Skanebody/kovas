/**
 * /app/communaute — référentiel partagé de cas anonymisés.
 *
 * Server component : lit les cas approuvés avec filtres URL.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { CommunityCaseCard } from '@/components/community/CommunityCaseCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  COMMUNITY_BUILDING_TYPES,
  COMMUNITY_BUILDING_TYPE_LABELS,
  COMMUNITY_DIAGNOSTIC_KINDS,
  COMMUNITY_DIAGNOSTIC_LABELS,
  COMMUNITY_YEAR_RANGES,
  COMMUNITY_YEAR_RANGE_LABELS,
  type CommunityBuildingType,
  type CommunityCaseRow,
  type CommunityDiagnosticKind,
  type CommunityYearRange,
} from '@/lib/community/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MessagesSquare, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Communauté' }

interface PageProps {
  searchParams: Promise<{
    q?: string
    buildingType?: string
    yearRange?: string
    diagnostic?: string
    expertOnly?: string
  }>
}

interface CommunityCasesTable {
  select: (cols: string) => {
    eq: (col: string, val: string) => CommunityCasesQueryChain
  }
}

type CommunityCasesQueryChain = {
  eq: (col: string, val: string) => CommunityCasesQueryChain
  in: (col: string, values: readonly string[]) => CommunityCasesQueryChain
  contains: (col: string, values: readonly string[]) => CommunityCasesQueryChain
  or: (filter: string) => CommunityCasesQueryChain
  order: (col: string, opts: { ascending: boolean }) => CommunityCasesQueryChain
  limit: (
    n: number,
  ) => Promise<{ data: CommunityCaseRow[] | null; error: { message: string } | null }>
}

function communityCasesTable(supabase: SupabaseClient): CommunityCasesTable {
  return (supabase as unknown as { from(t: 'community_cases'): CommunityCasesTable }).from(
    'community_cases',
  )
}

const PAGE_LIMIT = 40

export default async function CommunityPage({ searchParams }: PageProps) {
  const { supabase } = await getCurrentUser()
  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const buildingType = (COMMUNITY_BUILDING_TYPES as readonly string[]).includes(
    params.buildingType ?? '',
  )
    ? (params.buildingType as CommunityBuildingType)
    : null
  const yearRange = (COMMUNITY_YEAR_RANGES as readonly string[]).includes(params.yearRange ?? '')
    ? (params.yearRange as CommunityYearRange)
    : null
  const diagnostic = (COMMUNITY_DIAGNOSTIC_KINDS as readonly string[]).includes(
    params.diagnostic ?? '',
  )
    ? (params.diagnostic as CommunityDiagnosticKind)
    : null
  const expertOnly = params.expertOnly === '1'

  let query = communityCasesTable(supabase)
    .select(
      'id, author_user_id, title, building_type, year_built_range, surface_range, diagnostic_kinds, region_anonymised, context_description, question, decision_made, justification, status, upvotes_count, downvotes_count, responses_count, views_count, tags, created_at, updated_at',
    )
    .eq('status', 'approved')

  if (buildingType) query = query.eq('building_type', buildingType)
  if (yearRange) query = query.eq('year_built_range', yearRange)
  if (diagnostic) query = query.contains('diagnostic_kinds', [diagnostic])
  if (expertOnly) query = query.contains('tags', ['expert_validated'])
  if (q.length > 0) {
    const escaped = q.replace(/[%_]/g, ' ').slice(0, 80)
    query = query.or(
      `title.ilike.%${escaped}%,question.ilike.%${escaped}%,context_description.ilike.%${escaped}%`,
    )
  }

  const { data: cases } = await query
    .order('upvotes_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(PAGE_LIMIT)

  const list = cases ?? []

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        title="La"
        accent="communauté"
        description={`${list.length} cas anonymisés partagés par d'autres diagnostiqueurs · entraide métier`}
        action={
          <Button asChild variant="accent">
            <Link href="/app/communaute/nouveau">
              <Plus className="size-4" />
              Partager un cas
            </Link>
          </Button>
        }
      />

      <form
        method="GET"
        className="rounded-2xl border border-rule glass-opaque p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3"
      >
        <Input
          type="search"
          name="q"
          placeholder="Rechercher (titre, question…)"
          defaultValue={q}
          className="md:col-span-2"
        />
        <Select name="diagnostic" defaultValue={diagnostic ?? ''}>
          <option value="">Tous diagnostics</option>
          {COMMUNITY_DIAGNOSTIC_KINDS.map((k) => (
            <option key={k} value={k}>
              {COMMUNITY_DIAGNOSTIC_LABELS[k]}
            </option>
          ))}
        </Select>
        <Select name="buildingType" defaultValue={buildingType ?? ''}>
          <option value="">Tous bâtiments</option>
          {COMMUNITY_BUILDING_TYPES.map((t) => (
            <option key={t} value={t}>
              {COMMUNITY_BUILDING_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select name="yearRange" defaultValue={yearRange ?? ''}>
          <option value="">Toutes époques</option>
          {COMMUNITY_YEAR_RANGES.map((y) => (
            <option key={y} value={y}>
              {COMMUNITY_YEAR_RANGE_LABELS[y]}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-[12px] text-ink-mute md:col-span-3">
          <input
            type="checkbox"
            name="expertOnly"
            value="1"
            defaultChecked={expertOnly}
            className="size-4 rounded border-rule"
          />
          Validé par un expert métier uniquement
        </label>
        <div className="md:col-span-2 flex items-center gap-2 justify-end">
          {(buildingType || yearRange || diagnostic || expertOnly || q.length > 0) && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/communaute">Réinitialiser</Link>
            </Button>
          )}
          <Button type="submit" variant="default" size="sm">
            Filtrer
          </Button>
        </div>
      </form>

      {list.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="Aucun cas ne correspond."
          description="Affinez les filtres ou partagez le premier cas qui matche votre situation."
          action={
            <Button asChild variant="accent">
              <Link href="/app/communaute/nouveau">
                <Plus className="size-4" />
                Partager un cas
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-mono text-ink-faint uppercase tracking-[0.1em]">
              {list.length} cas · triés par votes puis récence
            </p>
            <Badge variant="muted">{PAGE_LIMIT} max par page</Badge>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((c) => (
              <li key={c.id}>
                <CommunityCaseCard row={c} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
