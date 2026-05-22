'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/**
 * Hook Realtime pour la page Dossier Hub.
 * S'abonne aux tables dossiers/missions/photos/voice_notes/owner_documents/dossier_rooms
 * filtrées par dossier_id, et déclenche un router.refresh() débouncé (800ms).
 *
 * Expose également `pulse` (incrémenté à chaque event) pour animations de feedback
 * subtiles côté UI (`useEffect(() => fade(...), [pulse])`).
 */
export function useDossierRealtime(dossierId: string): { pulse: number; lastEvent: string | null } {
  const router = useRouter()
  const lastRefresh = useRef(0)
  const [pulse, setPulse] = useState(0)
  const [lastEvent, setLastEvent] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    function debouncedRefresh(table: string) {
      setPulse((p) => p + 1)
      setLastEvent(table)
      const now = Date.now()
      if (now - lastRefresh.current < 800) return
      lastRefresh.current = now
      router.refresh()
    }

    const channel = supabase
      .channel(`dossier-hub-${dossierId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dossiers', filter: `id=eq.${dossierId}` },
        () => debouncedRefresh('dossiers'),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'missions', filter: `dossier_id=eq.${dossierId}` },
        () => debouncedRefresh('missions'),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dossier_rooms',
          filter: `dossier_id=eq.${dossierId}`,
        },
        () => debouncedRefresh('rooms'),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos', filter: `dossier_id=eq.${dossierId}` },
        () => debouncedRefresh('photos'),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voice_notes',
          filter: `dossier_id=eq.${dossierId}`,
        },
        () => debouncedRefresh('voice_notes'),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'owner_documents',
          filter: `dossier_id=eq.${dossierId}`,
        },
        () => debouncedRefresh('owner_documents'),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [dossierId, router])

  return { pulse, lastEvent }
}
