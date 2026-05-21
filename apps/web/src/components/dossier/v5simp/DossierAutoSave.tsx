'use client'

import { useEffect, useState } from 'react'

type AutoSaveState = 'idle' | 'saving' | 'saved' | 'offline'

interface DossierAutoSaveProps {
  /** Nombre de mutations en attente côté offline queue (si > 0, force état 'offline'). */
  offlineQueuedCount?: number
}

/**
 * Indicateur d'auto-save discret en haut à droite du contenu principal.
 * V1 stub : alterne 'saving' 800ms → 'saved' au mount.
 * À brancher en V1.1 sur les vraies mutations + Dexie queue.
 */
export function DossierAutoSave({ offlineQueuedCount = 0 }: DossierAutoSaveProps) {
  const [state, setState] = useState<AutoSaveState>('saving')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setState('saved')
      setLastSavedAt(Date.now())
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  const effective: AutoSaveState = offlineQueuedCount > 0 ? 'offline' : state

  let label: string
  if (effective === 'offline') {
    label = `Hors ligne — ${offlineQueuedCount} modif${offlineQueuedCount > 1 ? 's' : ''} en attente`
  } else if (effective === 'saving') {
    label = 'Sauvegarde…'
  } else if (effective === 'saved' && lastSavedAt) {
    const secondsAgo = Math.max(1, Math.round((Date.now() - lastSavedAt) / 1000))
    label = `Sauvegardé il y a ${secondsAgo}s`
  } else {
    label = 'Sauvegardé'
  }

  return (
    <output
      aria-live="polite"
      className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute/70 text-right"
    >
      {label}
    </output>
  )
}
