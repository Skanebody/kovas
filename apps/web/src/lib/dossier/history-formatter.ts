/**
 * KOVAS — Formateur d'historique d'un dossier (refonte page dossier).
 *
 * Authority : CLAUDE.md §3 + spec refonte UI dossier (HistoryAccordion).
 *
 * Deux signatures exposées :
 *   1. `buildDossierHistory(input, options)` — version pure (DI explicite),
 *      utilisée par l'API route /api/dossiers/[id]/history.
 *   2. `buildDossierHistoryFromSupabase(supabase, dossierId)` — version "tout-en-un"
 *      qui charge toutes les sources via Supabase puis délègue à la version pure.
 *
 * Agrège plusieurs sources en une timeline unifiée :
 *   - dossier.created_at + validated_at
 *   - mission_sessions (started/paused/ended)
 *   - photos / voice_notes
 *   - dossier_field_value_history (éditions manuelles)
 *   - dossier_exports
 */

import type { HistoryItem, HistoryItemType } from '@/lib/dossier/types'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// Input shape (pour signature pure)
// ============================================

export interface DossierHistoryInput {
  dossier: {
    id: string
    created_at: string
    mission_started_at: string | null
    validated_at: string | null
    status: string
  }
  sessions: Array<{
    id: string
    started_at: string
    paused_at: string | null
    ended_at: string | null
  }>
  photos: Array<{ id: string; created_at: string; room_id: string | null }>
  voiceNotes: Array<{ id: string; created_at: string; room_id: string | null }>
  fieldEdits: Array<{
    id: string
    field_path: string
    manually_edited_at: string | null
  }>
  exports: Array<{
    id: string
    destination: string
    created_at: string
    was_complete: boolean
  }>
}

export interface BuildHistoryOptions {
  limit: number
  before?: string
}

export interface DossierHistoryResult {
  items: HistoryItem[]
  hasMore: boolean
}

const DESTINATION_LABEL: Record<string, string> = {
  liciel_zip: 'ZIP Liciel',
  pdf_reports: 'Rapports PDF',
  client_email: 'Email client',
  archive: 'Archive',
  raw_json_csv: 'JSON / CSV',
}

function makeId(prefix: string, ts: string, idx: number, suffix?: string): string {
  return suffix ? `${prefix}-${ts}-${idx}-${suffix}` : `${prefix}-${ts}-${idx}`
}

/**
 * Version pure (sans I/O). Combine toutes les sources en une timeline triée ASC,
 * applique le filtre `before` et le `limit`. Retourne aussi hasMore pour pagination.
 */
export function buildDossierHistory(
  input: DossierHistoryInput,
  options: BuildHistoryOptions,
): DossierHistoryResult {
  const items: HistoryItem[] = []

  // 1. Création du dossier
  items.push({
    id: `created-${input.dossier.id}`,
    type: 'created',
    label: 'Dossier créé',
    ts: input.dossier.created_at,
  })

  // 2. Validation du dossier
  if (input.dossier.validated_at) {
    items.push({
      id: `validated-${input.dossier.id}`,
      type: 'status_change',
      label: 'Dossier validé',
      ts: input.dossier.validated_at,
    })
  }

  // 3. Sessions (started/paused/ended)
  input.sessions.forEach((s, idx) => {
    items.push({
      id: makeId('session-start', s.started_at, idx, s.id),
      type: 'status_change',
      label: 'Mission démarrée',
      ts: s.started_at,
    })
    if (s.paused_at) {
      items.push({
        id: makeId('session-pause', s.paused_at, idx, s.id),
        type: 'status_change',
        label: 'Mission en pause',
        ts: s.paused_at,
      })
    }
    if (s.ended_at) {
      items.push({
        id: makeId('session-end', s.ended_at, idx, s.id),
        type: 'status_change',
        label: 'Mission terminée',
        ts: s.ended_at,
      })
    }
  })

  // 4. Photos
  input.photos.forEach((p, idx) => {
    items.push({
      id: makeId('photo', p.created_at, idx, p.id),
      type: 'photo',
      label: 'Photo ajoutée',
      ts: p.created_at,
    })
  })

  // 5. Voice notes
  input.voiceNotes.forEach((v, idx) => {
    items.push({
      id: makeId('voice', v.created_at, idx, v.id),
      type: 'voice',
      label: 'Note vocale ajoutée',
      ts: v.created_at,
    })
  })

  // 6. Edits manuels
  input.fieldEdits.forEach((f, idx) => {
    if (!f.manually_edited_at) return
    items.push({
      id: makeId('field-edit', f.manually_edited_at, idx, f.id),
      type: 'updated',
      label: `Champ édité : ${f.field_path}`,
      ts: f.manually_edited_at,
    })
  })

  // 7. Exports
  input.exports.forEach((e, idx) => {
    const destLabel = DESTINATION_LABEL[e.destination] ?? e.destination
    const completeMarker = e.was_complete ? '' : ' (incomplet)'
    items.push({
      id: makeId('export', e.created_at, idx, e.id),
      type: 'export',
      label: `Export ${destLabel}${completeMarker}`,
      ts: e.created_at,
    })
  })

  // 8. Tri DESC (plus récent en premier) — UX timeline classique
  items.sort((a, b) => b.ts.localeCompare(a.ts))

  // 9. Filtre `before` (cursor pagination)
  const filtered = options.before ? items.filter((i) => i.ts < (options.before as string)) : items

  const limited = filtered.slice(0, options.limit)
  return {
    items: limited,
    hasMore: filtered.length > limited.length,
  }
}

