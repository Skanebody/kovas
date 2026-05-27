'use client'

import { logoutAction } from '@/app/dashboard/actions'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Command } from 'cmdk'
import {
  Building2,
  CalendarClock,
  FileText,
  HelpCircle,
  Home,
  LogOut,
  Mic,
  Plus,
  Search,
  Settings,
  Users,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'

interface RecentItem {
  kind: 'dossier' | 'client' | 'property'
  id: string
  label: string
  subtitle?: string
}

interface TodayMission {
  missionId: string
  dossierId: string
  type: string
  label: string
  time: string | null
  client: string | null
}

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    href: '/dashboard/dashboard',
    icon: Home,
    shortcut: 'G D',
  },
  {
    id: 'dossiers',
    label: 'Dossiers',
    href: '/dashboard/dossiers',
    icon: FileText,
    shortcut: 'G O',
  },
  { id: 'clients', label: 'Clients', href: '/dashboard/clients', icon: Users, shortcut: 'G C' },
  {
    id: 'properties',
    label: 'Biens',
    href: '/dashboard/properties',
    icon: Building2,
    shortcut: 'G B',
  },
] as const

const QUICK_ACTIONS = [
  { id: 'new-dossier', label: 'Nouveau dossier', href: '/dashboard/dossiers/new', icon: Plus },
  { id: 'new-client', label: 'Nouveau client', href: '/dashboard/clients/new', icon: Plus },
  { id: 'new-property', label: 'Nouveau bien', href: '/dashboard/properties/new', icon: Plus },
] as const

/**
 * Renvoie la touche correspondant à Cmd sur Mac, Ctrl ailleurs.
 */
