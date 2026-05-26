'use client'

/**
 * KOVAS — Modal saisie texte rapide post-photo (V1.5 iteration 4).
 *
 * Pipeline :
 *   1. user tape "Note" dans PostPhotoActionBar
 *   2. modal full-screen avec textarea + suggestions
 *   3. user tape OK → enqueueTextNote
 *   4. sync manager → createTextNoteAction (INSERT mission_text_notes)
 *
 * Authority : CLAUDE.md §3 + brief iteration 4.
 */

import { Button } from '@/components/ui/button'
import { enqueueTextNote } from '@/lib/mission/local-storage-queue'
import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface TextNoteModalProps {
  open: boolean
  localPhotoId: string
  /** Si la photo est déjà uploadée serveur, on peut shortcut le INSERT. */
  serverPhotoId?: string
  dossierId: string
  roomId: string | null
  thumbnailUrl?: string
  onCancel: () => void
  onComplete: (textLocalId: string) => void
}

const MAX_CHARS = 500
const SUGGESTIONS = ['Marque, modèle, année', 'État apparent', 'Particularités']

export function TextNoteModal({
  open,
  localPhotoId,
  serverPhotoId,
  dossierId,
  roomId,
  thumbnailUrl,
  onCancel,
  onComplete,
}: TextNoteModalProps) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Autofocus à l'ouverture
  useEffect(() => {
    if (!open) return undefined
    setText('')
    setError(null)
    // Petit setTimeout pour laisser le clavier mobile s'animer
    const t = window.setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
    return () => window.clearTimeout(t)
  }, [open])

  async function handleSubmit() {
    const trimmed = text.trim()
    if (trimmed.length === 0) {
      onCancel()
      return
    }
    if (trimmed.length > MAX_CHARS) {
      setError(`Maximum ${MAX_CHARS} caractères`)
      return
    }
    setSubmitting(true)
    try {
      const textLocalId = await enqueueTextNote({
        dossierId,
        roomId,
        text: trimmed,
        attachedLocalPhotoId: localPhotoId,
        attachedPhotoServerId: serverPhotoId ?? null,
      })
      onComplete(textLocalId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur sauvegarde'
      setError(msg)
      setSubmitting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
    // Cmd/Ctrl + Enter pour valider
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleSubmit()
    }
  }

  if (!open) return null

  const remaining = MAX_CHARS - text.length

  return (
    // biome-ignore lint/a11y/useSemanticElements: pattern fixed+backdrop (pas <dialog>)
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Saisie d'une note"
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-paper',
        'animate-in fade-in duration-200',
        'p-4',
      )}
    >
      {/* Thumbnail floutée en background */}
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full object-cover opacity-20 blur-md"
        />
      ) : null}

      <div className="relative z-10 w-full max-w-md">
        <div
          className={cn(
            'rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-5 py-5',
            'shadow-xl',
            'flex flex-col gap-4',
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl}
                  alt="Capture terrain"
                  className="size-10 shrink-0 rounded-lg border border-[#0F1419]/[0.08] object-cover"
                />
              ) : null}
              <div>
                <p className="font-mono text-[11px] tracking-[0.08em] text-[#0F1419]/72 uppercase">
                  Annotation photo
                </p>
                <h2 className="font-serif text-lg italic text-[#0F1419]">Note sur cette photo</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full p-1.5 text-[#0F1419]/72 hover:bg-[#0F1419]/5 hover:text-[#0F1419]"
              aria-label="Fermer"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={handleKeyDown}
            placeholder="Précisions sur la photo…"
            inputMode="text"
            enterKeyHint="done"
            rows={5}
            className={cn(
              'w-full resize-none rounded-xl border border-[#0F1419]/[0.08] bg-paper px-3 py-2.5',
              'text-base text-[#0F1419] placeholder:text-[#0F1419]/40',
              'focus-visible:border-[#0F1419]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F1419]/20',
            )}
            disabled={submitting}
          />

          {/* Compteur + suggestions */}
          <div className="flex flex-col gap-2 text-xs text-[#0F1419]/72">
            <div className="flex items-center justify-between">
              <span>
                Suggestions :{' '}
                {SUGGESTIONS.map((s, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: liste statique fixe
                  <span key={i}>
                    {i > 0 ? ' · ' : ''}
                    {s}
                  </span>
                ))}
              </span>
              <span
                className={cn(
                  'font-mono tabular-nums',
                  remaining < 50 ? 'text-accent-warm' : 'text-[#0F1419]/72',
                )}
              >
                {remaining}
              </span>
            </div>
          </div>

          {error ? (
            <p className="text-sm text-accent-red" role="alert">
              {error}
            </p>
          ) : null}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={onCancel}
              disabled={submitting}
              className="gap-1.5"
            >
              <X className="size-4" aria-hidden />
              Annuler
            </Button>
            <Button
              type="button"
              variant="accent"
              size="default"
              onClick={handleSubmit}
              disabled={submitting || text.trim().length === 0}
              className="gap-1.5"
            >
              <Check className="size-4" aria-hidden />
              {submitting ? 'Sauvegarde…' : 'OK'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
