import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

/**
 * Service Worker KOVAS PWA — Serwist
 * Cf. /docs/pwa-pivot-decision.md §5 (PWA Phase 1, apps natives V2)
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
})

serwist.addEventListeners()

// Periodic background sync (every 5 days) — bretelle 2 du pivot PWA
// (PWA pivot decision §4 — persistance iPadOS)
self.addEventListener('periodicsync', ((
  event: Event & { tag: string; waitUntil: (p: Promise<unknown>) => void },
) => {
  if (event.tag === 'kovas-sync-5days') {
    event.waitUntil(syncOfflineQueue())
  }
}) as EventListener)

async function syncOfflineQueue(): Promise<void> {
  // TODO Task 3.3 sprint MVP J10 : drain outbox IndexedDB Dexie + sync Supabase
  // eslint-disable-next-line no-console
  console.log('[SW] Periodic sync triggered — outbox drain à implémenter')
}
