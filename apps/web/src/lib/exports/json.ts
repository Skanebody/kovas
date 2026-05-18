import type { MissionExportData } from './build-mission-data'

export function generateJson(data: MissionExportData): string {
  const exportPayload = {
    kovas_export_version: '1.0',
    exported_at: data.exportedAt,
    is_trial: data.isTrial,
    mission: data.mission,
    property: data.property,
    client: data.client,
    organization: data.organization,
    rooms: data.rooms,
    voice_notes: data.voiceNotes.map((v) => ({
      id: v.id,
      room_id: v.room_id,
      duration_seconds: v.duration_seconds,
      transcript: v.transcript_raw,
      structured: v.transcript_structured,
      created_at: v.created_at,
    })),
    photos_count: data.photos.length,
    owner_documents_count: data.ownerDocuments.length,
  }
  return JSON.stringify(exportPayload, null, 2)
}
