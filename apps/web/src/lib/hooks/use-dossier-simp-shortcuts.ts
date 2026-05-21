'use client'

import { useEffect } from 'react'

export interface DossierSimpShortcutHandlers {
  /** Cmd+S — sauvegarder (V1 : event log, vrai save auto). */
  onSave?: () => void
  /** Cmd+P — ouvrir l'action photo du FAB. */
  onPhoto?: () => void
  /** Cmd+M — ouvrir l'action vocal du FAB. */
  onVoice?: () => void
  /** Cmd+I — ouvrir le bottom sheet IA. */
  onAI?: () => void
  /** Cmd+Enter — valider envoi (si vérification OK). */
  onSubmit?: () => void
  /** ? — afficher l'aide raccourcis. */
  onHelp?: () => void
}

/**
 * Câble les raccourcis clavier de la page Dossier simplifiée.
 *
 * - Cmd/Ctrl+S : sauvegarder
 * - Cmd/Ctrl+P : photo
 * - Cmd/Ctrl+M : vocal
 * - Cmd/Ctrl+I : IA
 * - Cmd/Ctrl+Enter : valider
 * - ? : help
 *
 * Ignore les events depuis input/textarea/contenteditable.
 */
export function useDossierSimpShortcuts(handlers: DossierSimpShortcutHandlers): void {
  useEffect(() => {
    function isEditableTarget(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false
      const tag = t.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (t.isContentEditable) return true
      return false
    }

    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey

      // Cmd+Enter — valider envoi (autorisé même dans input)
      if (mod && e.key === 'Enter') {
        if (handlers.onSubmit) {
          e.preventDefault()
          handlers.onSubmit()
        }
        return
      }

      // ? — help (Shift+/ — uniquement hors input)
      if (e.key === '?' && !isEditableTarget(e.target)) {
        if (handlers.onHelp) {
          e.preventDefault()
          handlers.onHelp()
        }
        return
      }

      if (!mod) return

      // Cmd+S — save
      if (e.key === 's' || e.key === 'S') {
        if (handlers.onSave) {
          e.preventDefault()
          handlers.onSave()
        }
        return
      }
      // Cmd+P — photo
      if (e.key === 'p' || e.key === 'P') {
        if (handlers.onPhoto) {
          e.preventDefault()
          handlers.onPhoto()
        }
        return
      }
      // Cmd+M — vocal
      if (e.key === 'm' || e.key === 'M') {
        if (handlers.onVoice) {
          e.preventDefault()
          handlers.onVoice()
        }
        return
      }
      // Cmd+I — IA
      if (e.key === 'i' || e.key === 'I') {
        if (handlers.onAI) {
          e.preventDefault()
          handlers.onAI()
        }
        return
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers])
}
