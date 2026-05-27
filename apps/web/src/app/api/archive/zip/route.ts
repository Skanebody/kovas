/**
 * KOVAS — API GET /api/archive/zip
 *
 * Bundle ZIP de tous les fichiers matchant les mêmes filtres que /files,
 * structurés par dossier → kind → nom.
 *
 * Cap dur : 300 fichiers ou 500 MB (sinon timeout Vercel 90s). Au-delà,
 * renvoie 413 et invite à affiner les filtres.
 *
 * Arborescence :
 *   README.txt
 *   DOS-2026-00012/
 *     photos/<id>.webp
 *     audio/<id>.webm
 *     documents/<filename>
 *     exports/<filename>.zip
 *   _sans_dossier/
 *     ...
 */

import { aggregateArchiveFiles } from '@/lib/archive/aggregator'
import type {
  ArchiveDiagnostic,
  ArchiveFile,
  ArchiveFileKind,
  ArchiveQuery,
} from '@/lib/archive/types'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 90
export const dynamic = 'force-dynamic'

const MAX_FILES = 300
const MAX_TOTAL_BYTES = 500 * 1024 * 1024 // 500 MB

const KIND_VALUES: ReadonlyArray<ArchiveFileKind | 'all'> = [
  'all',
  'photo',
  'audio',
  'document',
  'export',
]
const PERIOD_VALUES: ReadonlyArray<ArchiveQuery['period']> = [
  'all',
  '7d',
  '30d',
  '12m',
  '2025',
  '2024',
  '2023',
]
const DIAG_VALUES: ReadonlyArray<ArchiveDiagnostic | 'all'> = [
  'all',
  'dpe',
  'amiante',
  'plomb',
  'gaz',
  'electricite',
  'termites',
  'carrez',
  'erp',
]

function parseEnum<T extends string>(
  value: string | null,
  allowed: ReadonlyArray<T>,
  fallback: T,
): T {
  if (value === null) return fallback
  return (allowed as ReadonlyArray<string>).includes(value) ? (value as T) : fallback
}

const KIND_FOLDER: Record<ArchiveFileKind, string> = {
  photo: 'photos',
  audio: 'audio',
  document: 'documents',
  export: 'exports',
}

export async function GET(request: Request) {
  let user: Awaited<ReturnType<typeof getCurrentUser>>
  try {
    user = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const params = url.searchParams

  // 1. Récupère TOUS les fichiers (pagination = MAX_FILES)
  const query: ArchiveQuery = {
    kind: parseEnum<ArchiveFileKind | 'all'>(params.get('type'), KIND_VALUES, 'all'),
    period: parseEnum<ArchiveQuery['period']>(params.get('period'), PERIOD_VALUES, 'all'),
    clientId: params.get('client_id'),
    diagnostic: parseEnum<ArchiveDiagnostic | 'all'>(params.get('diagnostic'), DIAG_VALUES, 'all'),
    q: params.get('q'),
    page: 1,
    limit: MAX_FILES,
  }

  const { files, total } = await aggregateArchiveFiles({
    supabase: user.supabase,
    orgId: user.orgId,
    userId: user.user.id,
    query,
  })

  if (total === 0) {
    return NextResponse.json(
      { error: 'Aucun fichier à exporter avec ces filtres.' },
      { status: 404 },
    )
  }

  if (total > MAX_FILES) {
    return NextResponse.json(
      {
        error: `Trop de fichiers (${total} > ${MAX_FILES}). Affinez les filtres (période, type, client).`,
      },
      { status: 413 },
    )
  }

  // Soft check taille — la vraie validation se fait au fil du download.
  const knownBytes = files.reduce((acc, f) => acc + (f.file_size_bytes ?? 0), 0)
  if (knownBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      {
        error: `Volume total estimé ${Math.round(knownBytes / (1024 * 1024))} MB > 500 MB. Affinez les filtres.`,
      },
      { status: 413 },
    )
  }

  // 2. Construit le ZIP — service-role pour bypass RLS sur les downloads
  // (RLS déjà appliquée lors de l'aggregation supabase + orgId vérifié).
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const zip = new JSZip()
  const exportedAt = new Date()

  zip.file(
    'README.txt',
    [
      'Archive KOVAS — Mes fichiers',
      '============================',
      `Date export : ${exportedAt.toLocaleString('fr-FR')}`,
      `Total fichiers : ${total}`,
      '',
      `Filtres appliqués :`,
      `  type       : ${query.kind}`,
      `  période    : ${query.period}`,
      `  client     : ${query.clientId ?? '—'}`,
      `  diagnostic : ${query.diagnostic}`,
      `  recherche  : ${query.q ?? '—'}`,
      '',
      'Arborescence :',
      '  - 1 sous-dossier par dossier (référence DOS-XXXX)',
      '  - 1 sous-sous-dossier par type (photos / audio / documents / exports)',
      '  - Fichiers sans dossier rattaché : _sans_dossier/',
    ].join('\n'),
  )

  // 3. Téléchargement séquentiel (parallèle = trop de mémoire sur Vercel free)
  let totalDownloaded = 0
  for (const file of files) {
    if (!file.storage_path) continue

    const folder = file.dossier_reference ?? '_sans_dossier'
    const kindFolder = KIND_FOLDER[file.kind]
    const path = `${folder}/${kindFolder}/${file.name}`

    try {
      const { data: blob } = await admin.storage.from(file.bucket).download(file.storage_path)
      if (!blob) continue

      const buffer = Buffer.from(await blob.arrayBuffer())
      totalDownloaded += buffer.byteLength

      if (totalDownloaded > MAX_TOTAL_BYTES) {
        return NextResponse.json(
          {
            error: `Volume téléchargé > 500 MB en cours d'export. Affinez les filtres.`,
          },
          { status: 413 },
        )
      }

      zip.file(path, buffer)
    } catch {
      // best-effort : un fichier supprimé du Storage ne doit pas casser le ZIP entier
      continue
    }
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const stamp = exportedAt.toISOString().slice(0, 10)
  const filename = `kovas_archive_${stamp}.zip`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

// Petit helper pour vérifier compatibilité enum kind si élargi plus tard
export type ArchiveExportFile = ArchiveFile
