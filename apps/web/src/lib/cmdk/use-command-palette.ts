'use client'

import { useEffect } from 'react'
import { create } from 'zustand'

/**
 * Store global du command palette (Cmd+K / Ctrl+K).
 * Permet à n'importe quel composant (header, FAB, raccourci clavier global)
 * d'ouvrir/fermer la palette sans prop drilling ni event synthétique.
 */
interface CommandPaletteState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
}))

/**
 * Détermine si la touche modifieur correspond à Cmd (Mac) ou Ctrl (autres).
 */
function isModKey(e: KeyboardEvent): boolean {
  if (typeof navigator === 'undefined') return e.ctrlKey
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  return isMac ? e.metaKey : e.ctrlKey
}

/**
 * Hook à monter une seule fois (dans le layout app) pour activer le raccourci
 * Cmd+K / Ctrl+K global. Ignoré si l'utilisateur tape dans un input.
 */
export function useCommandPaletteShortcut(): void {
  const toggle = useCommandPaletteStore((s) => s.toggle)

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key !== 'k') return
      if (!isModKey(e)) return
      // Active depuis n'importe quel contexte (y compris inputs), c'est l'usage attendu
      e.preventDefault()
      toggle()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [toggle])
}

/**
 * LocalStorage : stockage des 5 dernières recherches utilisateur.
 */
const RECENT_QUERIES_KEY = 'kovas-cmdk-recent-queries'
const RECENT_QUERIES_MAX = 5

export function loadRecentQueries(): readonly string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_QUERIES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string').slice(0, RECENT_QUERIES_MAX)
  } catch {
    return []
  }
}

export function pushRecentQuery(query: string): void {
  if (typeof window === 'undefined') return
  const trimmed = query.trim()
  if (trimmed.length < 2) return
  const current = loadRecentQueries()
  const next = [trimmed, ...current.filter((q) => q !== trimmed)].slice(0, RECENT_QUERIES_MAX)
  try {
    window.localStorage.setItem(RECENT_QUERIES_KEY, JSON.stringify(next))
  } catch {
    // localStorage plein ou bloqué → silencieux
  }
}