// ============================================
// Version "tout-en-un" — charge les sources via Supabase
// ============================================

interface RawDossierMeta {
  id: string
  created_at: string
  mission_started_at: string | null
  validated_at: string | null
  status: string
}

interface RawSession {
  id: string
  started_at: string
  ended_at: string | null
  paused_at: string | null
}

interface RawPhotoRow {
  id: string
  created_at: string
  room_id: string | null
}

interface RawVoiceRow {
  id: string
  created_at: string
  room_id: string | null
}

interface RawFieldValueWithEdit {
  id: string
  field_path: string
  manually_edited_at: string | null
}

interface RawExport {
  id: string
  destination: string
  created_at: string
  was_complete: boolean
}

/**
 * Version "tout-en-un" — charge toutes les sources puis appelle `buildDossierHistory`.
 * Retourne `HistoryItem[]` (plat) au lieu du wrapper {items, hasMore} pour matcher
 * la signature demandée par la spec refonte page dossier.
 *
 * Pas de pagination : la version tout-en-un est destinée à un affichage complet
 * (drawer ou page dédiée). Pour la pagination, utiliser la signature pure.
 */
export async function buildDossierHistoryFromSupabase(
  supabase: SupabaseClient,
  dossierId: string,
): Promise<HistoryItem[]> {
  const { data: dossierRaw } = await supabase
    .from('dossiers')
    .select('id, created_at, mission_started_at, validated_at, status')
    .eq('id', dossierId)
    .maybeSingle()

  if (!dossierRaw) return []
  const dossier = dossierRaw as RawDossierMeta

  const [
    { data: sessionsRaw },
    { data: photosRaw },
    { data: voicesRaw },
    { data: fieldValuesRaw },
    { data: exportsRaw },
  ] = await Promise.all([
    supabase
      .from('mission_sessions')
      .select('id, started_at, ended_at, paused_at')
      .eq('dossier_id', dossierId),
    supabase.from('photos').select('id, created_at, room_id').eq('dossier_id', dossierId),
    supabase.from('voice_notes').select('id, created_at, room_id').eq('dossier_id', dossierId),
    supabase
      .from('dossier_field_values')
      .select('id, field_path, manually_edited_at')
      .eq('dossier_id', dossierId)
      .not('manually_edited_at', 'is', null),
    supabase
      .from('dossier_exports')
      .select('id, destination, created_at, was_complete')
      .eq('dossier_id', dossierId),
  ])

  const input: DossierHistoryInput = {
    dossier: {
      id: dossier.id,
      created_at: dossier.created_at,
      mission_started_at: dossier.mission_started_at,
      validated_at: dossier.validated_at,
      status: dossier.status,
    },
    sessions: ((sessionsRaw ?? []) as RawSession[]).map((s) => ({
      id: s.id,
      started_at: s.started_at,
      paused_at: s.paused_at,
      ended_at: s.ended_at,
    })),
    photos: ((photosRaw ?? []) as RawPhotoRow[]).map((p) => ({
      id: p.id,
      created_at: p.created_at,
      room_id: p.room_id,
    })),
    voiceNotes: ((voicesRaw ?? []) as RawVoiceRow[]).map((v) => ({
      id: v.id,
      created_at: v.created_at,
      room_id: v.room_id,
    })),
    fieldEdits: ((fieldValuesRaw ?? []) as RawFieldValueWithEdit[]).map((f) => ({
      id: f.id,
      field_path: f.field_path,
      manually_edited_at: f.manually_edited_at,
    })),
    exports: ((exportsRaw ?? []) as RawExport[]).map((e) => ({
      id: e.id,
      destination: e.destination,
      created_at: e.created_at,
      was_complete: e.was_complete,
    })),
  }

  // Limite "infinie" pour la version tout-en-un
  const result = buildDossierHistory(input, { limit: Number.MAX_SAFE_INTEGER })
  return result.items
}

export type { HistoryItem, HistoryItemType }
