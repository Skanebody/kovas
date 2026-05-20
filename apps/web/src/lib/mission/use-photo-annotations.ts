'use client'

/**
 * KOVAS — Hook React qui retourne le nombre d'annotations (voice + text)
 * attachées à une photo locale (V1.5 iteration 4).
 *
 * Source : IndexedDB locale, via useLiveQuery (mise à jour temps réel).
 *
 * Utilisé dans le carrousel CaptureScreen pour afficher les micro-badges
 * 🎤 et ✏️ sur les vignettes.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { getMissionDb } from './local-storage-queue'

export interface PhotoAnnotationsState {
  voiceCount: number
  textCount: number
  hasVoice: boolean
  hasText: boolean
}

export function usePhotoAnnotations(localPhotoId: string | null): PhotoAnnotationsState {
  const result = useLiveQuery(async () => {
    if (!localPhotoId) return { voiceCount: 0, textCount: 0 }
    const db = getMissionDb()
    const [voiceCount, textCount] = await Promise.all([
      db.voiceNotes.where('attachedLocalPhotoId').equals(localPhotoId).count(),
      db.textNotes.where('attachedLocalPhotoId').equals(localPhotoId).count(),
    ])
    return { voiceCount, textCount }
  }, [localPhotoId])

  const voiceCount = result?.voiceCount ?? 0
  const textCount = result?.textCount ?? 0

  return {
    voiceCount,
    textCount,
    hasVoice: voiceCount > 0,
    hasText: textCount > 0,
  }
}
