'use client'

/**
 * KOVAS — GC2 Mission Flow Continu : hook Realtime (Lot B89 polish round 1).
 *
 * S'abonne aux INSERT sur `mission_flow_events` et aux UPDATE sur
 * `mission_flow_states` filtrés par `mission_id`, et déclenche un
 * `router.refresh()` débouncé (800ms) à chaque event détecté.
 *
 * Expose également :
 *   - `pulse`       — compteur incrémenté à chaque event (animations subtiles)
 *   - `isConnected` — état du channel Realtime (true = SUBSCRIBED)
 *   - `lastEventAt` — timestamp ISO du dernier event reçu (heartbeat UI)
 *
 * Graceful degradation : si les vars d'env Supabase publiques sont absentes,
 * le hook se désactive silencieusement et retourne un état "non connecté".
 *
 * Authority : CLAUDE.md §10 + REFONTE-ACQUI-TARGET-V2 §6.2 (GC2).
 */

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export interface MissionFlowRealtimeState {
  /** Compteur incrémenté à chaque event Realtime reçu (utile pour useEffect d'animation) */
  pulse: number
  /** True si le channel Supabase Realtime est SUBSCRIBED */
  isConnected: boolean
  /** Timestamp ISO du dernier event reçu (null si aucun) */
  lastEventAt: string | null
}

const DEBOUNCE_MS = 800

export function useMissionFlowRealtime(missionId: string): MissionFlowRealtimeState {
  const router = useRouter()
  const lastRefresh = useRef(0)
  const [pulse, setPulse] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [lastEventAt, setLastEventAt] = useState<string | null>(null)

  useEffect(() => {
    // Graceful degradation si vars d'env absentes (build statique, preview, etc.)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return
    }

    if (!missionId) {
      return
    }

    let cancelled = false
    const supabase = createClient()

    function handleEvent() {
      if (cancelled) return
      setPulse((p) => p + 1)
      setLastEventAt(new Date().toISOString())

      const now = Date.now()
      if (now - lastRefresh.current < DEBOUNCE_MS) return
      lastRefresh.current = now
      router.refresh()
    }

    const channel = supabase
      .channel(`mission-flow-${missionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mission_flow_events',
          filter: `mission_id=eq.${missionId}`,
        },
        handleEvent,
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mission_flow_states',
          filter: `mission_id=eq.${missionId}`,
        },
        handleEvent,
      )
      .subscribe((status) => {
        if (cancelled) return
        setIsConnected(status === 'SUBSCRIBED')
      })

    return () => {
      cancelled = true
      setIsConnected(false)
      supabase.removeChannel(channel)
    }
  }, [missionId, router])

  return { pulse, isConnected, lastEventAt }
}
