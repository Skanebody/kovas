'use client'

import { generateClientId, getSyncDB, type BlobRow, type MutationKind, type MutationRow } from './db'

/**
 * Queue API — wrapping des mutations pour fallback offline.
 * CLAUDE.md §3 feature #10 : Sync mobile/web + offline complet.
 *
 * Pattern d'usage côté server action :
 *   const result = await tryOnlineOrQueue({
 *     kind: 'add_photo',
 *     payload: { dossierId, missionId, roomId, exif },
 *     blob: photoFile,
 *     organizationId,
 *     onlineCall: () => fetch('/api/...', { method: 'POST', body: ... })
 *   })
 *   if (result.queued) toast.info('Mode hors ligne — envoi différé')
 */

interface EnqueueOptions {
  kind: MutationKind
  payload: Record<string, unknown>
  organizationId: string
  /** Blob optionnel (photo, audio) stocké séparément */
  blob?: { data: Blob; mimeType: string; filename: string }
}

export interface EnqueueResult {
  clientId: string
  blobId?: number
  mutationId: number
}

/**
 * Ajoute une mutation à la queue locale.
 * Utilisé quand navigator.onLine === false OU quand le call online échoue (4xx/5xx).
 */
export async function enqueue(opts: EnqueueOptions): Promise<EnqueueResult> {
  const db = getSyncDB()
  const clientId = generateClientId()
  let blobId: number | undefined

  if (opts.blob) {
    const blobRow: Omit<BlobRow, 'id'> = {
      mimeType: opts.blob.mimeType,
      data: opts.blob.data,
      filename: opts.blob.filename,
      size: opts.blob.data.size,
      createdAt: Date.now(),
    }
    blobId = (await db.blobs.add(blobRow as BlobRow)) as number
  }

  const mutation: Omit<MutationRow, 'id'> = {
    clientId,
    kind: opts.kind,
    payload: opts.payload,
    blobId,
    organizationId: opts.organizationId,
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
  }
  const mutationId = (await db.mutations.add(mutation as MutationRow)) as number
  return { clientId, blobId, mutationId }
}

/**
 * Liste les mutations en attente (badge "N en attente").
 */
export async function pendingCount(organizationId: string): Promise<number> {
  const db = getSyncDB()
  return db.mutations
    .where('organizationId')
    .equals(organizationId)
    .and((m) => m.status === 'pending' || m.status === 'in_flight' || m.status === 'failed')
    .count()
}

/**
 * Liste détaillée des mutations en attente — pour panneau de détail.
 */
export async function listPending(organizationId: string): Promise<MutationRow[]> {
  const db = getSyncDB()
  return db.mutations
    .where('organizationId')
    .equals(organizationId)
    .and((m) => m.status !== 'done')
    .sortBy('createdAt')
}

/**
 * Compte les conflits non résolus (badge alerte critique).
 */
export async function unresolvedConflictsCount(): Promise<number> {
  const db = getSyncDB()
  return db.conflicts.where('resolved').equals(0).count()
}

/**
 * Supprime une mutation done depuis la queue (purge auto post-sync).
 */
export async function purgeDone(): Promise<number> {
  const db = getSyncDB()
  const count = await db.mutations.where('status').equals('done').count()
  await db.mutations.where('status').equals('done').delete()
  // Purge blobs orphelins (V1.5 : référence count)
  return count
}

/**
 * Réessaie une mutation failed manuellement.
 */
export async function retry(mutationId: number): Promise<void> {
  const db = getSyncDB()
  await db.mutations.update(mutationId, {
    status: 'pending',
    lastError: undefined,
  })
}

/**
 * Abandonne définitivement une mutation (utilisateur a tranché conflit).
 */
export async function discard(mutationId: number): Promise<void> {
  const db = getSyncDB()
  const mut = await db.mutations.get(mutationId)
  if (mut?.blobId) {
    await db.blobs.delete(mut.blobId)
  }
  await db.mutations.delete(mutationId)
}

/**
 * Estimation de l'espace IndexedDB utilisé (Mo).
 */
export async function estimateStorage(): Promise<{ usedMB: number; quotaMB: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
  const { usage, quota } = await navigator.storage.estimate()
  return {
    usedMB: usage ? Math.round((usage / 1024 / 1024) * 10) / 10 : 0,
    quotaMB: quota ? Math.round(quota / 1024 / 1024) : 0,
  }
}
