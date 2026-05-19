'use client'

import {
  CheckCircle,
  Circle,
  Download,
  FileText,
  Loader2,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  deleteOwnerDocumentAction,
  importExtractedDataAction,
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

interface ExtractedSuggestion {
  target: string
  label: string
  value: string | number | null
}

interface ExtractedData {
  doc_kind: string
  raw_fields: Record<string, unknown>
  suggested_imports: ExtractedSuggestion[]
  confidence: number
  summary: string
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
  extracted_data?: ExtractedData | null
  extraction_status?: string | null
  extraction_error?: string | null
}

interface OwnerDocumentsListProps {
  dossierId: string
  documents: OwnerDoc[]
}

export function OwnerDocumentsList({ dossierId, documents }: OwnerDocumentsListProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [scanning, setScanning] = useState<string | null>(null)
  const [scanError, setScanError] = useState<Record<string, string>>({})
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

  async function handleScan(docId: string) {
    setScanError((p) => ({ ...p, [docId]: '' }))
    setScanning(docId)
    try {
      const resp = await fetch(`/api/owner-documents/${docId}/extract`, { method: 'POST' })
      const data = await resp.json()
      if (resp.status === 503 && data.stub) {
        setScanError((p) => ({
          ...p,
          [docId]: 'ANTHROPIC_API_KEY manquante — scan désactivé en dev',
        }))
        return
      }
      if (!resp.ok || !data.ok) {
        setScanError((p) => ({ ...p, [docId]: data.error ?? 'Extraction échouée' }))
        return
      }
      // Force refresh pour récupérer extracted_data depuis le serveur
      window.location.reload()
    } catch (e) {
      setScanError((p) => ({ ...p, [docId]: e instanceof Error ? e.message : 'Erreur' }))
    } finally {
      setScanning(null)
    }
  }

  if (documents.length === 0) {
    return (
      <p className="text-sm text-ink-mute">
        Aucun document envoyé par le client pour le moment.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {documents.map((d) => {
        const url = signedUrls[d.id]
        const sizeKB = d.size_bytes ? Math.round(d.size_bytes / 1024) : null
        const extracted = d.extracted_data ?? null
        const status = d.extraction_status ?? 'pending'

        return (
          <li key={d.id} className="rounded-md border border-rule/80 glass-opaque p-3 space-y-3">
            <div className="flex items-center gap-3">
              <FileText className="size-5 text-ink-mute shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">
                    {d.original_name ?? 'Document sans nom'}
                  </span>
                  {d.doc_kind && (
                    <Badge variant="muted">{DOC_KIND_LABELS[d.doc_kind] ?? d.doc_kind}</Badge>
                  )}
                  {status === 'extracted' && (
                    <Badge variant="green">
                      <Sparkles className="size-3 mr-1" /> Analysé
                    </Badge>
                  )}
                  {status === 'failed' && <Badge variant="red">Échec analyse</Badge>}
                </div>
                <div className="text-xs text-ink-mute mt-0.5">
                  {sizeKB ? `${sizeKB} Ko · ` : ''}
                  {d.uploaded_at ? new Date(d.uploaded_at).toLocaleString('fr-FR') : ''}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleScan(d.id)}
                aria-label="Scanner le document"
                disabled={scanning === d.id}
                title="Scanner et extraire les infos"
              >
                {scanning === d.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleToggleReviewed(d.id, d.reviewed_by_diag ?? false)}
                aria-label="Marquer comme lu"
              >
                {d.reviewed_by_diag ? (
                  <CheckCircle className="size-4 text-accent-green" />
                ) : (
                  <Circle className="size-4 text-ink-mute" />
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
                <Trash2 className="size-4 text-ink-mute" />
              </Button>
            </div>

            {scanError[d.id] && (
              <p className="text-xs text-accent-red" role="alert">
                {scanError[d.id]}
              </p>
            )}

            {extracted && (
              <ExtractedPanel dossierId={dossierId} documentId={d.id} extracted={extracted} />
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ExtractedPanel({
  dossierId,
  documentId,
  extracted,
}: {
  dossierId: string
  documentId: string
  extracted: ExtractedData
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(
      extracted.suggested_imports
        .filter((s) => s.value != null && s.value !== '')
        .map((s) => s.target),
    ),
  )
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function toggle(target: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(target)) next.delete(target)
      else next.add(target)
      return next
    })
  }

  function handleImport() {
    setError(null)
    setImporting(true)
    startTransition(async () => {
      try {
        await importExtractedDataAction(dossierId, documentId, Array.from(selected))
        setImported(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur')
      } finally {
        setImporting(false)
      }
    })
  }

  const usableSuggestions = extracted.suggested_imports.filter(
    (s) => s.value != null && s.value !== '',
  )

  return (
    <div className="rounded-md bg-cream-deep/60 p-3 space-y-3 text-sm">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-semibold flex items-center gap-1.5">
            <Sparkles className="size-3.5" /> Données extraites
          </span>
          {extracted.confidence > 0 && (
            <Badge
              variant={extracted.confidence >= 0.8 ? 'green' : 'orange'}
              className="text-[10px]"
            >
              {Math.round(extracted.confidence * 100)}% confiance
            </Badge>
          )}
        </div>
        {extracted.summary && (
          <p className="text-ink-mute italic">"{extracted.summary}"</p>
        )}
      </div>

      {usableSuggestions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-ink-mute">
            Cochez les valeurs à importer dans le dossier (n'écrase pas les champs déjà remplis) :
          </p>
          <ul className="space-y-1">
            {usableSuggestions.map((sug) => (
              <li key={sug.target}>
                <label
                  className={cn(
                    'flex items-center gap-2 rounded px-2 py-1.5 hover:bg-paper cursor-pointer text-xs',
                    !selected.has(sug.target) && 'opacity-60',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(sug.target)}
                    onChange={() => toggle(sug.target)}
                    className="accent-foreground"
                  />
                  <span className="font-medium">{sug.label} :</span>
                  <span className="font-mono">{String(sug.value)}</span>
                  <span className="ml-auto text-ink-mute font-mono text-[10px]">
                    → {sug.target}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {imported ? (
            <Badge variant="green">Données importées ✓</Badge>
          ) : (
            <Button
              size="sm"
              onClick={handleImport}
              disabled={importing || selected.size === 0}
            >
              {importing && <Loader2 className="size-3 animate-spin" />}
              Importer {selected.size} valeur{selected.size > 1 ? 's' : ''}
            </Button>
          )}

          {error && <p className="text-xs text-accent-red">{error}</p>}
        </div>
      ) : (
        <p className="text-xs text-ink-mute italic">
          Aucune valeur importable directement — voir le résumé ci-dessus.
        </p>
      )}

      {Object.keys(extracted.raw_fields ?? {}).length > 0 && (
        <details className="text-xs text-ink-mute">
          <summary className="cursor-pointer hover:text-ink">
            Voir les données brutes ({Object.keys(extracted.raw_fields).length} champs)
          </summary>
          <pre className="mt-2 p-2 rounded bg-paper overflow-auto text-[10px]">
            {JSON.stringify(extracted.raw_fields, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}
