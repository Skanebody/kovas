'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * Subscribe aux changements Realtime sur les tables liées à un dossier.
 * Trigger un router.refresh() à chaque mutation détectée.
 *
 * Tables surveillées : dossier_rooms, photos, voice_notes, owner_documents,
 * dossiers, missions (par dossier_id).
 * Le composant s'appelle MissionRealtime pour rétro-compat ; prop missionId
 * = dossierId désormais.
 */
export function MissionRealtime({ missionId }: { missionId: string }) {
  const router = useRouter()
  const lastRefresh = useRef(0)

  useEffect(() => {
    const supabase = createClient()
    const dossierId = missionId

    function debouncedRefresh() {
      const now = Date.now()
      if (now - lastRefresh.current < 800) return
      lastRefresh.current = now
      router.refresh()
    }

    const channel = supabase
      .channel(`dossier-${dossierId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dossier_rooms',
          filter: `dossier_id=eq.${dossierId}`,
        },
        debouncedRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos', filter: `dossier_id=eq.${dossierId}` },
        debouncedRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voice_notes',
          filter: `dossier_id=eq.${dossierId}`,
        },
        debouncedRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'owner_documents',
          filter: `dossier_id=eq.${dossierId}`,
        },
        debouncedRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'missions', filter: `dossier_id=eq.${dossierId}` },
        debouncedRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dossiers', filter: `id=eq.${dossierId}` },
        debouncedRefresh,
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [missionId, router])

  return null
}
