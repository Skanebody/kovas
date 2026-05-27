/**
 * <CommunityCaseCard> — carte d'aperçu d'un cas communautaire.
 *
 * Pattern : design system v5 sage / dark / chartreuse,
 *   - Card flat opaque, border rule
 *   - Title Urbanist semibold 16-18
 *   - Badges Pastels catégoriels selon diagnostic_kinds
 *   - Compteurs upvotes / responses / views (font-mono tabular-nums)
 *   - Badge "Validé par expert" chartreuse glow si applicable
 *
 * Sert à la fois en liste (/app/communaute) et en suggestions (futur).
 */

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  COMMUNITY_BUILDING_TYPE_LABELS,
  COMMUNITY_DIAGNOSTIC_LABELS,
  COMMUNITY_YEAR_RANGE_LABELS,
  type CommunityCaseRow,
  authorPseudonym,
  isExpertValidated,
  netVotes,
} from '@/lib/community/types'
import { cn } from '@/lib/utils'
import { ArrowBigDown, ArrowBigUp, BadgeCheck, Eye, MessageSquare } from 'lucide-react'

interface Props {
  row: CommunityCaseRow
  className?: string
}

export function CommunityCaseCard({ row, className }: Props) {
  const validated = isExpertValidated(row)
  const net = netVotes(row)
  const decision = row.decision_made?.trim() ?? ''

  return (
    <Card
      variant="flat"
      padding="default"
      className={cn(
        'group transition-shadow hover:shadow-glass-sm relative',
        validated && 'ring-1 ring-chartreuse/50 shadow-[0_4px_20px_rgba(212,245,66,0.18)]',
        className,
      )}
    >
      {/*
        Communauté = feature V2 — la page détail /dashboard/communaute/[id] n'existe
        pas en V1. Le Link wrapper est retiré jusqu'à réactivation de la section.
      */}

      <div className="relative z-10 space-y-3">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-sans font-semibold text-[15px] md:text-[16px] leading-snug text-ink">
            {row.title}
          </h3>
          {validated ? (
            <span
              className="inline-flex items-center gap-1 rounded-pill border border-chartreuse/60 bg-chartreuse/15 px-2 py-0.5 text-[10px] font-semibold text-ink"
              title="Cas validé par un expert métier"
            >
              <BadgeCheck className="size-3.5" />
              Validé par expert
            </span>
          ) : null}
        </header>

        <div className="flex flex-wrap items-center gap-1.5">
          {row.building_type ? (
            <Badge variant="muted">{COMMUNITY_BUILDING_TYPE_LABELS[row.building_type]}</Badge>
          ) : null}
          {row.year_built_range ? (
            <Badge variant="outline">{COMMUNITY_YEAR_RANGE_LABELS[row.year_built_range]}</Badge>
          ) : null}
          {(row.diagnostic_kinds ?? []).slice(0, 3).map((k) => (
            <Badge key={k} variant="blue">
              {COMMUNITY_DIAGNOSTIC_LABELS[k]}
            </Badge>
          ))}
          {(row.diagnostic_kinds?.length ?? 0) > 3 ? (
            <Badge variant="outline">+{(row.diagnostic_kinds?.length ?? 0) - 3}</Badge>
          ) : null}
        </div>

        <p className="text-[13px] text-ink-mute leading-relaxed line-clamp-2">{row.question}</p>

        {decision.length > 0 ? (
          <p className="text-[12px] text-ink-faint leading-relaxed line-clamp-3 italic">
            &laquo; {decision} &raquo;
          </p>
        ) : null}

        <footer className="flex items-center justify-between gap-2 pt-2 border-t border-rule/40">
          <p className="text-[11px] text-ink-faint font-mono">
            {authorPseudonym(row.author_user_id)}
          </p>
          <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-ink-mute">
            <span className="inline-flex items-center gap-1">
              <ArrowBigUp className="size-3.5 text-accent-green" />
              {row.upvotes_count}
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowBigDown className="size-3.5 text-accent-red" />
              {row.downvotes_count}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold',
                net > 0 && 'text-accent-green',
                net < 0 && 'text-accent-red',
                net === 0 && 'text-ink-faint',
              )}
              title="Score net (upvotes - downvotes)"
            >
              {net > 0 ? '+' : ''}
              {net}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3.5" />
              {row.responses_count}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" />
              {row.views_count}
            </span>
          </div>
        </footer>
      </div>
    </Card>
  )
}
