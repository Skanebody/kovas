'use client'

/**
 * KOVAS — Hook polling vision_status (Capture-First V1.5 iteration 3).
 *
 * Stratégie pragmatique pour itération 3 : polling 5s tant que le serveur
 * répond `pending` ou `processing`. Stoppe dès `analyzed | failed | skipped_*`.
 *
 * Limitations connues :
 *   - 1 fetch par photo non-finie toutes les 5s (acceptable car ≤ 30 photos en
 *     pratique sur une visite, et seules les pending/processing sont pollées).
 *   - Si l'utilisateur quitte la page, le polling stoppe (cleanup useEffect).
 *
 * Alternative envisagée : Supabase Realtime sur `photos` filtré par dossier_id.
 * À envisager en itération 4 si le pattern Realtime devient stable côté
 * mission-realtime.tsx existant.
 *
 * Authority : CLAUDE.md §3 feature 1 + iteration 3 brief.
 */

import { useEffect, useRef, useState } from 'react'
import type { VisionStatus } from './types'

const POLL_INTERVAL_MS = 5_000
const INITIAL_DELAY_MS = 2_000

export interface VisionStatusSnapshot {
  status: VisionStatus
  confidence: number | null
  fieldsCount: number
  analyzedAt: string | null
}

/**
 * Statuts considérés "terminaux" → arrêt du polling.
 */
function isTerminal(status: VisionStatus): boolean {
  return (
    status === 'analyzed' ||
    status === 'failed' ||
    status === 'skipped_duplicate' ||
    status === 'skipped_blurry' ||
    status === 'skipped_irrelevant'
  )
}

/**
 * Hook polling pour suivre l'évolution du vision_status d'une photo uploadée.
 *
 * @param serverPhotoId UUID de la photo côté serveur (null tant que pas synced)
 * @param initialIsBlurry true si la photo est floue (court-circuite le polling)
 */
export function useVisionStatus(
  serverPhotoId: string | null,
  initialIsBlurry: boolean,
): VisionStatusSnapshot {
  const [snapshot, setSnapshot] = useState<VisionStatusSnapshot>(() => ({
    status: initialIsBlurry ? 'skipped_blurry' : 'pending',
    confidence: null,
    fieldsCount: 0,
    analyzedAt: null,
  }))

  // Empêche les setState après unmount.
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    if (!serverPhotoId) return
    if (initialIsBlurry) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null

    async function tick() {
      if (cancelledRef.current) return
      try {
        const res = await fetch(`/api/missions/photos/${serverPhotoId}/vision-status`, {
          credentials: 'same-origin',
        })
        if (!res.ok) {
          // Erreur transitoire — on retente
          if (!cancelledRef.current) {
            timeoutId = setTimeout(tick, POLL_INTERVAL_MS)
          }
          return
        }
        const data = (await res.json()) as VisionStatusSnapshot & {
          vision_status?: VisionStatus
          vision_confidence?: number | null
          fields_count?: number
          analyzed_at?: string | null
        }
        // Le serveur renvoie le shape `{ vision_status, vision_confidence, ... }`
        // — on normalise vers le shape interne.
        const next: VisionStatusSnapshot = {
          status: (data.vision_status ?? data.status ?? 'pending') as VisionStatus,
          confidence:
            typeof data.vision_confidence === 'number'
              ? data.vision_confidence
              : typeof data.confidence === 'number'
                ? data.confidence
                : null,
          fieldsCount:
            typeof data.fields_count === 'number'
              ? data.fields_count
              : typeof data.fieldsCount === 'number'
                ? data.fieldsCount
                : 0,
          analyzedAt:
            typeof data.analyzed_at === 'string'
              ? data.analyzed_at
              : typeof data.analyzedAt === 'string'
                ? data.analyzedAt
                : null,
        }
        if (cancelledRef.current) return
        setSnapshot(next)
        if (!isTerminal(next.status)) {
          timeoutId = setTimeout(tick, POLL_INTERVAL_MS)
        }
      } catch {
        // Réseau coupé — on retente plus tard
        if (!cancelledRef.current) {
          timeoutId = setTimeout(tick, POLL_INTERVAL_MS)
        }
      }
    }

    timeoutId = setTimeout(tick, INITIAL_DELAY_MS)

    return () => {
      cancelledRef.current = true
      if (timeoutId !== null) clearTimeout(timeoutId)
    }
  }, [serverPhotoId, initialIsBlurry])

  return snapshot
}
