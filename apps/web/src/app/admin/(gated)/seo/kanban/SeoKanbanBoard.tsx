'use client'

/**
 * SeoKanbanBoard — vue Kanban du pipeline éditorial SEO.
 *
 * 5 colonnes (Draft, Review, Approved, Published, Archived) — le statut
 * `rejected` est traité comme variante d'`archived` (regroupé visuellement).
 *
 * Changement de statut via <select> simple (pas de dnd-kit installé).
 *
 * Bouton "Générer 5 nouveaux drafts" : invoque l'action `generateSeoDrafts(5)`
 * qui appelle l'Edge Function `seo-generate-draft`.
 *
 * Pattern v5 Synthex : background sage hérité du layout, cards opaques avec
 * accent chartreuse sur le CTA principal.
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Newspaper, Sparkles } from 'lucide-react'
import { useState, useTransition } from 'react'
import { generateSeoDrafts, updateDraftStatus } from '../actions'
import { SeoDraftCard } from './SeoDraftCard'

export type SeoDraftStatus = 'draft' | 'review' | 'approved' | 'published' | 'archived' | 'rejected'

export interface SeoDraftWithKeyword {
  id: string
  title: string
  slug: string | null
  status: SeoDraftStatus
  eeatScore: number | null
  eeatValidations: Record<string, boolean> | null
  assignedTo: string | null
  revisionCount: number
  updatedAt: string | null
  keyword: {
    id: string
    display: string
    score: number | null
    category: string | null
  } | null
}

interface Column {
  status: SeoDraftStatus
  label: string
  description: string
}

const COLUMNS: readonly Column[] = [
  { status: 'draft', label: 'Draft', description: 'Brouillons IA initiaux' },
  { status: 'review', label: 'Review', description: 'En relecture humaine' },
  { status: 'approved', label: 'Approved', description: 'Prêts à publier' },
  { status: 'published', label: 'Published', description: 'En ligne' },
  { status: 'archived', label: 'Archived', description: 'Archivés / rejetés' },
]

function groupByStatus(
  drafts: SeoDraftWithKeyword[],
): Record<SeoDraftStatus, SeoDraftWithKeyword[]> {
  const groups: Record<SeoDraftStatus, SeoDraftWithKeyword[]> = {
    draft: [],
    review: [],
    approved: [],
    published: [],
    archived: [],
    rejected: [],
  }
  for (const d of drafts) {
    groups[d.status]?.push(d)
  }
  return groups
}

interface SeoKanbanBoardProps {
  initialDrafts: SeoDraftWithKeyword[]
}

export function SeoKanbanBoard({ initialDrafts }: SeoKanbanBoardProps) {
  const [drafts, setDrafts] = useState<SeoDraftWithKeyword[]>(initialDrafts)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const grouped = groupByStatus(drafts)

  function handleStatusChange(draftId: string, newStatus: SeoDraftStatus) {
    setDrafts((prev) => prev.map((d) => (d.id === draftId ? { ...d, status: newStatus } : d)))
    startTransition(async () => {
      try {
        await updateDraftStatus(draftId, newStatus)
        setFeedback({ kind: 'ok', text: 'Statut mis à jour.' })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur inconnue'
        setFeedback({ kind: 'error', text: msg })
        // Rollback optimiste : on retire l'item (re-fetch utilisateur)
      }
    })
  }

  function handleGenerate() {
    startTransition(async () => {
      setFeedback(null)
      try {
        const result = await generateSeoDrafts(5)
        if (!result.ok) {
          setFeedback({
            kind: 'error',
            text: `Génération échouée : ${result.error ?? 'erreur inconnue'}`,
          })
          return
        }
        const successCount = result.drafts.filter((d) => d.status === 'draft').length
        setFeedback({
          kind: 'ok',
          text: `${successCount} draft(s) généré(s). Coût : ${result.totalCost.toFixed(4)} €. Rechargez la page pour les voir.`,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur inconnue'
        setFeedback({ kind: 'error', text: msg })
      }
    })
  }

  // Combine archived + rejected dans la dernière colonne
  const archivedGroup = [...grouped.archived, ...grouped.rejected]

  return (
    <div className="space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Newspaper className="size-5 text-ink-mute" aria-hidden />
            <h1 className="text-2xl font-display font-semibold text-ink tracking-tight">
              Pipeline SEO
            </h1>
          </div>
          <p className="text-sm text-ink-mute max-w-2xl">
            Kanban des drafts éditoriaux générés par Claude Sonnet sur les mots-clés top-scorés.
            Validation EEAT obligatoire avant publication.
          </p>
        </div>
        <Button variant="accent" onClick={handleGenerate} disabled={isPending} className="shrink-0">
          <Sparkles className="size-4" aria-hidden />
          {isPending ? 'Génération…' : 'Générer 5 nouveaux drafts'}
        </Button>
      </div>

      {/* Feedback */}
      {feedback ? (
        <div
          className={
            feedback.kind === 'ok'
              ? 'rounded-md border border-rule bg-paper px-4 py-3 text-sm text-ink'
              : 'rounded-md border border-danger/40 bg-coral-mist px-4 py-3 text-sm text-[#8B1414]'
          }
          role="status"
        >
          {feedback.text}
        </div>
      ) : null}

      {/* Board — scroll horizontal sur petits écrans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {COLUMNS.map((col) => {
          const items = col.status === 'archived' ? archivedGroup : grouped[col.status]
          return (
            <KanbanColumn
              key={col.status}
              column={col}
              items={items}
              onStatusChange={handleStatusChange}
              isPending={isPending}
            />
          )
        })}
      </div>
    </div>
  )
}

interface KanbanColumnProps {
  column: Column
  items: SeoDraftWithKeyword[]
  onStatusChange: (id: string, status: SeoDraftStatus) => void
  isPending: boolean
}

function KanbanColumn({ column, items, onStatusChange, isPending }: KanbanColumnProps) {
  return (
    <Card variant="opaque" padding="sm" className="flex flex-col gap-3 min-h-[200px]">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          {column.label}
        </p>
        <span className="font-mono text-[11px] text-ink-faint">{items.length}</span>
      </div>
      <p className="text-[11px] text-ink-faint -mt-2">{column.description}</p>

      <div className="flex flex-col gap-2.5 mt-1">
        {items.length === 0 ? (
          <p className="text-[12px] text-ink-faint italic py-4 text-center">Aucun draft</p>
        ) : (
          items.map((d) => (
            <SeoDraftCard
              key={d.id}
              draft={d}
              onStatusChange={onStatusChange}
              disabled={isPending}
            />
          ))
        )}
      </div>
    </Card>
  )
}