function isModKey(e: KeyboardEvent): boolean {
  if (typeof navigator === 'undefined') return e.ctrlKey
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  return isMac ? e.metaKey : e.ctrlKey
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [recent, setRecent] = useState<RecentItem[]>([])
  const [today, setToday] = useState<TodayMission[]>([])
  const [, startTransition] = useTransition()
  const router = useRouter()

  // Cmd+K / Ctrl+K global shortcut + G+X navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && isModKey(e)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Charge données récentes à l'ouverture (paresseux)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const [{ data: dossiers }, { data: clients }, { data: properties }, { data: missions }] =
        await Promise.all([
          supabase
            .from('dossiers')
            .select('id, reference, properties(address, city)')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(8),
          supabase
            .from('clients')
            .select('id, display_name, email')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(8),
          supabase
            .from('properties')
            .select('id, address, city')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(8),
          supabase
            .from('missions')
            .select('id, type, dossier_id, dossiers(scheduled_at, clients(display_name))')
            .is('deleted_at', null)
            .in('status', ['scheduled', 'in_progress'])
            .order('created_at', { ascending: false })
            .limit(20),
        ])

      if (cancelled) return

      const recentItems: RecentItem[] = []
      for (const d of dossiers ?? []) {
        const prop = Array.isArray(d.properties) ? d.properties[0] : d.properties
        recentItems.push({
          kind: 'dossier',
          id: d.id,
          label: d.reference,
          subtitle: prop?.address
            ? `${prop.address}${prop.city ? `, ${prop.city}` : ''}`
            : undefined,
        })
      }
      for (const c of clients ?? []) {
        recentItems.push({
          kind: 'client',
          id: c.id,
          label: c.display_name,
          subtitle: c.email ?? undefined,
        })
      }
      for (const p of properties ?? []) {
        recentItems.push({
          kind: 'property',
          id: p.id,
          label: p.address ?? '(sans adresse)',
          subtitle: p.city ?? undefined,
        })
      }
      setRecent(recentItems)

      // Filtre missions du jour côté client (timezone Paris approximée)
      const now = new Date()
      const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const todayMissions: TodayMission[] = []
      for (const m of missions ?? []) {
        const d = Array.isArray(m.dossiers) ? m.dossiers[0] : m.dossiers
        const scheduledAt = d?.scheduled_at
        if (!scheduledAt) continue
        const dateStr = scheduledAt.slice(0, 10)
        if (dateStr !== todayDate) continue
        const client = Array.isArray(d?.clients) ? d?.clients[0] : d?.clients
        todayMissions.push({
          missionId: m.id,
          dossierId: m.dossier_id,
          type: m.type,
          label: MISSION_TYPE_LABELS[m.type] ?? m.type,
          time: scheduledAt
            ? new Date(scheduledAt).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Paris',
              })
            : null,
          client: client?.display_name ?? null,
        })
      }
      todayMissions.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
      setToday(todayMissions)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open])

  const close = useCallback(() => {
    setOpen(false)
    setSearch('')
  }, [])

  const go = useCallback(
    (href: string) => {
      router.push(href)
      close()
    },
    [router, close],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 backdrop-blur-sm pt-[15vh] px-4 animate-fade-in"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Recherche rapide"
    >
      <Command
        label="Command palette"
        className="w-full max-w-xl rounded-xl border border-rule bg-paper/95 backdrop-blur-xl shadow-glass-hover overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        loop
      >
        <div className="flex items-center gap-2 border-b border-rule px-4">
          <Search className="size-4 text-ink-mute shrink-0" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Chercher dossiers, clients, biens, actions…"
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-ink-mute"
          />
          <kbd className="text-[10px] text-ink-mute bg-cream-deep/50 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>
        <Command.List className="max-h-[60vh] overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-sm text-ink-mute">
            Aucun résultat
          </Command.Empty>

          {today.length > 0 && (
            <CommandGroup heading="Visites aujourd'hui">
              {today.map((m) => (
                <CommandRow
                  key={`today-${m.missionId}`}
                  onSelect={() => go(`/dashboard/dossiers/${m.dossierId}#mission-${m.missionId}`)}
                  icon={<CalendarClock className="size-4" />}
                  label={`${m.time ? `${m.time} · ` : ''}${m.label}`}
                  subtitle={m.client ?? undefined}
                />
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Actions rapides">
            {QUICK_ACTIONS.map((a) => (
              <CommandRow
                key={a.id}
                onSelect={() => go(a.href)}
                icon={<a.icon className="size-4" />}
                label={a.label}
              />
            ))}
            <CommandRow
              onSelect={() => {
                close()
                // Quick add vocal V1.5 — placeholder qui scroll vers dashboard
                router.push('/dashboard/dashboard')
              }}
              icon={<Mic className="size-4" />}
              label="Saisie vocale (V1.5)"
              disabled
            />
          </CommandGroup>

          <CommandGroup heading="Naviguer">
            {NAV_ITEMS.map((n) => (
              <CommandRow
                key={n.id}
                onSelect={() => go(n.href)}
                icon={<n.icon className="size-4" />}
                label={n.label}
                shortcut={n.shortcut}
              />
            ))}
          </CommandGroup>

          {recent.length > 0 && (
            <CommandGroup heading="Récents">
              {recent.map((r) => {
                const href =
                  r.kind === 'dossier'
                    ? `/dashboard/dossiers/${r.id}`
                    : r.kind === 'client'
                      ? `/dashboard/clients/${r.id}`
                      : `/dashboard/properties/${r.id}`
                const icon =
                  r.kind === 'dossier' ? (
                    <FileText className="size-4" />
                  ) : r.kind === 'client' ? (
                    <Users className="size-4" />
                  ) : (
                    <Building2 className="size-4" />
                  )
                return (
                  <CommandRow
                    key={`${r.kind}-${r.id}`}
                    onSelect={() => go(href)}
                    icon={icon}
                    label={r.label}
                    subtitle={r.subtitle}
                  />
                )
              })}
            </CommandGroup>
          )}

          <CommandGroup heading="Aide & compte">
            <CommandRow
              onSelect={() => go('/dashboard/account')}
              icon={<Settings className="size-4" />}
              label="Mon compte"
              shortcut="⌘ ,"
            />
            <CommandRow
              onSelect={() => go('/faq')}
              icon={<HelpCircle className="size-4" />}
              label="Questions fréquentes"
            />
            <CommandRow
              onSelect={() => {
                close()
                startTransition(async () => {
                  await logoutAction()
                })
              }}
              icon={<LogOut className="size-4" />}
              label="Se déconnecter"
            />
          </CommandGroup>
        </Command.List>

        <div className="flex items-center justify-between gap-3 border-t border-rule px-4 py-2 text-[10px] text-ink-mute">
          <span>
            <kbd className="bg-cream-deep/50 rounded px-1.5 py-0.5">↑↓</kbd> naviguer ·{' '}
            <kbd className="bg-cream-deep/50 rounded px-1.5 py-0.5">↵</kbd> ouvrir
          </span>
          <span>
            <kbd className="bg-cream-deep/50 rounded px-1.5 py-0.5">⌘K</kbd> /{' '}
            <kbd className="bg-cream-deep/50 rounded px-1.5 py-0.5">Ctrl K</kbd>
          </span>
        </div>
      </Command>
    </div>
  )
}

function CommandGroup({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="text-[10px] uppercase tracking-wider font-semibold text-ink-mute [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2"
    >
      {children}
    </Command.Group>
  )
}

function CommandRow({
  onSelect,
  icon,
  label,
  subtitle,
  shortcut,
  disabled,
}: {
  onSelect: () => void
  icon: React.ReactNode
  label: string
  subtitle?: string
  shortcut?: string
  disabled?: boolean
}) {
  return (
    <Command.Item
      onSelect={disabled ? undefined : onSelect}
      disabled={disabled}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm cursor-pointer',
        'data-[selected=true]:bg-navy/[0.08] data-[selected=true]:text-ink',
        'aria-disabled:opacity-50 aria-disabled:cursor-not-allowed',
      )}
    >
      <span className="text-ink-mute shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="truncate block">{label}</span>
        {subtitle && <span className="text-[11px] text-ink-mute truncate block">{subtitle}</span>}
      </span>
      {shortcut && (
        <span className="flex gap-0.5 shrink-0">
          {shortcut.split(' ').map((k, i) => (
            <kbd
              key={`${shortcut}-${i}`}
              className="text-[10px] bg-cream-deep/50 rounded px-1.5 py-0.5"
            >
              {k}
            </kbd>
          ))}
        </span>
      )}
    </Command.Item>
  )
}
