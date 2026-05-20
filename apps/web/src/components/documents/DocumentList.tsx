'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { DOCUMENT_TYPE_LABEL } from '@/lib/documents/labels'
import type { Document } from '@/lib/documents/types'
import { cn } from '@/lib/utils'
import { FileText, Loader2, ScanLine } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { DocumentDetailModal } from './DocumentDetailModal'

interface DocumentListProps {
  dossierId: string
  /** Documents pré-chargés (optionnel) ; sinon fetch /api/documents/dossier/[dossierId]. */
  initialDocuments?: Document[]
  /** Callback de pré-remplissage. */
  onPrefill?: (documentId: string) => void | Promise<void>
  /** Callback de suppression. */
  onDelete?: (documentId: string) => void | Promise<void>
  className?: string
}

/**
 * Grille de cards documents rattachés à un dossier.
 * Thumbnail + badge type + filename + date — click → DocumentDetailModal.
 */
export function DocumentList({
  dossierId,
  initialDocuments,
  onPrefill,
  onDelete,
  className,
}: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments ?? [])
  const [loading, setLoading] = useState(!initialDocuments)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Document | null>(null)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/documents/dossier/${encodeURIComponent(dossierId)}`)
      if (!res.ok) throw new Error('Échec du chargement')
      const json = (await res.json()) as Document[] | { documents: Document[] }
      const list = Array.isArray(json) ? json : json.documents
      setDocuments(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [dossierId])

  useEffect(() => {
    if (initialDocuments) return
    void fetchDocuments()
  }, [fetchDocuments, initialDocuments])

  const handleDelete = useCallback(
    async (documentId: string) => {
      if (onDelete) await onDelete(documentId)
      setDocuments((prev) => prev.filter((d) => d.id !== documentId))
      setSelected(null)
    },
    [onDelete],
  )

  if (loading) {
    return (
      <output
        className={cn('flex items-center justify-center py-12 text-ink-mute', className)}
        aria-live="polite"
      >
        <Loader2 className="size-5 animate-spin" aria-hidden />
        <span className="ml-2 text-sm">Chargement des documents…</span>
      </output>
    )
  }

  if (error) {
    return (
      <Card variant="warm" padding="default" className={className}>
        <p className="text-sm text-ink">Erreur : {error}</p>
      </Card>
    )
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={ScanLine}
        title="Aucun document scanné"
        description="Utilisez le bouton « Scanner » pour ajouter un DPE antérieur, une plaque chaudière, une facture énergie ou un plan."
        className={className}
      />
    )
  }

  return (
    <>
      <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
        {documents.map((doc) => (
          <DocumentCard key={doc.id} document={doc} onClick={() => setSelected(doc)} />
        ))}
      </div>

      <DocumentDetailModal
        open={selected !== null}
        onOpenChange={(o) => (o ? null : setSelected(null))}
        document={selected}
        dossierId={dossierId}
        onPrefill={onPrefill}
        onDelete={onDelete ? handleDelete : undefined}
      />
    </>
  )
}

// ============================================
// Card unitaire
// ============================================

function DocumentCard({ document, onClick }: { document: Document; onClick: () => void }) {
  const typeLabel = document.document_type
    ? DOCUMENT_TYPE_LABEL[document.document_type]
    : 'Type indéterminé'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-rule bg-paper text-left transition-all',
        'hover:-translate-y-0.5 hover:shadow-glass-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40',
      )}
    >
      <div className="aspect-[4/3] bg-sage-alt/60 overflow-hidden">
        {document.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={document.thumbnail_url}
            alt={document.filename}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-mute">
            <FileText className="size-8" aria-hidden />
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <Badge variant="outline" className="text-[10px]">
          {typeLabel}
        </Badge>
        <p className="truncate text-sm font-medium text-ink">{document.filename}</p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
          {new Date(document.uploaded_at).toLocaleDateString('fr-FR')}
        </p>
      </div>
    </button>
  )
}
