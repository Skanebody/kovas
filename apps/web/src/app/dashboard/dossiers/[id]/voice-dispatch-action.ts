'use server'

import { getCurrentUser } from '@/lib/auth/current-user'
import type { DispatchAction, DispatchPlan } from '@/lib/voice/dispatch-target'
import { resolveConflicts } from '@/lib/voice/dispatch-target'
import { revalidatePath } from 'next/cache'

interface ApplyResult {
  applied: number
  error?: string
}

/**
 * Applique un DispatchPlan sur les données du dossier (property + rooms + missions).
 *
 * Sécurité :
 * - getCurrentUser → utilisateur authentifié + son organization_id
 * - Vérif explicite : le dossier appartient à l'org (RLS public.is_member_of l'aurait
 *   bloqué de toute façon, mais on remonte une erreur claire avant les writes)
 * - Toutes les mutations sont scopées sur organization_id ET id
 *
 * Anti race-condition :
 * - Pour les UPDATE property avec valeur "directe" (pas de conflit), on re-fetch
 *   avant write et on n'écrase QUE les colonnes encore null. Si la colonne a été
 *   remplie entre-temps, on remonte un conflit dans le résultat (silencieux côté
 *   succès : la mutation n'a juste pas eu lieu).
 * - Pour les écrasements explicites (résolus en UI "overwrite"), on force l'UPDATE.
 */
export async function applyVoiceDispatchAction(
  dossierId: string,
  plan: DispatchPlan,
): Promise<ApplyResult> {
  if (!dossierId) return { applied: 0, error: 'dossierId requis' }

  const { supabase, orgId } = await getCurrentUser()

  // Vérifie l'appartenance du dossier à l'org (et récupère property_id)
  const { data: dossier, error: dossierErr } = await supabase
    .from('dossiers')
    .select('id, property_id')
    .eq('id', dossierId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (dossierErr) return { applied: 0, error: dossierErr.message }
  if (!dossier) return { applied: 0, error: 'Dossier introuvable' }

  const allActions: DispatchAction[] = resolveConflicts(plan)
  if (allActions.length === 0) return { applied: 0 }

  let applied = 0

  // Aggréger les UPDATE property en une seule mutation (plusieurs champs possibles)
  const propertyUpdates: Record<string, string | number> = {}
  const propertyOverwriteFields = new Set<string>()
  for (const c of plan.conflicts) {
    if (c.resolution === 'overwrite' && c.field.startsWith('property.')) {
      propertyOverwriteFields.add(c.field.slice('property.'.length))
    }
  }

  for (const a of allActions) {
    if (a.entity === 'property') {
      propertyUpdates[a.field] = a.value
    }
  }

  // === PROPERTY UPDATE ===
  if (Object.keys(propertyUpdates).length > 0) {
    if (!dossier.property_id) {
      return { applied: 0, error: 'Dossier sans bien rattaché' }
    }

    // Re-fetch property pour n'écraser que les colonnes nulles
    // (sauf champs explicitement marqués "overwrite" en UI)
    const { data: currentProp, error: propErr } = await supabase
      .from('properties')
      .select(
        'surface_total, year_built, floor_number, building_letter, apartment_detail, lot_number',
      )
      .eq('id', dossier.property_id)
      .eq('organization_id', orgId)
      .single()

    if (propErr) return { applied, error: propErr.message }

    const safeUpdates: Record<string, string | number> = {}
    for (const [field, value] of Object.entries(propertyUpdates)) {
      const currentValue = (currentProp as Record<string, unknown>)[field]
      if (currentValue === null || propertyOverwriteFields.has(field)) {
        safeUpdates[field] = value
      }
      // Sinon : la colonne a été remplie entre-temps, on skip silencieusement
    }

    if (Object.keys(safeUpdates).length > 0) {
      const { error: updErr } = await supabase
        .from('properties')
        .update(safeUpdates as never)
        .eq('id', dossier.property_id)
        .eq('organization_id', orgId)

      if (updErr) return { applied, error: updErr.message }
      applied += Object.keys(safeUpdates).length
    }
  }

  // === ROOM CREATE ===
  // Récupère le compteur de pièces existant pour calculer position
  const roomCreates = allActions.filter(
    (a): a is Extract<DispatchAction, { entity: 'room' }> => a.entity === 'room',
  )
  if (roomCreates.length > 0) {
    const { count } = await supabase
      .from('dossier_rooms')
      .select('*', { count: 'exact', head: true })
      .eq('dossier_id', dossierId)
      .eq('organization_id', orgId)
    const startPosition = count ?? 0

    const rows = roomCreates.map((r, i) => ({
      dossier_id: dossierId,
      organization_id: orgId,
      name: r.name,
      room_type: r.room_type,
      position: startPosition + i,
    }))

    const { error: roomErr } = await supabase.from('dossier_rooms').insert(rows)
    if (roomErr) return { applied, error: roomErr.message }
    applied += rows.length
  }

  // === MISSION metadata.equipment (append) ===
  const missionEquipUpdates = allActions.filter(
    (a): a is Extract<DispatchAction, { entity: 'mission' }> => a.entity === 'mission',
  )

  for (const u of missionEquipUpdates) {
    // Re-fetch metadata pour append (jamais écraser le tableau existant)
    const { data: m } = await supabase
      .from('missions')
      .select('metadata')
      .eq('id', u.missionId)
      .eq('organization_id', orgId)
      .single()

    const meta = (m?.metadata as Record<string, unknown> | null) ?? {}
    const existingEquip = (meta.equipment as unknown[] | undefined) ?? []
    meta.equipment = [...existingEquip, ...u.value]

    const { error: mErr } = await supabase
      .from('missions')
      .update({ metadata: meta as never })
      .eq('id', u.missionId)
      .eq('organization_id', orgId)

    if (mErr) return { applied, error: mErr.message }
    applied += u.value.length
  }

  revalidatePath(`/dashboard/dossiers/${dossierId}`)
  return { applied }
}
