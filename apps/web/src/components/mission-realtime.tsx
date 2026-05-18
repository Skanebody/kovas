'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Subscribe aux changements Realtime sur les tables liées à une mission.
 * Trigger un router.refresh() à chaque mutation détectée.
 *
 * Tables surveillées : mission_rooms, photos, voice_notes, owner_documents, missions.
 * Cf. tools/enable-realtime.mjs pour l'activation des publications.
 */
export function MissionRealtime({ missionId }: { missionId: string }) {
  const router = useRouter()
  const lastRefresh = useRef(0)

  useEffect(() => {
    const supabase = createClient()

    function debouncedRefresh() {
      const now = Date.now()
      // Évite de spammer le serveur — minimum 800ms entre 2 refresh
      if (now - lastRefresh.current < 800) return
      lastRefresh.current = now
      router.refresh()
    }

    const channel = supabase
      .channel(`mission-${missionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mission_rooms', filter: `mission_id=eq.${missionId}` },
        debouncedRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos', filter: `mission_id=eq.${missionId}` },
        debouncedRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'voice_notes', filter: `mission_id=eq.${missionId}` },
        debouncedRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'missions', filter: `id=eq.${missionId}` },
        debouncedRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'owner_documents', filter: `mission_id=eq.${missionId}` },
        debouncedRefresh,
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [missionId, router])

  return null
}
