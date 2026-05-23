'use client'

/**
 * KOVAS — Raccourcis clavier de navigation sidebar.
 *
 * Listener global monté dans le layout dashboard, écoute :
 *  - Cmd/Ctrl + 1..9  → navigue vers le n-ième item visible de la sidebar
 *  - Cmd/Ctrl + ,     → navigue vers /dashboard/account (Paramètres)
 *  - Cmd/Ctrl + /     → ouvre l'overlay des raccourcis clavier
 *  - Échap            → ferme l'overlay des raccourcis
 *
 * Cmd+K reste géré par CommandPalette (pas en conflit).
 */

import type { SidebarPreferencesItem } from '@/lib/sidebar/preferences-types'
import { SIDEBAR_ITEMS_BY_ID, type SidebarItemId } from '@/lib/sidebar/sidebar-items'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface SidebarKeyboardShortcutsProps {
  /** Items visibles de la sidebar (zone main, dans l'ordre). */
  mainItems: readonly SidebarPreferencesItem[]
}

function isModKey(e: KeyboardEvent): boolean {
  if (typeof navigator === 'undefined') return e.ctrlKey
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  return isMac ? e.metaKey : e.ctrlKey
}

function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform)
}

export function SidebarKeyboardShortcuts({ mainItems }: SidebarKeyboardShortcutsProps) {
  const router = useRouter()
  const [overlayOpen, setOverlayOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore si focus dans input / textarea / contentEditable
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return
      }

      if (e.key === 'Escape' && overlayOpen) {
        e.preventDefault()
        setOverlayOpen(false)
        return
      }

      if (!isModKey(e)) return

      // Cmd/Ctrl + ,
      if (e.key === ',') {
        e.preventDefault()
        router.push('/dashboard/account')
        return
      }

      // Cmd/Ctrl + /
      if (e.key === '/') {
        e.preventDefault()
        setOverlayOpen((o) => !o)
        return
      }

      // Cmd/Ctrl + 1..9
      if (e.key >= '1' && e.key <= '9') {
        const idx = Number.parseInt(e.key, 10) - 1
        const visible = mainItems.filter((i) => i.visible)
        const item = visible[idx]
        if (item) {
          const def = SIDEBAR_ITEMS_BY_ID.get(item.id as SidebarItemId)
          if (def) {
            e.preventDefault()
            router.push(def.href)
          }
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mainItems, overlayOpen, router])

  if (!overlayOpen) return null

  const mod = isMac() ? 'Cmd' : 'Ctrl'

  const visibleMain = mainItems
    .filter((i) => i.visible)
    .slice(0, 9)
    .map((i, idx) => {
      const def = SIDEBAR_ITEMS_BY_ID.get(i.id as SidebarItemId)
      return { label: def?.label ?? i.id, idx: idx + 1 }
    })

  return (
    <dialog
      open
      aria-label="Raccourcis clavier"
      className="fixed inset-0 z-[100] m-0 size-full bg-transparent p-0"
      // biome-ignore lint/a11y/useKeyWithClickEvents: dialog overlay relies on backdrop click + ESC handler
      onClick={() => setOverlayOpen(false)}
    >
      <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div
          className={cn(
            'w-[min(560px,calc(100vw-32px))] rounded-[20px] border border-rule/60 bg-paper shadow-xl',
            'p-6',
          )}
          // biome-ignore lint/a11y/useKeyWithClickEvents: prevents click bubbling to backdrop
          onClick={(e) => e.stopPropagation()}
        >
          <header className="mb-4">
            <h2 className="text-xl font-serif italic text-foreground">Raccourcis clavier</h2>
            <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-foreground/55 mt-1">
              {mod} + / pour ouvrir/fermer
            </p>
          </header>
          <div className="space-y-2">
            {visibleMain.map((item) => (
              <ShortcutRow key={item.idx} keys={[mod, String(item.idx)]} label={item.label} />
            ))}
            <hr className="my-2 border-rule/40" />
            <ShortcutRow keys={[mod, 'K']} label="Palette de commandes" />
            <ShortcutRow keys={[mod, ',']} label="Paramètres du compte" />
            <ShortcutRow keys={[mod, '/']} label="Afficher les raccourcis" />
            <ShortcutRow keys={['Échap']} label="Fermer cette fenêtre" />
          </div>
        </div>
      </div>
    </dialog>
  )
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-2 py-1.5 rounded-md hover:bg-sage/50 transition-colors">
      <span className="text-sm text-foreground/85">{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-rule/60 bg-sage/40 px-1.5 text-[11px] font-mono font-medium text-foreground/80"
          >
            {k}
          </kbd>
        ))}
      </span>
    </div>
  )
}
