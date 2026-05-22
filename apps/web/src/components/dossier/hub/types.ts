import type { MissionType } from '@kovas/shared'

/**
 * Types partagés entre les sections du Hub Dossier.
 * Reflètent les données chargées par le Server Component parent (`page.tsx`).
 */

export interface HubDossier {
  id: string
  reference: string
  status: string
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  notes: string | null
  metadata: Record<string, unknown> | null
  client_id: string | null
  property_id: string
  client_upload_token: string | null
  client_upload_expires_at: string | null
}

export interface HubClient {
  id: string | null
  display_name: string | null
  email: string | null
  phone: string | null
}

export interface HubProperty {
  id: string
  address: string | null
  postal_code: string | null
  city: string | null
  surface_total: number | null
  year_built: number | null
  property_type: string | null
}

export interface HubMission {
  id: string
  reference: string
  type: MissionType
  status: string
  completed_at: string | null
}

export interface HubRoom {
  id: string
  name: string | null
  room_type: string | null
  surface_m2: number | null
}

export interface HubPhotoMini {
  id: string
  storage_path: string
  taken_at: string | null
  room_id: string | null
}

export interface HubVoiceNoteMini {
  id: string
  transcript_raw: string | null
  ai_confidence: number | null
  parser_used: string | null
  duration_seconds: number | null
  created_at: string
}

export interface HubOwnerDocMini {
  id: string
  doc_kind: string | null
  original_name: string | null
  uploaded_at: string | null
  extraction_status: string | null
}
