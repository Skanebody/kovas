'use client'

/**
 * SeoDraftCard — carte représentant un draft dans le Kanban.
 *
 * Affichage :
 *  - title (truncate 60)
 *  - keyword.display + score
 *  - badge EEAT score /10 (vert ≥7, orange 4-6, rouge <4)
 *  - select pour changer le status
 *  - lien "Voir" vers l'editor /admin/seo/drafts/[id]
 */

import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { SeoDraftStatus, SeoDraftWithKeyword } from './SeoKanbanBoard'

interface SeoDraftCardProps {
  draft: SeoDraftWithKeyword
  onStatusChange: (id: string, status: SeoDraftStatus) => void
  disabled: boolean
}

const STATUS_OPTIONS: readonly { value: SeoDraftStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
  { value: 'rejected', label: 'Rejected' },
]

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1).trimEnd()}…`
}

function eeatBadgeClass(score: number): string {
  if (score >= 7) return 'bg-lime-mist text-[#2D4015]'
  if (score >= 4) return 'bg-orange-mist text-[#7C3F0A]'
  return 'bg-coral-mist text-[#8B1414]'
}

function scoreLabel(score: number | null): string {
  if (score === null || score === undefined) return '—'
  return Math.round(score).toString()
}

export function SeoDraftCard({ draft, onStatusChange, disabled }: SeoDraftCardProps) {
  const eeat = draft.eeatScore ?? 0

  return (
    <div className="rounded-md border border-rule bg-paper px-3 py-2.5 hover:border-ink/30 transition-colors">
      <p className="text-[13px] font-semibold text-ink leading-snug">
        {truncate(draft.title, 60)}
      </p>

      {draft.keyword ? (
        <p className="mt-1 text-[11px] text-ink-mute leading-snug">
          <span className="font-mono uppercase tracking-wider text-[10px] mr-1">KW</span>
          {truncate(draft.keyword.display, 38)}
          {draft.keyword.score !== null ? (
            <span className="ml-1.5 text-ink-faint">· {scoreLabel(draft.keyword.score)}</span>
          ) : null}
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-ink-faint italic">Mot-clé inconnu</p>
      )}

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            'inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-mono font-semibold',
            eeatBadgeClass(eeat),
          )}
        >
          EEAT {eeat}/10
        </span>
        {draft.revisionCount > 0 ? (
          <span className="text-[10px] text-ink-faint font-mono">
            v{draft.revisionCount}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <select
          value={draft.status}
          onChange={(e) => onStatusChange(draft.id, e.target.value as SeoDraftStatus)}
          disabled={disabled}
          aria-label="Changer le statut"
          className="flex-1 text-[11px] rounded-md border border-rule bg-paper px-2 py-1 text-ink focus:outline-none focus:ring-2 focus:ring-ink/15 disabled:opacity-50"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Link
          href={`/admin/seo/drafts/${draft.id}`}
          className="text-[11px] font-semibold text-ink hover:text-navy underline-offset-2 hover:underline"
        >
          Voir
        </Link>
      </div>
    </div>
  )
}
