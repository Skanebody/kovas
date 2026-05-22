'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DIAGNOSTIC_TYPE_LABELS,
  type DiagnosticType,
  getValidityStatus,
} from '@/lib/diagnostic-validity/expiration-calculator'
import { cn } from '@/lib/utils'
import {
  Camera,
  CheckCircle2,
  CircleAlert,
  FileText,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { deleteDiagnosticScanAction, rejectDiagnosticScanAction } from './actions'
import { ScanProposalDialog } from './scan-proposal-dialog'

interface ScanRow {
  id: string
  original_name: string | null
  mime_type: string | null
  size_bytes: number | null
  diagnostic_type:
    | 'dpe'
    | 'amiante'
    | 'plomb'
    | 'gaz'
    | 'electricite'
    | 'termites'
    | 'carrez'
    | 'erp'
    | null
  date_emission: string | null
  date_expiration: string | null
  adresse: string | null
  proprietaire: string | null
  ademe_number: string | null
  energy_class: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null
  result_positive: boolean | null
  usage_context: 'vente' | 'location' | 'unknown' | null
  ai_confidence: number | null
  status: 'pending' | 'analyzing' | 'analyzed' | 'confirmed' | 'rejected' | 'failed'
  client_id: string | null
  property_id: string | null
  created_at: string
}

interface ClientOption {
  id: string
  display_name: string
}
interface PropertyOption {
  id: string
  address: string
  city: string | null
  postal_code: string | null
  client_id: string | null
}

interface ScanWorkspaceProps {
  initialScans: ScanRow[]
  clients: ClientOption[]
  properties: PropertyOption[]
}

interface UploadingItem {
  tempId: string
  fileName: string
  progress: 'uploading' | 'analyzing' | 'done' | 'error'
  message?: string
  scanId?: string
}

export function ScanWorkspace({ initialScans, clients, properties }: ScanWorkspaceProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState<UploadingItem[]>([])
  const [editing, setEditing] = useState<ScanRow | null>(null)
  const [, startTransition] = useTransition()

  function openProposal(scan: ScanRow) {
    setEditing(scan)
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files)
    for (const file of list) {
      const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setUploading((prev) => [...prev, { tempId, fileName: file.name, progress: 'uploading' }])

      const form = new FormData()
      form.append('file', file)
      form.append('usage', 'vente')

      try {
        setUploading((prev) =>
          prev.map((u) => (u.tempId === tempId ? { ...u, progress: 'analyzing' } : u)),
        )

        const resp = await fetch('/api/diagnostics/upload-scan', {
          method: 'POST',
          body: form,
        })
        const data = (await resp.json()) as {
          ok?: boolean
          scanId?: string
          error?: string
          warning?: string
        }

        if (!resp.ok || !data.ok) {
          setUploading((prev) =>
            prev.map((u) =>
              u.tempId === tempId
                ? {
                    ...u,
                    progress: 'error',
                    message: data.error ?? 'Échec',
                  }
                : u,
            ),
          )
          continue
        }

        setUploading((prev) =>
          prev.map((u) =>
            u.tempId === tempId
              ? {
                  ...u,
                  progress: 'done',
                  scanId: data.scanId,
                  message: data.warning,
                }
              : u,
          ),
        )

        // Refresh la liste serveur
        router.refresh()
      } catch (err) {
        setUploading((prev) =>
          prev.map((u) =>
            u.tempId === tempId
              ? {
                  ...u,
                  progress: 'error',
                  message: err instanceof Error ? err.message : 'Erreur',
                }
              : u,
          ),
        )
      }
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files)
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      uploadFiles(e.target.files)
      // reset pour permettre de re-uploader le même fichier
      e.target.value = ''
    }
  }

  function handleReject(scanId: string) {
    if (!confirm('Rejeter ce scan ? Il sera masqué mais conservé.')) return
    startTransition(async () => {
      await rejectDiagnosticScanAction(scanId)
      router.refresh()
    })
  }

  function handleDelete(scanId: string) {
    if (!confirm('Supprimer définitivement ce scan ?')) return
    startTransition(async () => {
      await deleteDiagnosticScanAction(scanId)
      router.refresh()
    })
  }

  return (
    <>
      <Card variant="opaque" padding="none" className="overflow-hidden">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center text-center px-6 py-12 md:py-16',
            'transition-colors duration-fast',
            dragOver ? 'bg-chartreuse/15' : 'bg-transparent',
          )}
        >
          <div
            aria-hidden
            className="size-14 rounded-full bg-cream-deep/80 flex items-center justify-center mb-4"
          >
            <Upload className="size-6 text-ink-mute" strokeWidth={1.5} />
          </div>
          <p className="font-sans text-lg md:text-xl font-semibold text-ink leading-tight">
            Glissez vos diagnostics ici
          </p>
          <p className="text-sm text-ink-mute mt-1 max-w-md">
            PDF ou image (JPG, PNG, HEIC). Taille max 20 Mo par fichier. L'analyse IA prend environ
            10 secondes.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            <Button variant="accent" onClick={() => fileInputRef.current?.click()} type="button">
              <Upload className="size-4" /> Importer un fichier
            </Button>
            <Button variant="glass" onClick={() => cameraInputRef.current?.click()} type="button">
              <Camera className="size-4" /> Scanner avec la caméra
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      </Card>

      {uploading.length > 0 && (
        <Card variant="opaque" padding="default">
          <CardHeader>
            <CardTitle className="text-base">Traitement en cours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {uploading.map((u) => (
              <div
                key={u.tempId}
                className="flex items-center gap-3 rounded-md border border-rule/70 bg-paper px-3 py-2 text-sm"
              >
                <FileText className="size-4 text-ink-mute shrink-0" />
                <span className="flex-1 truncate">{u.fileName}</span>
                {u.progress === 'uploading' && (
                  <span className="text-xs text-ink-mute inline-flex items-center gap-1.5">
                    <Loader2 className="size-3 animate-spin" /> Envoi…
                  </span>
                )}
                {u.progress === 'analyzing' && (
                  <span className="text-xs text-ink-mute inline-flex items-center gap-1.5">
                    <Sparkles className="size-3" /> Analyse IA…
                  </span>
                )}
                {u.progress === 'done' && (
                  <Badge variant="green">
                    <CheckCircle2 className="size-3 mr-1" /> Analysé
                  </Badge>
                )}
                {u.progress === 'error' && (
                  <Badge variant="red">
                    <XCircle className="size-3 mr-1" />
                    {u.message ?? 'Erreur'}
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card variant="opaque" padding="default">
        <CardHeader>
          <CardTitle className="text-base">Diagnostics scannés récents</CardTitle>
          <p className="text-xs text-ink-mute mt-1">
            Validez le rangement proposé ou modifiez avant confirmation. Les scans confirmés
            apparaissent dans la fiche client et la fiche bien.
          </p>
        </CardHeader>
        <CardContent>
          {initialScans.length === 0 ? (
            <p className="text-sm text-ink-mute py-6 text-center">
              Aucun scan pour le moment. Importez votre premier diagnostic ci-dessus.
            </p>
          ) : (
            <ul className="divide-y divide-rule/60">
              {initialScans.map((s) => (
                <ScanListItem
                  key={s.id}
                  scan={s}
                  onEdit={openProposal}
                  onReject={handleReject}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {editing && (
        <ScanProposalDialog
          scan={editing}
          clients={clients}
          properties={properties}
          onClose={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}

function ScanListItem({
  scan,
  onEdit,
  onReject,
  onDelete,
}: {
  scan: ScanRow
  onEdit: (s: ScanRow) => void
  onReject: (id: string) => void
  onDelete: (id: string) => void
}) {
  const typeLabel = scan.diagnostic_type
    ? DIAGNOSTIC_TYPE_LABELS[scan.diagnostic_type as DiagnosticType]
    : null
  const validityStatus = getValidityStatus(scan.date_expiration)
  const sizeKB = scan.size_bytes ? Math.round(scan.size_bytes / 1024) : null

  let statusBadge: React.ReactNode = null
  if (scan.status === 'analyzing') {
    statusBadge = (
      <Badge variant="blue">
        <Loader2 className="size-3 mr-1 animate-spin" /> Analyse…
      </Badge>
    )
  } else if (scan.status === 'analyzed') {
    statusBadge = (
      <Badge variant="amber">
        <CircleAlert className="size-3 mr-1" /> À valider
      </Badge>
    )
  } else if (scan.status === 'confirmed') {
    statusBadge = (
      <Badge variant="green">
        <CheckCircle2 className="size-3 mr-1" /> Rangé
      </Badge>
    )
  } else if (scan.status === 'rejected') {
    statusBadge = <Badge variant="muted">Rejeté</Badge>
  } else if (scan.status === 'failed') {
    statusBadge = <Badge variant="red">Échec</Badge>
  } else {
    statusBadge = <Badge variant="muted">En attente</Badge>
  }

  return (
    <li className="py-3 flex items-start gap-3 flex-wrap md:flex-nowrap">
      <FileText className="size-5 text-ink-mute shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">
            {scan.original_name ?? 'Diagnostic sans nom'}
          </span>
          {typeLabel ? <Badge variant="muted">{typeLabel}</Badge> : null}
          {scan.energy_class ? (
            <Badge variant="muted" className="font-mono">
              {scan.energy_class}
            </Badge>
          ) : null}
          {statusBadge}
        </div>
        <div className="text-xs text-ink-mute mt-1 space-x-2">
          {scan.adresse ? <span>{scan.adresse}</span> : null}
          {scan.date_emission ? <span>· Émis le {formatDate(scan.date_emission)}</span> : null}
          {scan.date_expiration ? (
            <span
              className={cn(
                'font-mono',
                validityStatus === 'expired' && 'text-accent-red',
                validityStatus === 'expiring' && 'text-amber',
                validityStatus === 'valid' && 'text-accent-green',
              )}
            >
              · Expire le {formatDate(scan.date_expiration)}
            </span>
          ) : null}
          {sizeKB ? <span>· {sizeKB} Ko</span> : null}
          {scan.ai_confidence != null && scan.status === 'analyzed' ? (
            <span>· {Math.round(scan.ai_confidence * 100)}% confiance</span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {(scan.status === 'analyzed' || scan.status === 'confirmed') && (
          <Button
            size="sm"
            variant={scan.status === 'confirmed' ? 'glass' : 'accent'}
            onClick={() => onEdit(scan)}
          >
            {scan.status === 'confirmed' ? 'Modifier' : 'Ranger'}
          </Button>
        )}
        {scan.status !== 'rejected' && scan.status !== 'analyzing' && (
          <Button size="sm" variant="ghost" onClick={() => onReject(scan.id)} aria-label="Rejeter">
            <XCircle className="size-4" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onDelete(scan.id)} aria-label="Supprimer">
          <Trash2 className="size-4 text-ink-mute" />
        </Button>
      </div>
    </li>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
