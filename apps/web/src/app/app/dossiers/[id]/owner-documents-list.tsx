'use client'

import { CheckCircle, Circle, Download, FileText, Trash2 } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import {
  deleteOwnerDocumentAction,
  toggleDocumentReviewedAction,
} from './actions'

const DOC_KIND_LABELS: Record<string, string> = {
  facture_energie: 'Facture énergie',
  ancien_dpe: 'Ancien DPE',
  plan: 'Plan / Croquis',
  acte: 'Acte / Bail',
  reglement_copro: 'Règlement copropriété',
  autre: 'Autre',
}

interface OwnerDoc {
  id: string
  storage_path: string
  original_name: string | null
  size_bytes: number | null
  mime_type: string | null
  doc_kind: string | null
  uploaded_at: string | null
  reviewed_by_diag: boolean | null
}

interface OwnerDocumentsListProps {
  dossierId: string
  documents: OwnerDoc[]
}

export function OwnerDocumentsList({ dossierId, documents }: OwnerDocumentsListProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (documents.length === 0) return
      const supabase = createClient()
      const { data } = await supabase.storage
        .from('owner-uploads')
        .createSignedUrls(documents.map((d) => d.storage_path), 3600)
      if (!cancelled && data) {
        const map: Record<string, string> = {}
        for (let i = 0; i < documents.length; i++) {
          const url = data[i]?.signedUrl
          if (url) map[documents[i]!.id] = url
        }
        setSignedUrls(map)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [documents])

  function handleToggleReviewed(docId: string, current: boolean) {
    startTransition(async () => {
      await toggleDocumentReviewedAction(dossierId, docId, !current)
    })
  }

  function handleDelete(docId: string, storagePath: string) {
    if (!confirm('Supprimer ce document ?')) return
    startTransition(async () => {
      await deleteOwnerDocumentAction(dossierId, docId, storagePath)
    })
  }

  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun document envoyé par le client pour le moment.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {documents.map((d) => {
        const url = signedUrls[d.id]
        const sizeKB = d.size_bytes ? Math.round(d.size_bytes / 1024) : null
        return (
          <li
            key={d.id}
            className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
          >
            <FileText className="size-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">
                  {d.original_name ?? 'Document sans nom'}
                </span>
                {d.doc_kind && (
                  <Badge variant="muted">{DOC_KIND_LABELS[d.doc_kind] ?? d.doc_kind}</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {sizeKB ? `${sizeKB} Ko · ` : ''}
                {d.uploaded_at ? new Date(d.uploaded_at).toLocaleString('fr-FR') : ''}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleToggleReviewed(d.id, d.reviewed_by_diag ?? false)}
              aria-label="Marquer comme lu"
            >
              {d.reviewed_by_diag ? (
                <CheckCircle className="size-4 text-accent-green" />
              ) : (
                <Circle className="size-4 text-muted-foreground" />
              )}
            </Button>
            {url && (
              <Button variant="ghost" size="icon" asChild aria-label="Télécharger">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <Download className="size-4" />
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(d.id, d.storage_path)}
              aria-label="Supprimer"
            >
              <Trash2 className="size-4 text-muted-foreground" />
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
