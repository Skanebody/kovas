/**
 * KOVAS — Archive (vue globale "Mes fichiers")
 *
 * Types partagés entre l'API route, la page server et les composants client.
 *
 * Sources agrégées :
 *   - photos              (bucket : mission-photos)
 *   - voice_notes         (bucket : voice-notes)
 *   - documents           (bucket : documents)
 *   - dossier_exports     (bucket : dossier-archives — exports PDF / ZIP Liciel)
 *
 * Cf. CLAUDE.md §10 RGPD + multi-tenant via organization_id + RLS.
 */

export type ArchiveFileKind = 'photo' | 'audio' | 'document' | 'export'

export type ArchiveDiagnostic =
  | 'dpe'
  | 'amiante'
  | 'plomb'
  | 'gaz'
  | 'electricite'
  | 'termites'
  | 'carrez'
  | 'erp'

/**
 * Représentation uniformisée d'un fichier dans la vue Archive.
 * `signed_url` est null tant que le payload n'a pas été enrichi (cas d'erreur Storage).
 */
export interface ArchiveFile {
  id: string
  kind: ArchiveFileKind
  /** Nom de fichier affichable (filename original ou dérivé du path) */
  name: string
  mime_type: string | null
  file_size_bytes: number | null
  created_at: string
  dossier_id: string | null
  dossier_reference: string | null
  signed_url: string | null
  /** Path Storage interne (utilisé côté serveur pour le ZIP bulk export) */
  storage_path: string
  /** Bucket Supabase Storage (pour génération signed URL ou download serveur) */
  bucket: 'mission-photos' | 'voice-notes' | 'documents' | 'dossier-archives'
}

export interface ArchiveListResponse {
  files: ArchiveFile[]
  total: number
  page: number
  hasMore: boolean
}

export interface ArchiveQuery {
  kind: ArchiveFileKind | 'all'
  /** Range période : 7d | 30d | 12m | 2025 | 2024 | 2023 | all */
  period: '7d' | '30d' | '12m' | '2025' | '2024' | '2023' | 'all'
  clientId: string | null
  diagnostic: ArchiveDiagnostic | 'all'
  q: string | null
  page: number
  limit: number
}

export const ARCHIVE_DEFAULT_LIMIT = 50

export const ARCHIVE_KIND_LABELS: Record<ArchiveFileKind, string> = {
  photo: 'Photo',
  audio: 'Audio',
  document: 'Document',
  export: 'Export PDF',
}

export const ARCHIVE_KIND_BADGE: Record<
  ArchiveFileKind,
  'blue' | 'orange' | 'green' | 'yellow'
> = {
  photo: 'blue',
  audio: 'orange',
  document: 'green',
  export: 'yellow',
}

export const ARCHIVE_DIAGNOSTIC_LABELS: Record<ArchiveDiagnostic, string> = {
  dpe: 'DPE',
  amiante: 'Amiante',
  plomb: 'Plomb',
  gaz: 'Gaz',
  electricite: 'Électricité',
  termites: 'Termites',
  carrez: 'Carrez',
  erp: 'ERP',
}
