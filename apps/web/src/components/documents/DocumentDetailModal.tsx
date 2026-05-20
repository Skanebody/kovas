'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DOCUMENT_TYPE_LABEL } from '@/lib/documents/labels'
import type { Document } from '@/lib/documents/types'
import { cn } from '@/lib/utils'
import { Loader2, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'

interface DocumentDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: Document | null
  /** Si fourni, propose le bouton "Pré-remplir le dossier". */
  dossierId?: string
  /** Callback de pré-remplissage. */
  onPrefill?: (documentId: string) => void | Promise<void>
  /** Suppression. */
  onDelete?: (documentId: string) => void | Promise<void>
}

/**
 * Modal détail document — image grande + extraction structurée + actions.
 *
 * Full-screen mobile, max-w-3xl desktop.
 */
export function DocumentDetailModal({
  open,
  onOpenChange,
  document,
  dossierId,
  onPrefill,
  onDelete,
}: DocumentDetailModalProps) {
  const [busy, setBusy] = useState<'prefill' | 'delete' | null>(null)

  if (!document) return null

  const typeLabel = document.document_type
    ? DOCUMENT_TYPE_LABEL[document.document_type]
    : 'Type indéterminé'
  const extractedEntries = document.extraction_data ? Object.values(document.extraction_data) : []

  async function handlePrefill() {
    if (!document || !onPrefill) return
    setBusy('prefill')
    try {
      await onPrefill(document.id)
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete() {
    if (!document || !onDelete) return
    setBusy('delete')
    try {
      await onDelete(document.id)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0',
          'h-[100dvh] sm:h-auto w-screen sm:w-full rounded-none sm:rounded-xl',
        )}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-rule/60">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="font-serif italic font-normal text-xl text-ink truncate">
                {document.filename}
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-2 text-xs text-ink-mute">
                <Badge variant="outline">{typeLabel}</Badge>
                <span>·</span>
                <span>{new Date(document.uploaded_at).toLocaleString('fr-FR')}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-2">
          {/* Image grande */}
          <div className="relative overflow-hidden rounded-lg border border-rule bg-sage-alt/40">
            {document.preview_url || document.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={document.preview_url ?? document.thumbnail_url ?? ''}
                alt={document.filename}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center text-sm text-ink-mute">
                Aperçu non disponible
              </div>
            )}
          </div>

          {/* Extraction structurée */}
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
                Données extraites
              </p>
              <h3 className="mt-1 font-serif italic font-normal text-xl text-ink">
                {extractedEntries.length} champ{extractedEntries.length > 1 ? 's' : ''}
              </h3>
            </div>

            {extractedEntries.length === 0 ? (
              <p className="rounded-md bg-sage-alt/60 px-4 py-3 text-sm text-ink-mute">
                Aucune donnée n'a été extraite de ce document.
              </p>
            ) : (
              <ul className="divide-y divide-rule/60">
                {extractedEntries.map((field) => (
                  <li key={field.key} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
                        {field.label}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-ink">
                        {field.value === null || field.value === undefined || field.value === ''
                          ? '—'
                          : typeof field.value === 'boolean'
                            ? field.value
                              ? 'Oui'
                              : 'Non'
                            : String(field.value)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        field.routing === 'auto'
                          ? 'green'
                          : field.routing === 'review'
                            ? 'amber'
                            : 'red'
                      }
                    >
                      {Math.round(field.confidence * 100)}%
                    </Badge>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-auto flex flex-col gap-2 pt-4">
              {dossierId && onPrefill ? (
                <Button
                  type="button"
                  variant="accent"
                  size="lg"
                  onClick={handlePrefill}
                  disabled={busy !== null}
                >
                  {busy === 'prefill' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Pré-remplir le dossier
                </Button>
              ) : null}
              {onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={busy !== null}
                  className="text-accent-red hover:bg-coral-mist/60"
                >
                  {busy === 'delete' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Supprimer ce document
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
