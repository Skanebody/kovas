'use client'

import { useTheme } from 'next-themes'
import { Toaster as SonnerToaster, toast } from 'sonner'

/**
 * Toaster global (F8). Importé une seule fois dans le layout racine.
 * Stylé avec les tokens KOVAS (navy CTA, glass card).
 */
export function Toaster() {
  const { resolvedTheme } = useTheme()
  return (
    <SonnerToaster
      theme={(resolvedTheme as 'light' | 'dark') ?? 'light'}
      position="bottom-right"
      duration={3500}
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast:
            'rounded-xl border border-cta/[0.08] bg-card/95 backdrop-blur-xl shadow-glass text-foreground',
          title: 'text-sm font-semibold',
          description: 'text-xs text-muted-foreground',
        },
      }}
    />
  )
}

/**
 * Wrapper typé du toast Sonner pour usage app.
 * Utilisation : `import { toast } from '@/components/ui/toaster'`
 */
export { toast }
