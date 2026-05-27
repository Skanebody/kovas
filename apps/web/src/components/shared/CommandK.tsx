'use client'

import { cn } from '@/lib/utils'
import {
  CalendarClock,
  CreditCard,
  FileText,
  FolderPlus,
  Receipt,
  Search,
  Settings,
  Users,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  type ComponentType,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

/**
 * CommandK — Principe de fluidité #9 (V5).
 *
 * Palette de commandes simple, ouverte par Cmd+K (Mac) / Ctrl+K (Windows).
 * Escape ferme. Centrée mais non bloquante (exception au principe #7 :
 * c'est une palette de commandes, pas une modale d'action).
 *
 * Spec V5 :
 * — Width 600px max-w-[calc(100vw-2rem)]
 * — Top 32 (pt-32) avec backdrop sidebar-bg/40
 * — Input texte autoFocus avec icône Search + kbd ESC à droite
 * — Liste filtrables : Navigation, Action, Mission, Client, Facturation
 *
 * Coexiste avec `<CommandPalette />` (recherche profonde + récents).
 * Cette palette est le point d'entrée léger ; la palette riche existante
 * couvre les recherches contextuelles.
 *
 * Conventions :
 * — Ton SOBRE : "Nouveau dossier", pas "Crée un super dossier !"
 * — Pas d'emoji
 */

interface CommandItem {
  id: string
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  group: 'Navigation' | 'Action' | 'Recherche' | 'Compte'
  keywords?: string
}

const COMMANDS: ReadonlyArray<CommandItem> = [
  // Actions
  {
    id: 'new-dossier',
    label: 'Nouveau dossier',
    href: '/dashboard/dossiers/new',
    icon: FolderPlus,
    group: 'Action',
    keywords: 'créer ajouter mission',
  },

  // Navigation
  {
    id: 'today',
    label: 'Voir mes missions du jour',
    href: '/dashboard/dashboard',
    icon: CalendarClock,
    group: 'Navigation',
    keywords: 'aujourd hui visites',
  },
  {
    id: 'calendar',
    label: 'Voir le calendrier',
    href: '/dashboard/calendar',
    icon: CalendarClock,
    group: 'Navigation',
    keywords: 'planning agenda',
  },
  {
    id: 'dossiers',
    label: 'Tous mes dossiers',
    href: '/dashboard/dossiers',
    icon: FileText,
    group: 'Navigation',
  },

  // Recherche
  {
    id: 'search-client',
    label: 'Rechercher client',
    href: '/dashboard/clients',
    icon: Users,
    group: 'Recherche',
    keywords: 'contact propriétaire',
  },
  {
    id: 'search-invoice',
    label: 'Rechercher facture',
    href: '/dashboard/facturation',
    icon: Receipt,
    group: 'Recherche',
    keywords: 'facturation paiement',
  },

  // Compte
  {
    id: 'parameters',
    label: 'Mes paramètres',
    href: '/dashboard/account',
    icon: Settings,
    group: 'Compte',
    keywords: 'profil préférences',
  },
  {
    id: 'subscriptions',
    label: 'Mes abonnements',
    href: '/dashboard/account?tab=billing',
    icon: CreditCard,
    group: 'Compte',
    keywords: 'forfait facturation stripe',
  },
] as const

function isModKey(e: globalThis.KeyboardEvent): boolean {
  if (typeof navigator === 'undefined') return e.ctrlKey
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  return isMac ? e.metaKey : e.ctrlKey
}

interface CommandKProps {
  /**
   * Active le listener global Cmd+K / Ctrl+K (Mac / Windows).
   * Défaut `true`. Passer `false` quand une autre palette est déjà
   * en charge du raccourci (ex : `<CommandPalette />` legacy dans /dashboard).
   */
  enableShortcut?: boolean
}

export function CommandK({ enableShortcut = true }: CommandKProps = {}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Listener global Cmd+K / Ctrl+K + Escape pour fermer
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (enableShortcut && e.key === 'k' && isModKey(e)) {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [enableShortcut, open])

  // Reset query/index à l'ouverture + focus
  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    // Defer focus pour laisser le DOM se monter
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COMMANDS
    return COMMANDS.filter((c) => {
      const hay = `${c.label} ${c.keywords ?? ''} ${c.group}`.toLowerCase()
      return hay.includes(q)
    })
  }, [query])

  // Groupement
  const groups = useMemo(() => {
    const map = new Map<CommandItem['group'], CommandItem[]>()
    for (const cmd of filtered) {
      const list = map.get(cmd.group) ?? []
      list.push(cmd)
      map.set(cmd.group, list)
    }
    return Array.from(map.entries())
  }, [filtered])

  const close = useCallback(() => setOpen(false), [])

  const run = useCallback(
    (item: CommandItem) => {
      router.push(item.href)
      close()
    },
    [router, close],
  )

  const onInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % Math.max(1, filtered.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = filtered[activeIndex]
        if (item) run(item)
      }
    },
    [filtered, activeIndex, run],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-32 bg-sidebar-bg/40 animate-fade-in"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commandes"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full max-w-[600px] max-w-[calc(100vw-2rem)]',
          'rounded-xl border border-rule bg-paper shadow-glass-hover overflow-hidden',
          'animate-slide-up',
        )}
      >
        <div className="flex items-center gap-2 border-b border-rule px-4">
          <Search className="size-4 text-ink-mute shrink-0" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Rechercher une action…"
            aria-label="Rechercher une commande"
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-ink-mute"
            autoFocus
          />
          <kbd className="text-[10px] font-mono text-ink-mute bg-sidebar-bg/5 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-mute">Aucune action.</p>
          ) : (
            groups.map(([group, items]) => (
              <div key={group} className="mb-2 last:mb-0">
                <div className="px-3 py-2 text-[10px] uppercase tracking-[0.06em] font-mono text-ink-mute">
                  {group}
                </div>
                <ul role="listbox">
                  {items.map((item) => {
                    const idx = filtered.indexOf(item)
                    const active = idx === activeIndex
                    return (
                      <li key={item.id} role="option" aria-selected={active}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => run(item)}
                          className={cn(
                            'w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-left transition-colors duration-200',
                            active
                              ? 'bg-sidebar-bg/[0.08] text-ink'
                              : 'text-ink-soft hover:bg-sidebar-bg/[0.04]',
                          )}
                        >
                          <item.icon className="size-4 text-ink-mute shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-rule px-4 py-2 text-[10px] font-mono text-ink-mute">
          <span>
            <kbd className="bg-sidebar-bg/5 rounded px-1.5 py-0.5">↑↓</kbd> naviguer ·{' '}
            <kbd className="bg-sidebar-bg/5 rounded px-1.5 py-0.5">↵</kbd> ouvrir
          </span>
          <span>
            <kbd className="bg-sidebar-bg/5 rounded px-1.5 py-0.5">⌘K</kbd> /{' '}
            <kbd className="bg-sidebar-bg/5 rounded px-1.5 py-0.5">Ctrl K</kbd>
          </span>
        </div>
      </div>
    </div>
  )
}
