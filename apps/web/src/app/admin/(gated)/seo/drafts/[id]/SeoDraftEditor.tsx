'use client'

/**
 * SeoDraftEditor — éditeur du markdown + boutons d'action.
 *
 * TipTap n'est pas installé (sortie de scope D4). Fallback `<textarea>` avec
 * police monospace et recompute EEAT à chaque keystroke.
 * TODO: installer @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-image
 *       @tiptap/extension-link + lib `marked` puis remplacer la textarea.
 *
 * Actions :
 *  - Sauvegarder : saveDraft(id, content) → INSERT version + UPDATE seo_drafts
 *  - Soumettre review : updateDraftStatus(id, 'review')
 *  - Approuver : updateDraftStatus(id, 'approved')
 *  - Publier : publishDraft(id) → status=published + INSERT seo_publications
 *  - Rejeter : updateDraftStatus(id, 'rejected')
 *
 * Layout : éditeur 2/3 + sidebar EEAT validator 1/3.
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useMemo, useState, useTransition } from 'react'
import { publishDraft, saveDraft, updateDraftStatus } from '../../actions'
import {
  type EeatValidations,
  type SeoDraftStatus,
  computeEeatScore,
  computeEeatValidations,
} from '../../eeat'
import { EeatValidator } from './EeatValidator'

export interface SeoDraftEditorPayload {
  id: string
  title: string
  slug: string | null
  metaDescription: string | null
  contentMarkdown: string
  status: SeoDraftStatus
  eeatScore: number | null
  eeatValidations: Record<string, boolean> | null
  revisionCount: number
  publishedUrl: string | null
  keyword: {
    id: string
    display: string
    category: string | null
    geoScope: string | null
    score: number | null
  } | null
  updatedAt: string | null
}

interface SeoDraftEditorProps {
  initialDraft: SeoDraftEditorPayload
}

type Feedback = { kind: 'ok' | 'error'; text: string } | null

export function SeoDraftEditor({ initialDraft }: SeoDraftEditorProps) {
  const [content, setContent] = useState<string>(initialDraft.contentMarkdown)
  const [status, setStatus] = useState<SeoDraftStatus>(initialDraft.status)
  const [revisionCount, setRevisionCount] = useState<number>(initialDraft.revisionCount)
  const [savedAt, setSavedAt] = useState<string | null>(initialDraft.updatedAt)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [isPending, startTransition] = useTransition()

  // Validations EEAT recomputées à chaque keystroke (memo, regex légères).
  const liveValidations: EeatValidations = useMemo(() => computeEeatValidations(content), [content])
  const liveScore = computeEeatScore(liveValidations)

  function announce(kind: 'ok' | 'error', text: string): void {
    setFeedback({ kind, text })
  }

  function handleSave(): void {
    startTransition(async () => {
      try {
        const res = await saveDraft(initialDraft.id, content)
        setRevisionCount(res.version)
        setSavedAt(new Date().toISOString())
        announce('ok', `Sauvegardé. Version ${res.version} · EEAT ${res.eeatScore}/10.`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur inconnue'
        announce('error', `Sauvegarde échouée : ${msg}`)
      }
    })
  }

  function handleTransition(newStatus: SeoDraftStatus): void {
    startTransition(async () => {
      try {
        await updateDraftStatus(initialDraft.id, newStatus)
        setStatus(newStatus)
        announce('ok', `Statut → ${newStatus}.`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur inconnue'
        announce('error', msg)
      }
    })
  }

  function handlePublish(): void {
    startTransition(async () => {
      try {
        const res = await publishDraft(initialDraft.id)
        setStatus('published')
        announce('ok', `Publié → ${res.publishedUrl}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur inconnue'
        announce('error', msg)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Header — titre, mot-clé, statut, actions */}
      <Card variant="opaque" padding="default" className="space-y-4">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-1">
              Draft · {status} · v{revisionCount}
            </p>
            <h1 className="text-xl font-display font-semibold text-ink tracking-tight">
              {initialDraft.title}
            </h1>
            {initialDraft.keyword ? (
              <p className="mt-1 text-[12px] text-ink-mute">
                Mot-clé :{' '}
                <span className="font-medium text-ink">{initialDraft.keyword.display}</span>
                {initialDraft.keyword.category ? (
                  <span> · {initialDraft.keyword.category}</span>
                ) : null}
                {initialDraft.keyword.geoScope ? (
                  <span> · {initialDraft.keyword.geoScope}</span>
                ) : null}
              </p>
            ) : null}
            {savedAt ? (
              <p className="mt-1 text-[11px] text-ink-faint font-mono">
                Sauvegardé : {new Date(savedAt).toLocaleString('fr-FR')}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handleSave} disabled={isPending} variant="default" size="sm">
              {isPending ? 'Sauvegarde…' : 'Sauvegarder draft'}
            </Button>
            <Button
              onClick={() => handleTransition('review')}
              disabled={isPending || status === 'review'}
              variant="outline"
              size="sm"
            >
              Soumettre review
            </Button>
            <Button
              onClick={() => handleTransition('approved')}
              disabled={isPending || status === 'approved' || status === 'published'}
              variant="outline"
              size="sm"
            >
              Approuver
            </Button>
            <Button
              onClick={handlePublish}
              disabled={isPending || status !== 'approved'}
              variant="accent"
              size="sm"
            >
              Publier
            </Button>
            <Button
              onClick={() => handleTransition('rejected')}
              disabled={isPending || status === 'rejected'}
              variant="destructive"
              size="sm"
            >
              Rejeter
            </Button>
          </div>
        </div>

        {feedback ? (
          <div
            className={
              feedback.kind === 'ok'
                ? 'rounded-md border border-rule bg-cream-deep/40 px-3 py-2 text-[12px] text-ink'
                : 'rounded-md border border-danger/40 bg-coral-mist px-3 py-2 text-[12px] text-[#8B1414]'
            }
            role="status"
          >
            {feedback.text}
          </div>
        ) : null}
      </Card>

      {/* Editor + EEAT validator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card variant="opaque" padding="default" className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              Contenu — Markdown
            </p>
            <p className="text-[11px] text-ink-faint font-mono">
              {content.length.toLocaleString('fr-FR')} caractères ·{' '}
              {content.split(/\s+/).filter(Boolean).length.toLocaleString('fr-FR')} mots
            </p>
          </div>
          {/* TipTap fallback : textarea. */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isPending}
            spellCheck={false}
            className="w-full min-h-[600px] rounded-md border border-rule bg-paper px-4 py-3 text-[13px] font-mono text-ink leading-relaxed focus:outline-none focus:ring-2 focus:ring-ink/15 disabled:opacity-60"
            aria-label="Markdown éditeur"
          />
        </Card>

        <div className="lg:col-span-1">
          <EeatValidator validations={liveValidations} score={liveScore} />
        </div>
      </div>
    </div>
  )
}
