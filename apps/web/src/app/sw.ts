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
  // HORS-SCOPE P0-4 — vrai Background Sync API (drain depuis le Service Worker
  // même app FERMÉE).
  //
  // État actuel : le drain des photos mission pending tourne côté client React
  // via PhotosSyncManager.syncAllSessions(), monté en permanence dans le layout
  // dashboard (cf. GlobalPhotosSync.tsx). Cela couvre le cas terrain courant
  // (app KOVAS ouverte quand le réseau revient), mais PAS le cas "app fermée".
  //
  // Pour drainer ici, il faudrait :
  //   1. instancier Dexie dans le contexte Service Worker (pas de window) ;
  //   2. ré-authentifier Supabase sans cookie de session navigateur (token
  //      stocké côté SW, RLS respectée) ;
  //   3. reproduire la logique upsert idempotente (client_local_id) du manager.
  // À planifier quand le Background Sync API sera priorisé (post-MVP).
  // eslint-disable-next-line no-console
  console.log(
    '[SW] Periodic sync triggered — drain Service Worker hors-scope P0-4 (cf. GlobalPhotosSync.tsx)',
  )
}
