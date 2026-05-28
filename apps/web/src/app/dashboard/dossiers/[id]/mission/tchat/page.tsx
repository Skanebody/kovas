/**
 * KOVAS — Mode mission tchat IA (FIX-JJ, route /dashboard/dossiers/[id]/mission/tchat).
 *
 * Interface conversationnelle pleine page style WhatsApp/iMessage où un bot IA
 * pose les questions de saisie diagnostic une par une (pièce, surface, etc.)
 * et le diagnostiqueur répond en vocal (Web Speech API) ou texte.
 *
 * Server Component coquille :
 *   1. Vérifie que l'user est bien propriétaire du dossier (RLS via getCurrentUser)
 *   2. Vérifie qu'une mission_session active existe (sinon en démarre une)
 *   3. Charge dossier + client + bien + rooms existantes pour pré-remplir le contexte
 *   4. Délègue le rendu à <MissionTchatInterface> client
 *
 * Le mode tchat est INDÉPENDANT de la capture-screen photo-first (route /mission)
 * — c'est un mode alternatif "conversation IA" dédié aux diagnostiqueurs qui
 * préfèrent une saisie guidée par questions plutôt qu'une UI photo géante.
 *
 * Authority : CLAUDE.md §3 features 1 (saisie vocale terrain) + 10 (offline).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { MissionTchatInterface } from './mission-tchat-interface'

export const metadata: Metadata = {
  title: 'Mode mission — Tchat IA',
  // Empêche les robots d'indexer (route privée terrain).
  robots: { index: false, follow: false },
}

type SupabaseLike = Awaited<ReturnType<typeof getCurrentUser>>['supabase']

interface ActiveSession {
  id: string
  started_at: string
  paused_at: string | null
}

async function getOrCreateActiveSession(
  supabase: SupabaseLike,
  orgId: string,
  userId: string,
  dossierId: string,
): Promise<ActiveSession | null> {
  const { data: existing } = await supabase
    .from('mission_sessions' as never)
    .select('id, started_at, paused_at, ended_at')
    .eq('dossier_id', dossierId)
    .eq('organization_id', orgId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const active = existing as unknown as ActiveSession | null
  if (active) return active

  // Auto-bootstrap : on démarre la session si l'user atterrit ici sans en avoir
  // déjà créé une (cas direct URL ou Cmd+M depuis n'importe où).
  const nowIso = new Date().toISOString()
  const { data: insertedRaw } = await supabase
    .from('mission_sessions' as never)
    .insert({
      organization_id: orgId,
      dossier_id: dossierId,
      started_at: nowIso,
      created_by: userId,
    } as never)
    .select('id, started_at, paused_at')
    .single()

  if (!insertedRaw) return null

  // Met le dossier en mode "on_site" + pose mission_started_at si pas déjà fait.
  await supabase
    .from('dossiers')
    .update({
      mission_started_at: nowIso,
      started_at: nowIso,
      status: 'on_site',
    } as never)
    .eq('id', dossierId)
    .eq('organization_id', orgId)
    .is('mission_started_at', null)

  await supabase
    .from('dossiers')
    .update({ status: 'on_site' } as never)
    .eq('id', dossierId)
    .eq('organization_id', orgId)

  return insertedRaw as unknown as ActiveSession
}

export default async function MissionTchatPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, orgId, user } = await getCurrentUser()

  // Charge dossier + client + bien — RLS garantit l'appartenance org.
  const { data: dossier } = await supabase
    .from('dossiers')
    .select(
      'id, reference, status, scheduled_at, started_at, completed_at, properties(address, postal_code, city, surface_total, year_built, property_type), clients(display_name)',
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single()

  if (!dossier) notFound()

  // Lecture seule si dossier déjà terminé/archivé.
  if (dossier.status === 'done' || dossier.status === 'archived') {
    redirect(`/dashboard/dossiers/${id}?mode=readonly`)
  }

  const property = Array.isArray(dossier.properties) ? dossier.properties[0] : dossier.properties
  const client = Array.isArray(dossier.clients) ? dossier.clients[0] : dossier.clients

  const fullAddress = property
    ? [property.address, [property.postal_code, property.city].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ')
    : 'Adresse à compléter'

  // Charge ou démarre une session — si null, échec côté DB.
  const session = await getOrCreateActiveSession(supabase, orgId, user.id, id)
  if (!session) {
    // En cas d'échec, on renvoie vers le hub dossier qui affichera l'erreur.
    redirect(`/dashboard/dossiers/${id}?session_error=1`)
  }

  // Charge les rooms déjà saisies (reprise après pause).
  const { data: rooms } = await supabase
    .from('dossier_rooms')
    .select('id, name, room_type, surface_m2, position')
    .eq('dossier_id', id)
    .eq('organization_id', orgId)
    .order('position', { ascending: true })

  // Charge les éléments (équipements/observations/mesures) déjà saisis par pièce
  // pour la reprise après pause/refresh (Phase 2 "tous les éléments").
  // La table mission_room_items n'est pas encore reflétée dans les types générés
  // (migration récente) → cast `as never`. TODO : régénérer les types après
  // application de 20260528100000_mission_room_items.sql.
  type RoomItemRow = {
    id: string
    dossier_room_id: string
    kind: string
    label: string
    data: Record<string, unknown> | null
    client_local_id: string | null
    created_at: string
  }
  const roomIds = (rooms ?? []).map((r) => r.id as string)
  let roomItemRows: RoomItemRow[] = []
  if (roomIds.length > 0) {
    const itemsRes = await supabase
      .from('mission_room_items' as never)
      .select('id, dossier_room_id, kind, label, data, client_local_id, created_at')
      .in('dossier_room_id', roomIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    roomItemRows = Array.isArray(itemsRes.data) ? (itemsRes.data as unknown as RoomItemRow[]) : []
  }
  // Regroupe par pièce. L'id exposé au client = client_local_id si présent
  // (id canonique côté state + clé de suppression DB), sinon l'UUID DB.
  const itemsByRoom = new Map<
    string,
    Array<{
      id: string
      kind: 'equipment' | 'observation' | 'measurement'
      label: string
      data: Record<string, unknown>
      createdAt: number
    }>
  >()
  for (const row of roomItemRows) {
    if (row.kind !== 'equipment' && row.kind !== 'observation' && row.kind !== 'measurement') {
      continue
    }
    const list = itemsByRoom.get(row.dossier_room_id) ?? []
    list.push({
      id: row.client_local_id ?? row.id,
      kind: row.kind,
      label: row.label,
      data: row.data ?? {},
      createdAt: new Date(row.created_at).getTime(),
    })
    itemsByRoom.set(row.dossier_room_id, list)
  }

  // Charge l'historique conversation pour reprise au refresh.
  // Fusionne 2 sources (cf. audit P0-4 mode mission) :
  //   - mission_chat_messages : messages user/assistant en mode Conversation IA
  //   - mission_text_notes    : notes silencieuses du mode Capture (sinon
  //     elles disparaissaient au refresh)
  type ChatRow = { id: string; role: string; content: string; created_at: string }
  const [chatRes, notesRes] = await Promise.all([
    supabase
      .from('mission_chat_messages' as never)
      .select('id, role, content, created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
      .limit(60),
    supabase
      .from('mission_text_notes' as never)
      .select('id, text, created_at')
      .eq('dossier_id', id)
      .order('created_at', { ascending: true })
      .limit(120),
  ])
  const chatRows: ChatRow[] = Array.isArray(chatRes.data)
    ? (chatRes.data as unknown as ChatRow[])
    : []
  const textNoteRows: Array<{ id: string; text: string; created_at: string }> = Array.isArray(
    notesRes.data,
  )
    ? (notesRes.data as unknown as Array<{ id: string; text: string; created_at: string }>)
    : []
  // Les notes capture-mode sont mappées en rôle 'user' (ce sont des inputs user
  // silencieux, pas des réponses IA). On fusionne et tri par created_at.
  const chatHistory: ChatRow[] = [
    ...chatRows,
    ...textNoteRows.map((n) => ({
      id: `note-${n.id}`,
      role: 'user' as const,
      content: n.text,
      created_at: n.created_at,
    })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at))

  // Charge nb photos + nb notes vocales pour la footer "stats".
  const [{ count: photosCount }, { count: voiceCount }] = await Promise.all([
    supabase
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .eq('dossier_id', id)
      .eq('organization_id', orgId),
    supabase
      .from('voice_notes')
      .select('id', { count: 'exact', head: true })
      .eq('dossier_id', id)
      .eq('organization_id', orgId),
  ])

  return (
    <MissionTchatInterface
      dossierId={dossier.id}
      orgId={orgId}
      reference={dossier.reference}
      clientName={client?.display_name ?? 'Client à définir'}
      fullAddress={fullAddress}
      sessionId={session.id}
      sessionStartedAt={session.started_at}
      sessionPausedAt={session.paused_at}
      existingRooms={(rooms ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        roomType: (r.room_type as string | null) ?? null,
        surfaceM2: (r.surface_m2 as number | null) ?? null,
        items: itemsByRoom.get(r.id as string) ?? [],
      }))}
      initialStats={{
        photos: photosCount ?? 0,
        voiceNotes: voiceCount ?? 0,
      }}
      propertyMeta={
        property
          ? {
              surface: property.surface_total ?? null,
              yearBuilt: property.year_built ?? null,
              propertyType: (property.property_type as string | null) ?? null,
            }
          : null
      }
      initialChatHistory={chatHistory.map((c) => ({
        id: c.id,
        role: (c.role === 'user' || c.role === 'assistant' || c.role === 'system'
          ? c.role
          : 'assistant') as 'user' | 'assistant' | 'system',
        content: c.content,
        createdAt: c.created_at,
      }))}
    />
  )
}
