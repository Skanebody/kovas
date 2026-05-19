'use client'

import { cn } from '@/lib/utils'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

const OPTIONS = [
  {
    value: 'system',
    label: 'Système',
    icon: Monitor,
    hint: "Suivre les préférences de l'appareil",
  },
  { value: 'light', label: 'Clair', icon: Sun, hint: 'Forcer le thème clair' },
  { value: 'dark', label: 'Sombre', icon: Moon, hint: 'Forcer le thème sombre' },
] as const

/**
 * Sélecteur de thème visible dans la page /app/account section Apparence.
 * 3 options : système (auto), clair, sombre. Persistance via next-themes.
 */
export function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // SSR-safe : on attend le mount pour afficher l'état sélectionné
  useEffect(() => setMounted(true), [])

  const current = mounted ? (theme ?? 'system') : 'system'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {OPTIONS.map((opt) => {
        const isActive = current === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={cn(
              'flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all',
              'hover:border-cta/30 hover:bg-cta/[0.03]',
              isActive
                ? 'border-cta/40 bg-cta/[0.06] ring-2 ring-cta/20'
                : 'border-cta/10 bg-card/60',
            )}
            aria-pressed={isActive}
          >
            <div className="flex items-center gap-2">
              <opt.icon className="size-4 text-cta" />
              <span className="text-sm font-semibold">{opt.label}</span>
            </div>
            <span className="text-xs text-muted-foreground">{opt.hint}</span>
          </button>
        )
      })}
    </div>
  )
}
