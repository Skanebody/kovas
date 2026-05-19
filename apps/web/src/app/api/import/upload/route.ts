import { randomUUID } from 'node:crypto'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
  IMPORT_LIMITS,
  type ImportSourceFormat,
  SOURCE_LOGICIELS,
  type SourceLogiciel,
  type UploadResponse,
} from '@/lib/import/types'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * POST /api/import/upload
 *
 * Reçoit un fichier multipart/form-data (champ `file`) exporté par
 * l'utilisateur depuis son logiciel diag (art. 20 RGPD), le stocke dans
 * le bucket privé `import-liciel-staging` (nom technique historique
 * conservé — voir migration 20260520150000) et crée un row `import_jobs`
 * avec status='uploaded' prêt à être parsé.
 *
 * Champs form-data attendus :
 *   - file : binaire (csv/xlsx/xml/zip)
 *   - source_logiciel : 'liciel' | 'analysimmo' | 'obbc' | 'oris' | 'autre'
 *                       (défaut 'autre' si absent)
 *
 * Conventions storage : `<orgId>/<uuid>.<ext>`.
 *
 * Cf. CLAUDE.md §13 (stratégie défensive logiciels concurrents) — pas de
 * scraping, c'est l'utilisateur qui exporte lui-même.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

const EXT_TO_FORMAT: Record<string, ImportSourceFormat> = {
  csv: 'csv',
  xlsx: 'xlsx',
  xls: 'xlsx',
  xml: 'xml',
  zip: 'zip-pdfs',
}

const ACCEPTED_MIME_SET = new Set<string>(ACCEPTED_MIME_TYPES)
const ACCEPTED_EXT_SET = new Set<string>(ACCEPTED_EXTENSIONS.map((e) => e.replace(/^\./, '')))
const VALID_SOURCES = new Set<string>(SOURCE_LOGICIELS)

function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.')
  if (parts.length < 2) return ''
  return parts[parts.length - 1] ?? ''
}

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────
  let userId: string
  let orgId: string
  try {
    const u = await getCurrentUser()
    userId = u.user.id
    orgId = u.orgId
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // ── Parse multipart ───────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'invalid form data' }, { status: 400 })
  }
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing file' }, { status: 400 })
  }

  // ── Source logiciel (défaut 'autre' si absent ou invalide) ────────
  const rawSource = formData.get('source_logiciel')
  const sourceLogiciel: SourceLogiciel =
    typeof rawSource === 'string' && VALID_SOURCES.has(rawSource)
      ? (rawSource as SourceLogiciel)
      : 'autre'

  // ── Validation taille ─────────────────────────────────────────────
  if (file.size === 0) {
    return NextResponse.json({ error: 'fichier vide' }, { status: 400 })
  }
  if (file.size > IMPORT_LIMITS.MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: `Fichier trop volumineux (max ${IMPORT_LIMITS.MAX_FILE_SIZE_MB} Mo)`,
      },
      { status: 413 },
    )
  }

  // ── Validation extension + mime ───────────────────────────────────
  const ext = getExtension(file.name)
  if (!ACCEPTED_EXT_SET.has(ext)) {
    return NextResponse.json(
      {
        error: `Extension non supportée : .${ext || '(aucune)'}. Attendus : ${ACCEPTED_EXTENSIONS.join(', ')}`,
      },
      { status: 400 },
    )
  }

  const sourceFormat: ImportSourceFormat | null = EXT_TO_FORMAT[ext] ?? null
  // Mime : on accepte aussi un mime vide/inconnu si l'extension matche
  // (Safari/Edge envoient parfois '' ou 'application/octet-stream' sur des CSV).
  const mimeType = file.type || 'application/octet-stream'
  if (file.type && !ACCEPTED_MIME_SET.has(file.type) && file.type !== 'application/octet-stream') {
    return NextResponse.json(
      {
        error: `Type MIME non supporté : ${file.type}`,
      },
      { status: 400 },
    )
  }

  // ── Upload Storage via service-role ───────────────────────────────
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const fileUuid = randomUUID()
  const storagePath = `${orgId}/${fileUuid}.${ext}`

  let buffer: Buffer
  try {
    buffer = Buffer.from(await file.arrayBuffer())
  } catch {
    return NextResponse.json({ error: 'lecture fichier échouée' }, { status: 500 })
  }

  // NOTE : nom du bucket conservé pour éviter une migration storage destructrice
  // (cf. migration 20260520150000_import_multi_source.sql). Invisible côté UI.
  const { error: uploadError } = await admin.storage
    .from('import-liciel-staging')
    .upload(storagePath, buffer, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: `Upload Storage : ${uploadError.message}` }, { status: 500 })
  }

  // ── Insert import_jobs ────────────────────────────────────────────
  // Note : `import_jobs` n'est pas encore dans le types generator (migration
  // toute fraîche). On contourne via `as never` — pattern utilisé ailleurs
  // dans le repo (cf. apps/web/src/app/app/dossiers/[id]/actions.ts).
  const insertPayload = {
    organization_id: orgId,
    created_by: userId,
    status: 'uploaded',
    source_logiciel: sourceLogiciel,
    source_filename: file.name.slice(0, 255),
    source_filesize_bytes: file.size,
    source_storage_path: storagePath,
    source_mime_type: mimeType,
    source_format: sourceFormat,
  }

  const { data: job, error: insertError } = await admin
    .from('import_jobs')
    .insert(insertPayload as never)
    .select('id')
    .single<{ id: string }>()

  if (insertError || !job) {
    // Cleanup storage si insert DB échoue
    await admin.storage.from('import-liciel-staging').remove([storagePath])
    return NextResponse.json(
      { error: insertError?.message ?? 'insert job failed' },
      { status: 500 },
    )
  }

  const response: UploadResponse = {
    job_id: job.id,
    filename: file.name,
    filesize: file.size,
    format: sourceFormat,
    source_logiciel: sourceLogiciel,
  }
  return NextResponse.json(response, { status: 201 })
}
