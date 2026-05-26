/**
 * ArchiveTable — rendu serveur-friendly de la liste paginée des fichiers archive.
 *
 * Pagination : query param `?page=N`. Liens prev/next ajoutent ce param sans
 * toucher aux autres filtres. Pas de state local — single source of truth = URL.
 */

import {
  AppListTable,
  AppListTableCell,
  AppListTableHead,
  AppListTableRow,
} from '@/components/ui/app-list-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ARCHIVE_KIND_BADGE,
  ARCHIVE_KIND_LABELS,
  type ArchiveFile,
  type ArchiveFileKind,
} from '@/lib/archive/types'
import {
  Download,
  ExternalLink,
  FileAudio,
  FileText,
  Image as ImageIcon,
  Package,
} from 'lucide-react'
import Link from 'next/link'

interface ArchiveTableProps {
  files: ArchiveFile[]
  total: number
  page: number
  limit: number
  hasMore: boolean
  /** Query params actuels sérialisés (sans `page`) — pour build des liens pagination. */
  baseQueryString: string
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const KIND_ICON: Record<ArchiveFileKind, typeof FileText> = {
  photo: ImageIcon,
  audio: FileAudio,
  document: FileText,
  export: Package,
}

function buildPageHref(baseQuery: string, page: number): string {
  const params = new URLSearchParams(baseQuery)
  if (page <= 1) {
    params.delete('page')
  } else {
    params.set('page', String(page))
  }
  const q = params.toString()
  return q ? `/dashboard/archive?${q}` : '/dashboard/archive'
}

export function ArchiveTable({
  files,
  total,
  page,
  limit,
  hasMore,
  baseQueryString,
}: ArchiveTableProps) {
  if (files.length === 0) {
    return (
      <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper p-8 text-center">
        <p className="text-sm text-[#0F1419]/72">
          Aucun fichier ne correspond à ces filtres. Essaie d&apos;élargir la période ou de retirer
          un critère.
        </p>
      </div>
    )
  }

  const lastShown = (page - 1) * limit + files.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[12px] text-[#0F1419]/72">
        <span>
          {(page - 1) * limit + 1}–{lastShown} sur {total}
        </span>
      </div>

      <AppListTable>
        <AppListTableHead>
          <tr>
            <th className="text-left font-medium px-4 py-3 w-[80px]">Aperçu</th>
            <th className="text-left font-medium px-4 py-3">Fichier</th>
            <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Type</th>
            <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Dossier</th>
            <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Date</th>
            <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Taille</th>
            <th className="text-right font-medium px-4 py-3 w-[180px]">Actions</th>
          </tr>
        </AppListTableHead>
        <tbody>
          {files.map((file) => {
            const Icon = KIND_ICON[file.kind]
            return (
              <AppListTableRow key={`${file.kind}-${file.id}`}>
                <AppListTableCell>
                  <div className="size-12 rounded-md border border-[#0F1419]/[0.08] bg-sage-alt flex items-center justify-center overflow-hidden">
                    {file.kind === 'photo' && file.signed_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.signed_url}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Icon className="size-5 text-[#0F1419]/72" aria-hidden />
                    )}
                  </div>
                </AppListTableCell>
                <AppListTableCell>
                  <div className="font-mono text-[12px] text-[#0F1419] truncate max-w-[280px]">
                    {file.name}
                  </div>
                  <div className="text-[11px] text-[#0F1419]/72 sm:hidden">
                    {ARCHIVE_KIND_LABELS[file.kind]} · {formatDate(file.created_at)}
                  </div>
                </AppListTableCell>
                <AppListTableCell className="hidden sm:table-cell">
                  <Badge variant={ARCHIVE_KIND_BADGE[file.kind]}>
                    {ARCHIVE_KIND_LABELS[file.kind]}
                  </Badge>
                </AppListTableCell>
                <AppListTableCell className="hidden md:table-cell">
                  {file.dossier_id && file.dossier_reference ? (
                    <Link
                      href={`/dashboard/dossiers/${file.dossier_id}`}
                      className="font-mono text-[11px] font-semibold text-[#0F1419] hover:underline"
                    >
                      {file.dossier_reference}
                    </Link>
                  ) : (
                    <span className="text-[11px] text-[#0F1419]/55">—</span>
                  )}
                </AppListTableCell>
                <AppListTableCell className="hidden lg:table-cell text-[12px]">
                  {formatDate(file.created_at)}
                </AppListTableCell>
                <AppListTableCell className="hidden lg:table-cell text-[12px] text-[#0F1419]/72">
                  {formatBytes(file.file_size_bytes)}
                </AppListTableCell>
                <AppListTableCell className="text-right">
                  <div className="inline-flex gap-1.5 justify-end">
                    {file.signed_url ? (
                      <Button asChild variant="ghost" size="sm" aria-label="Télécharger">
                        <a href={file.signed_url} download={file.name} rel="nofollow">
                          <Download className="size-4" />
                          <span className="sr-only sm:not-sr-only">Télécharger</span>
                        </a>
                      </Button>
                    ) : null}
                    {file.dossier_id ? (
                      <Button asChild variant="ghost" size="sm" aria-label="Ouvrir le dossier">
                        <Link href={`/dashboard/dossiers/${file.dossier_id}`}>
                          <ExternalLink className="size-4" />
                          <span className="sr-only sm:not-sr-only">Ouvrir</span>
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </AppListTableCell>
              </AppListTableRow>
            )
          })}
        </tbody>
      </AppListTable>

      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between pt-2">
          <div>
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={buildPageHref(baseQueryString, page - 1)}>← Page précédente</Link>
              </Button>
            ) : (
              <span />
            )}
          </div>
          <div className="text-[12px] text-[#0F1419]/72">Page {page}</div>
          <div>
            {hasMore ? (
              <Button asChild variant="outline" size="sm">
                <Link href={buildPageHref(baseQueryString, page + 1)}>Page suivante →</Link>
              </Button>
            ) : (
              <span />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
