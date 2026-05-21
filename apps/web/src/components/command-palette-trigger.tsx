'use client'

import { Button } from '@/components/ui/button'
import { useCommandPaletteStore } from '@/lib/cmdk/use-command-palette'
import { Search } from 'lucide-react'

/**
 * Trigger discret pour le command palette dans le header.
 * Ouvre la palette via le store global Zustand (pas via simulation
 * d'événement clavier, qui est fragile).
 *
 * Affiche le raccourci ⌘K (Mac) ou Ctrl+K (autres) en hint visuel.
 */
export function CommandPaletteTrigger() {
  const setOpen = useCommandPaletteStore((s) => s.setOpen)
  return (
    <Button
      variant="glass"
      size="sm"
      aria-label="Recherche rapide (⌘K)"
      data-cmdk-trigger
      onClick={() => setOpen(true)}
      className="gap-2 text-ink-mute"
    >
      <Search className="size-4" />
      <span className="hidden sm:inline">Recherche…</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] bg-sage rounded-sm px-1.5 py-0.5 ml-1 border border-rule">
        ⌘K
      </kbd>
    </Button>
  )
}
