'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { toast as sonnerToast } from 'sonner'

/**
 * Toast système KOVAS (V5 — Principe de fluidité #6).
 *
 * Wrapper typé au-dessus de Sonner pour exposer l'API canonique du brief :
 *   showToast({ title, body?, action?, duration })
 *
 * Spec :
 * — Position fixed bottom-6 left-1/2 -translate-x-1/2 mobile / bottom-6 right-6 desktop
 *   (géré par <Toaster /> dans le root layout — sonner.position).
 * — 320px max-w (paper + border rule).
 * — Disparition auto 4s.
 * — Action "Annuler" sur destructifs via { action: { label, onClick } }.
 *
 * Le rendu visuel est délégué à <Toaster /> dans le root layout (sonner sous le capot).
 * Cette factory expose un Context React + hook pour les tests/découplage.
 */

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  /** Titre principal (court, factuel). Ex: "Modification enregistrée." */
  title: string
  /** Corps optionnel pour détail (1 phrase max). */
  body?: string
  /** Action optionnelle, typiquement "Annuler" sur action destructive. */
  action?: ToastAction
  /** Durée en ms. Défaut 4000. */
  duration?: number
  /** Variant sémantique. Défaut "default". */
  variant?: 'default' | 'success' | 'error'
}

export type ShowToastFn = (options: ToastOptions) => void

interface ToastContextValue {
  showToast: ShowToastFn
}

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * Provider à monter UNE SEULE FOIS dans le root layout.
 * Le rendu Sonner est dans <Toaster /> — ce provider ne fait que router les
 * appels via context.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const showToast = useCallback<ShowToastFn>((options) => {
    const { title, body, action, duration = 4000, variant = 'default' } = options
    const sonnerOptions: Parameters<typeof sonnerToast>[1] = {
      description: body,
      duration,
      action: action
        ? {
            label: action.label,
            onClick: action.onClick,
          }
        : undefined,
    }
    if (variant === 'success') {
      sonnerToast.success(title, sonnerOptions)
    } else if (variant === 'error') {
      sonnerToast.error(title, sonnerOptions)
    } else {
      sonnerToast(title, sonnerOptions)
    }
  }, [])

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast])

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

/**
 * Hook d'accès au système de toast.
 *
 * @example
 *   const { showToast } = useToast()
 *   showToast({ title: 'Modification enregistrée.' })
 *   showToast({
 *     title: 'Dossier archivé.',
 *     action: { label: 'Annuler', onClick: () => restore(id) },
 *   })
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (ctx) return ctx
  // Fallback hors Provider — sonner direct (utile en SSR/tests).
  return {
    showToast: ({ title, body, action, duration = 4000, variant = 'default' }) => {
      const options: Parameters<typeof sonnerToast>[1] = {
        description: body,
        duration,
        action: action
          ? { label: action.label, onClick: action.onClick }
          : undefined,
      }
      if (variant === 'success') sonnerToast.success(title, options)
      else if (variant === 'error') sonnerToast.error(title, options)
      else sonnerToast(title, options)
    },
  }
}
