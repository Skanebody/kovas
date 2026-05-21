'use client'

import { useTheme } from 'next-themes'
import { Toaster as SonnerToaster, toast } from 'sonner'

/**
 * Toaster global (F8). Importé une seule fois dans le layout racine.
 * Stylé avec les tokens KOVAS v5 (navy sidebar-bg, sage, chartreuse).
 *
 * Spec V5 :
 * — Position bottom-right (desktop) / bottom-center via prop
 * — Width 320px, bg paper, border navy 1px, pas de glass coloré
 * — Auto-dismiss 4s par défaut (assez pour cliquer undo)
 */
export function Toaster() {
  const { resolvedTheme } = useTheme()
  return (
    <SonnerToaster
      theme={(resolvedTheme as 'light' | 'dark') ?? 'light'}
      position="bottom-right"
      duration={4000}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'rounded-md border border-sidebar-bg/15 bg-paper shadow-md text-ink',
          title: 'text-sm font-semibold',
          description: 'text-xs text-ink-mute',
          actionButton:
            'bg-sidebar-bg text-white font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded-sm',
        },
      }}
    />
  )
}

/**
 * Wrapper typé du toast Sonner pour usage app.
 * Utilisation : `import { toast, toastUndo } from '@/components/ui/toaster'`
 */
export { toast }

/* ----------------------------------------------------------------------- */
/* Helpers KOVAS                                                            */
/* ----------------------------------------------------------------------- */

interface ToastUndoOptions {
  /** Callback déclenché si l'utilisateur clique sur "Annuler". */
  undo: () => void
  /** Durée d'affichage personnalisée (défaut 4000ms — laisser le temps de cliquer). */
  duration?: number
  /** Description optionnelle sous le titre. */
  description?: string
}

/**
 * Toast avec bouton "Annuler" pour les actions destructives (suppression,
 * archivage, …). Spec : auto-dismiss 4s, bouton undo navy contrasté.
 *
 * Usage :
 * ```ts
 * toastUndo('Dossier archivé', { undo: () => restoreDossier(id) })
 * ```
 */
export function toastUndo(message: string, options: ToastUndoOptions): void {
  toast(message, {
    duration: options.duration ?? 4000,
    description: options.description,
    action: {
      label: 'Annuler',
      onClick: options.undo,
    },
  })
}
