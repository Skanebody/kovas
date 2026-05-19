'use client'

import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'

/**
 * Trigger discret pour le command palette dans le header.
 * Affiche le raccourci ⌘K (Mac) ou Ctrl+K (autres).
 * Le component palette lui-même écoute le raccourci global — ce bouton est
 * juste un fallback visuel pour signaler que la palette existe.
 */
export function CommandPaletteTrigger() {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label="Recherche rapide (⌘K)"
      onClick={() => {
        // Simule un Cmd+K en dispatchant un keyboardEvent
        const isMac =
          typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'k',
            metaKey: isMac,
            ctrlKey: !isMac,
            bubbles: true,
          }),
        )
      }}
      className="gap-2 text-muted-foreground"
    >
      <Search className="size-4" />
      <span className="hidden sm:inline">Recherche…</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] bg-muted/50 rounded px-1.5 py-0.5 ml-1">
        ⌘K
      </kbd>
    </Button>
  )
}
