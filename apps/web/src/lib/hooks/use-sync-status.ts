'use client'

import type { MutationRow } from '@/lib/sync/db'
import { listPending, pendingCount } from '@/lib/sync/queue'
import { useEffect, useState } from 'react'

/**
 * useSyncStatus — agrège l'état de fiabilité sync pour le badge header.
 *
 * Réutilise la queue offline existante (lib/sync/queue.ts) + navigator.onLine.
 * Pattern inspiré de l'Aarron Walter "Reliable Level 2" : indicateur de
 * fiabilité visible en permanence, détail accessible en 1 tap.
 *
 * États dérivés :
 *  - `offline` : navigator.onLine === false (réseau perdu)
 *  - `syncing` : pending > 0 ET online (mutations en vol ou queue à drainer)
 *  - `synced`  : pending === 0 ET online (tout est à jour)
 *
 * Refresh : polling toutes les 5s (aligné SyncIndicator existant) + écoute
 * de l'event custom `kovas:sync:complete` émis par le sync-manager.
 */

export type SyncState = 'synced' | 'syncing' | 'offline'

export interface UseSyncStatusOptions {
  organizationId: string
  /** Charge le détail des items pending (utilisé seulement quand popover ouvert). */
  fetchDetails?: boolean
}

export interface SyncStatusResult {
  state: SyncState
  isOnline: boolean
  pending: number
  items: MutationRow[]
}

export function useSyncStatus({
  organizationId,
  fetchDetails = false,
}: UseSyncStatusOptions): SyncStatusResult {
  const [isOnline, setIsOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [items, setItems] = useState<MutationRow[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Hydration + listeners navigator
  useEffect(() => {
    setHydrated(true)
    setIsOnline(navigator.onLine)

    function handleOnline(): void {
      setIsOnline(true)
    }
    function handleOffline(): void {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Polling pending count + event sync-complete
  useEffect(() => {
    if (!organizationId) return

    let cancelled = false

    function refresh(): void {
      void pendingCount(organizationId).then((n) => {
        if (!cancelled) setPending(n)
      })
    }

    refresh()
    const interval = window.setInterval(refresh, 5_000)

    function handleSyncComplete(): void {
      refresh()
    }
    window.addEventListener('kovas:sync:complete', handleSyncComplete)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('kovas:sync:complete', handleSyncComplete)
    }
  }, [organizationId])

  // Chargement détail items (à la demande). Refresh via event sync-complete
  // + polling court (1s) tant que le popover est ouvert — la queue peut bouger
  // sans event si une nouvelle mutation arrive depuis un autre composant.
  useEffect(() => {
    if (!fetchDetails || !organizationId) {
      setItems([])
      return
    }
    let cancelled = false

    function refresh(): void {
      void listPending(organizationId).then((rows) => {
        if (!cancelled) setItems(rows)
      })
    }

    refresh()
    const interval = window.setInterval(refresh, 1_000)
    window.addEventListener('kovas:sync:complete', refresh)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('kovas:sync:complete', refresh)
    }
  }, [fetchDetails, organizationId])

  // Avant hydration on assume online + synced (évite flicker SSR).
  const safeIsOnline = hydrated ? isOnline : true
  const state: SyncState = !safeIsOnline ? 'offline' : pending > 0 ? 'syncing' : 'synced'

  return { state, isOnline: safeIsOnline, pending, items }
}
