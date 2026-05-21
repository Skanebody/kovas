/**
 * /app/communaute/[caseId] — détail d'un cas communautaire.
 */

import { CaseResponses } from '@/components/community/CaseResponses'
import { CaseVoteButtons } from '@/components/community/CaseVoteButtons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  COMMUNITY_BUILDING_TYPE_LABELS,
  COMMUNITY_DIAGNOSTIC_LABELS,
  COMMUNITY_YEAR_RANGE_LABELS,
  type CommunityCaseResponseRow,
  type CommunityCaseRow,
  authorPseudonym,
  isExpertValidated,
} from '@/lib/community/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowLeft, BadgeCheck, MessagesSquare } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: 'Détail du cas' }

interface PageProps {
  params: Promise<{ caseId: string }>
}

interface CasesTable {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      single: () => Promise<{
        data: CommunityCaseRow | null
        error: { message: string } | null
      }>
    }
  }
  update: (patch: Record<string, unknown>) => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
}

interface ResponsesTable {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      eq: (
        col: string,
        val: string,
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{
          data: CommunityCaseResponseRow[] | null
          error: { message: string } | null
        }>
      }
    }
  }
}

function casesTable(supabase: SupabaseClient): CasesTable {
  return (supabase as unknown as { from(t: 'community_cases'): CasesTable }).from('community_cases')
}
function responsesTable(supabase: SupabaseClient): ResponsesTable {
  return (supabase as unknown as { from(t: 'community_case_responses'): ResponsesTable }).from(
    'community_case_responses',
  )
}

/** Rendu pseudo-markdown : on respecte les retours à la ligne, paragraphes simples. */
function MarkdownLike({ text }: { text: string }) {
  // Split par double saut de ligne -> paragraphes ; conserve les puces "- ".
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    // Clé stable basée sur (index + signature hash courte du contenu).
    .map((content, position) => ({
      content,
      key: `${position}-${content.slice(0, 20).replace(/\s+/g, '_')}`,
    }))
  return (
    <div className="prose-sm max-w-none space-y-3">
      {blocks.map((block) => {
        const lines = block.content.split('\n')
        const isList = lines.every((l) => l.trim().startsWith('- '))
        if (isList) {
          return (
            <ul
              key={block.key}
              className="list-disc pl-5 space-y-1 text-[13px] text-ink leading-relaxed"
            >
              {lines.map((l) => (
                <li key={`${block.key}-${l.slice(0, 20)}`}>{l.replace(/^\s*-\s+/, '')}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={block.key} className="text-[13px] text-ink leading-relaxed whitespace-pre-wrap">
            {block.content}
          </p>
        )
      })}
    </div>
  )
}

export default async function CommunityCaseDetailPage({ params }: PageProps) {
  const { caseId } = await params
  const { supabase } = await getCurrentUser()

  const { data: row, error } = await casesTable(supabase)
    .select(
      'id, author_user_id, title, building_type, year_built_range, surface_range, diagnostic_kinds, region_anonymised, context_description, question, decision_made, justification, status, upvotes_count, downvotes_count, responses_count, views_count, tags, created_at, updated_at',
    )
    .eq('id', caseId)
    .single()

  if (error || !row || row.status !== 'approved') {
    notFound()
  }

  // Increment views (fire-and-forget côté server).
  await casesTable(supabase)
    .update({ views_count: row.views_count + 1 })
    .eq('id', row.id)

  const { data: responses } = await responsesTable(supabase)
    .select(
      'id, case_id, author_user_id, body, status, upvotes_count, downvotes_count, created_at, updated_at',
    )
    .eq('case_id', row.id)
    .eq('status', 'published')
    .order('created_at', { ascending: true })

  const validated = isExpertValidated(row)
  const decisionText = row.decision_made?.trim() ?? ''
  const justificationText = row.justification?.trim() ?? ''

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/communaute">
            <ArrowLeft className="size-4" />
            Retour à la communauté
          </Link>
        </Button>
        {validated ? (
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-chartreuse/60 bg-chartreuse/15 px-3 py-1 text-[11px] font-semibold text-ink">
            <BadgeCheck className="size-4" />
            Validé par expert
          </span>
        ) : null}
      </div>

      <header className="space-y-3">
        <h1 className="font-sans font-light text-display-m md:text-display-l tracking-tight text-ink leading-[1.05]">
          {row.title}
        </h1>
        <p className="text-[12px] font-mono text-ink-faint">
          {authorPseudonym(row.author_user_id)} ·{' '}
          {new Date(row.created_at).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </header>

      <Card variant="flat" padding="default" className="space-y-4">
        <h2 className="text-[11px] font-mono uppercase tracking-[0.12em] text-ink-mute">
          Contexte
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {row.building_type ? (
            <Badge variant="muted">{COMMUNITY_BUILDING_TYPE_LABELS[row.building_type]}</Badge>
          ) : null}
          {row.year_built_range ? (
            <Badge variant="outline">{COMMUNITY_YEAR_RANGE_LABELS[row.year_built_range]}</Badge>
          ) : null}
          {(row.diagnostic_kinds ?? []).map((k) => (
            <Badge key={k} variant="blue">
              {COMMUNITY_DIAGNOSTIC_LABELS[k]}
            </Badge>
          ))}
        </div>
        <p className="text-[14px] text-ink leading-relaxed whitespace-pre-wrap">
          {row.context_description}
        </p>
      </Card>

      <Card variant="flat" padding="default" className="space-y-3">
        <h2 className="text-[11px] font-mono uppercase tracking-[0.12em] text-ink-mute">
          Question
        </h2>
        <p className="font-serif italic text-[20px] md:text-[22px] text-ink leading-snug">
          {row.question}
        </p>
      </Card>

      {decisionText.length > 0 || justificationText.length > 0 ? (
        <Card variant="flat" padding="default" className="space-y-4">
          <h2 className="text-[11px] font-mono uppercase tracking-[0.12em] text-ink-mute">
            Décision &amp; justification
          </h2>
          {decisionText.length > 0 ? (
            <div>
              <p className="text-[12px] font-semibold text-ink mb-1">Décision prise</p>
              <MarkdownLike text={decisionText} />
            </div>
          ) : null}
          {justificationText.length > 0 ? (
            <div>
              <p className="text-[12px] font-semibold text-ink mb-1">
                Justification &amp; références
              </p>
              <MarkdownLike text={justificationText} />
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <CaseVoteButtons
          caseId={row.id}
          initialUp={row.upvotes_count}
          initialDown={row.downvotes_count}
        />
        <div className="flex items-center gap-4 text-[12px] font-mono text-ink-mute">
          <span>{row.views_count} vues</span>
          <span className="inline-flex items-center gap-1">
            <MessagesSquare className="size-3.5" />
            {row.responses_count} réponses
          </span>
          <Button variant="ghost" size="sm" disabled title="Recherche sémantique — V1.5">
            Cas similaires
          </Button>
        </div>
      </div>

      <CaseResponses caseId={row.id} initialResponses={responses ?? []} />
    </div>
  )
}
