'use client'

import { getSyncDB, type MutationKind, type MutationRow } from './db'

/**
 * Sync logic — drain de la queue au retour réseau.
 * CLAUDE.md §3 #10 : FIFO, retry exponentiel sur erreurs réseau,
 * pas de retry sur 4xx (erreur métier).
 *
 * Mapping kind → endpoint API (HTTP-only, pas de server actions car
 * elles ne sont pas appelables en fetch direct depuis un client en
 * background).
 */

const MAX_ATTEMPTS = 5
const BASE_BACKOFF_MS = 1000 // 1s, doublé à chaque retry

/**
 * Endpoints HTTP par kind de mutation.
 * À implémenter côté API V1.5 (création routes /api/sync/* pour
 * accepter les payloads idempotents avec clientId).
 */
const KIND_ENDPOINTS: Record<MutationKind, string> = {
  create_dossier: '/api/dossiers',
  update_dossier: '/api/dossiers/[id]',
  create_mission: '/api/missions',
  update_mission_status: '/api/missions/[id]/status',
  create_room: '/api/rooms',
  update_room: '/api/rooms/[id]',
  delete_room: '/api/rooms/[id]/delete',
  add_photo: '/api/photos',
  delete_photo: '/api/photos/[id]/delete',
  add_voice_note: '/api/voice-notes',
  delete_voice_note: '/api/voice-notes/[id]/delete',
  toggle_checklist_item: '/api/checklist/toggle',
  update_owner_document: '/api/owner-documents/[id]',
}

export interface SyncResult {
  attempted: number
  succeeded: number
  failed: number
  conflicts: number
}

/**
 * Drain de la queue — FIFO, séquentiel pour préserver l'ordre métier.
 * (Ex : "create_room" puis "add_photo room_id" → l'ordre compte).
 *
 * Retry exponentiel uniquement sur 5xx ou network errors.
 * 4xx (validation, RLS, conflict métier) → status='failed', pas de retry auto.
 */
export async function drain(organizationId: string): Promise<SyncResult> {
  const db = getSyncDB()
  const result: SyncResult = { attempted: 0, succeeded: 0, failed: 0, conflicts: 0 }

  const pending = await db.mutations
    .where('organizationId')
    .equals(organizationId)
    .and((m) => m.status === 'pending' || m.status === 'failed')
    .sortBy('createdAt')

  for (const mut of pending) {
    if (mut.attempts >= MAX_ATTEMPTS) {
      // Trop d'échecs — laisse en failed pour résolution manuelle
      continue
    }

    // Backoff exponentiel : 1s, 2s, 4s, 8s, 16s
    const sinceLastAttempt = mut.lastAttemptAt ? Date.now() - mut.lastAttemptAt : Infinity
    const requiredWait = BASE_BACKOFF_MS * 2 ** mut.attempts
    if (sinceLastAttempt < requiredWait) continue

    result.attempted += 1
    try {
      await db.mutations.update(mut.id!, {
        status: 'in_flight',
        lastAttemptAt: Date.now(),
      })

      const response = await callApi(mut)

      if (response.ok) {
        await db.mutations.update(mut.id!, { status: 'done' })
        result.succeeded += 1
      } else if (response.status === 409) {
        // Conflit serveur — last-write-wins, log dans conflicts
        await db.conflicts.add({
          mutationClientId: mut.clientId,
          kind: 'last_write_wins_overwrite',
          localData: mut.payload,
          serverData: (await response.json().catch(() => ({}))) as Record<string, unknown>,
          detectedAt: Date.now(),
          resolved: false,
        })
        await db.mutations.update(mut.id!, { status: 'failed', lastError: 'Conflict 409' })
        result.conflicts += 1
      } else if (response.status >= 400 && response.status < 500) {
        // Erreur client (validation, RLS, etc.) — pas de retry auto
        const errText = await response.text().catch(() => `HTTP ${response.status}`)
        await db.mutations.update(mut.id!, {
          status: 'failed',
          lastError: errText.slice(0, 500),
          attempts: mut.attempts + 1,
        })
        result.failed += 1
      } else {
        // 5xx — retry plus tard
        await db.mutations.update(mut.id!, {
          status: 'pending',
          attempts: mut.attempts + 1,
          lastError: `HTTP ${response.status}`,
        })
        result.failed += 1
      }
    } catch (err) {
      // Network error — retry plus tard
      await db.mutations.update(mut.id!, {
        status: 'pending',
        attempts: mut.attempts + 1,
        lastError: err instanceof Error ? err.message.slice(0, 500) : 'Network error',
      })
      result.failed += 1
    }
  }

  return result
}

/**
 * Appel HTTP pour une mutation. À adapter selon les routes API V1.5 réelles.
 * Pour V1, on retourne un stub `not_implemented` qui marque la mutation comme
 * failed (sans retry infini) — le câblage réel sera fait sprint suivant.
 */
async function callApi(mut: MutationRow): Promise<Response> {
  const endpoint = KIND_ENDPOINTS[mut.kind]
  if (!endpoint) {
    throw new Error(`Unknown mutation kind: ${mut.kind}`)
  }

  // V1.5 STUB : les routes /api/sync/* n'existent pas encore (server actions
  // sont utilisées directement pendant connexion active). Le drain est en
  // place mais inactif côté serveur tant que les routes API HTTP idempotentes
  // ne sont pas créées.
  return new Response(JSON.stringify({ stub: true, error: 'Sync API V1.5 — endpoints à câbler' }), {
    status: 501,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Hook listeners online/offline + Service Worker sync.
 * À appeler une fois côté layout client (`/app/layout.tsx`).
 */
export function setupAutoSync(organizationId: string): () => void {
  if (typeof window === 'undefined') return () => {}

  let timer: number | null = null

  async function trySync() {
    if (!navigator.onLine) return
    const result = await drain(organizationId)
    if (result.succeeded > 0) {
      // Toast côté UI via event custom (le composant SyncIndicator écoute)
      window.dispatchEvent(
        new CustomEvent('kovas:sync:complete', { detail: result }),
      )
    }
  }

  function handleOnline() {
    void trySync()
  }

  function periodicSync() {
    void trySync()
    timer = window.setTimeout(periodicSync, 60_000) // Retry toutes les 60s
  }

  window.addEventListener('online', handleOnline)
  // Premier sync au mount si déjà online
  if (navigator.onLine) void trySync()
  periodicSync()

  return () => {
    window.removeEventListener('online', handleOnline)
    if (timer !== null) window.clearTimeout(timer)
  }
}
