'use client'

import { logoutAction } from '@/app/dashboard/actions'
import {
  loadRecentQueries,
  pushRecentQuery,
  useCommandPaletteShortcut,
  useCommandPaletteStore,
} from '@/lib/cmdk/use-command-palette'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Command } from 'cmdk'
import {
  Building2,
  CalendarClock,
  CreditCard,
  FileText,
  HelpCircle,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Plus,
  Receipt,
  Search,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'

/* ----------------------------------------------------------------------- */
/* Types                                                                    */
/* ----------------------------------------------------------------------- */

interface DossierRow {
  id: string
  reference: string
  properties:
    | { address: string | null; city: string | null }
    | { address: string | null; city: string | null }[]
    | null
}

interface ClientRow {
  id: string
  display_name: string
  email: string | null
}

interface PropertyRow {
  id: string
  address: string | null
  city: string | null
}

interface MissionRow {
  id: string
  type: string
  dossier_id: string
  dossiers:
    | {
        scheduled_at: string | null
        clients: { display_name: string } | { display_name: string }[] | null
      }
    | {
        scheduled_at: string | null
        clients: { display_name: string } | { display_name: string }[] | null
      }[]
    | null
}

interface InvoiceRow {
  id: string
  reference: string | null
  status: string | null
  amount_ttc: number | null
  issued_at: string | null
}

interface QuoteRow {
  id: string
  reference: string | null
  status: string | null
  amount_ttc: number | null
  issued_at: string | null
}

interface DbResult {
  dossiers: DossierRow[]
  clients: ClientRow[]
  properties: PropertyRow[]
  missions: MissionRow[]
  invoices: InvoiceRow[]
  quotes: QuoteRow[]
}

interface TodayMission {
  missionId: string
  dossierId: string
  type: string
  label: string
  time: string | null
  client: string | null
}

/* ----------------------------------------------------------------------- */
/* Configuration                                                            */
/* ----------------------------------------------------------------------- */

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    href: '/dashboard/dashboard',
    icon: LayoutDashboard,
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
  {
    id: 'calendar',
    label: 'Calendrier',
    href: '/dashboard/calendar',
    icon: CalendarClock,
    shortcut: 'G P',
  },
  {
    id: 'facturation',
    label: 'Facturation',
    href: '/dashboard/facturation',
    icon: Receipt,
    shortcut: 'G F',
  },
] as const

const QUICK_ACTIONS = [
  {
    id: 'new-dossier',
    label: 'Créer un dossier',
    href: '/dashboard/dossiers/new',
    icon: Plus,
    keywords: 'nouveau dossier creation',
  },
  {
    id: 'new-client',
    label: 'Créer un client',
    href: '/dashboard/clients/new',
    icon: Plus,
    keywords: 'nouveau client creation',
  },
  {
    id: 'new-property',
    label: 'Créer un bien',
    href: '/dashboard/properties/new',
    icon: Plus,
    keywords: 'nouveau bien propriete creation',
  },
  {
    id: 'new-quote',
    label: 'Créer un devis',
    href: '/dashboard/facturation',
    icon: Receipt,
    keywords: 'devis quote facture',
  },
  {
    id: 'invoices-overdue',
    label: 'Voir les factures impayées',
    href: '/dashboard/facturation?filter=overdue',
    icon: Receipt,
    keywords: 'impayees overdue factures',
  },
] as const

const STATIC_PAGES = [
  {
    id: 'pricing',
    label: 'Tarifs',
    href: '/pricing',
    icon: CreditCard,
    keywords: 'prix pricing tarifs forfaits',
  },
  {
    id: 'faq',
    label: 'Aide & FAQ',
    href: '/faq',
    icon: HelpCircle,
    keywords: 'aide help faq questions support',
  },
  {
    id: 'account',
    label: 'Mon abonnement',
    href: '/dashboard/account',
    icon: Settings,
    keywords: 'abonnement subscription compte',
  },
  {
    id: 'settings',
    label: 'Paramètres',
    href: '/dashboard/account',
    icon: Settings,
    keywords: 'parametres preferences settings',
  },
] as const

/* ----------------------------------------------------------------------- */
/* Helpers                                                                  */
/* ----------------------------------------------------------------------- */

function pickFirst<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

const EUR_FORMATTER = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatEur(amountCents: number | null | undefined): string | null {
  if (amountCents == null) return null
  // amount_ttc est stocké en centimes (cf. convention monétaire CLAUDE.md §10)
  return EUR_FORMATTER.format(amountCents / 100)
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  partial: 'Partielle',
  overdue: 'En retard',
  cancelled: 'Annulée',
}

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
  expired: 'Expiré',
}

/* ----------------------------------------------------------------------- */
/* Composant principal                                                      */
/* ----------------------------------------------------------------------- */

/**
 * Command palette universelle (Cmd+K / Ctrl+K).
 *
 * Conforme à la spec simplification radicale :
 * — UNE seule action primaire par catégorie
 * — Progressive disclosure : actions cachées par défaut, révélées par recherche
 * — Catégories : Actions / Pages / Visites du jour / Récents / Recherches récentes
 *
 * Cmd+K écouté globalement via useCommandPaletteShortcut().
 * S'affiche via le store Zustand → n'importe quel bouton header peut l'ouvrir.
 */
export function CommandPalette() {
  const open = useCommandPaletteStore((s) => s.open)
  const setOpen = useCommandPaletteStore((s) => s.setOpen)
  const [search, setSearch] = useState('')
  const [db, setDb] = useState<DbResult>({
    dossiers: [],
    clients: [],
    properties: [],
    missions: [],
    invoices: [],
    quotes: [],
  })
  const [today, setToday] = useState<TodayMission[]>([])
  const [recentQueries, setRecentQueries] = useState<readonly string[]>([])
  const [, startTransition] = useTransition()
  const router = useRouter()

  // Active le raccourci global Cmd+K
  useCommandPaletteShortcut()

  // FIX-JJ multi-accès #6 — raccourci Cmd+M / Ctrl+M : démarre la mission
  // imminente via /api/dossiers/next-mission, sans passer par la palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm') {
        // Évite le conflit avec Cmd+M (minimize) si le focus est dans un input.
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
        if (tag === 'input' || tag === 'textarea') return
        e.preventDefault()
        void (async () => {
          try {
            const res = await fetch('/api/dossiers/next-mission')
            const j = (await res.json()) as { ok: boolean; dossierId: string | null }
            if (j.ok && j.dossierId) {
              router.push(`/dashboard/dossiers/${j.dossierId}/mission/tchat`)
            } else {
              router.push('/dashboard/dossiers/new')
            }
          } catch {
            // silencieux — l'user retentera
          }
        })()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [router])

  // Recharge les recherches récentes à l'ouverture
  useEffect(() => {
    if (!open) return
    setRecentQueries(loadRecentQueries())
  }, [open])

  // Charge données DB à l'ouverture (paresseux, 1 fois)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load(): Promise<void> {
      const supabase = createClient()
      const [
        { data: dossiers },
        { data: clients },
        { data: properties },
        { data: missions },
        { data: invoices },
        { data: quotes },
      ] = await Promise.all([
        supabase
          .from('dossiers')
          .select('id, reference, properties(address, city)')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('clients')
          .select('id, display_name, email')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('properties')
          .select('id, address, city')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('missions')
          .select('id, type, dossier_id, dossiers(scheduled_at, clients(display_name))')
          .is('deleted_at', null)
          .in('status', ['scheduled', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('invoices')
          .select('id, reference, status, amount_ttc, issued_at')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('quotes')
          .select('id, reference, status, amount_ttc, issued_at')
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      if (cancelled) return

      setDb({
        dossiers: (dossiers ?? []) as DossierRow[],
        clients: (clients ?? []) as ClientRow[],
        properties: (properties ?? []) as PropertyRow[],
        missions: (missions ?? []) as MissionRow[],
        invoices: (invoices ?? []) as InvoiceRow[],
        quotes: (quotes ?? []) as QuoteRow[],
      })

      // Visites aujourd'hui (filtre côté client)
      const now = new Date()
      const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const todayMissions: TodayMission[] = []
      for (const m of (missions ?? []) as MissionRow[]) {
        const d = pickFirst(m.dossiers)
        const scheduledAt = d?.scheduled_at
        if (!scheduledAt) continue
        const dateStr = scheduledAt.slice(0, 10)
        if (dateStr !== todayDate) continue
        const client = pickFirst(d?.clients)
        todayMissions.push({
          missionId: m.id,
          dossierId: m.dossier_id,
          type: m.type,
          label: MISSION_TYPE_LABELS[m.type] ?? m.type,
          time: new Date(scheduledAt).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Paris',
          }),
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
  }, [setOpen])

  // Bind Escape global pour close
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  const go = useCallback(
    (href: string) => {
      if (search.trim().length >= 2) {
        pushRecentQuery(search)
      }
      router.push(href)
      close()
    },
    [router, close, search],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 animate-fade-in"
      aria-labelledby="command-palette-title"
    >
      {/* Backdrop dismissible — bouton transparent pour conformité a11y biome
          (useKeyWithClickEvents + useSemanticElements). Esc + focus trap geres par cmdk. */}
      <button
        type="button"
        aria-label="Fermer la recherche"
        onClick={close}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-default"
      />
      <span id="command-palette-title" className="sr-only">
        Recherche rapide
      </span>
      <Command
        label="Command palette"
        className="relative w-full max-w-[600px] bg-white border border-sidebar-bg/15 shadow-lg overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[600px]"
        loop
      >
        <div className="flex items-center gap-3 border-b border-sidebar-bg/10 px-4 py-1">
          <Search className="size-4 text-ink-mute shrink-0" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Rechercher missions, clients, factures, devis, dossiers…"
            className="flex-1 bg-transparent py-3 font-mono text-[14px] outline-none placeholder:text-ink-mute"
            autoFocus
          />
          <kbd className="text-[10px] font-mono text-ink-mute bg-sage rounded-sm px-1.5 py-0.5 border border-rule">
            ESC
          </kbd>
        </div>

        <Command.List className="flex-1 overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-sm text-ink-mute">
            Aucun résultat
          </Command.Empty>

          {/* Visites du jour — affichées en priorité, persistantes */}
          {today.length > 0 && (
            <CommandGroup heading="Visites aujourd'hui">
              {today.map((m) => (
                <CommandRow
                  key={`today-${m.missionId}`}
                  value={`visite ${m.label} ${m.client ?? ''}`}
                  onSelect={() => go(`/dashboard/dossiers/${m.dossierId}#mission-${m.missionId}`)}
                  icon={<CalendarClock className="size-4" />}
                  label={`${m.time ? `${m.time} · ` : ''}${m.label}`}
                  subtitle={m.client ?? undefined}
                />
              ))}
            </CommandGroup>
          )}

          {/* Actions globales */}
          <CommandGroup heading="Actions">
            {/* FIX-JJ multi-accès #6 — Action prioritaire "Démarrer la mission" */}
            <CommandRow
              value="demarrer mission terrain commencer reprendre tchat"
              onSelect={() => {
                void (async () => {
                  try {
                    const res = await fetch('/api/dossiers/next-mission')
                    const j = (await res.json()) as {
                      ok: boolean
                      dossierId: string | null
                    }
                    close()
                    if (j.ok && j.dossierId) {
                      router.push(`/dashboard/dossiers/${j.dossierId}/mission/tchat`)
                    } else {
                      router.push('/dashboard/dossiers/new')
                    }
                  } catch {
                    // silencieux
                  }
                })()
              }}
              icon={<Sparkles className="size-4" />}
              label="Démarrer la mission"
              shortcut="⌘ M"
            />
            {QUICK_ACTIONS.map((a) => (
              <CommandRow
                key={a.id}
                value={`${a.label} ${a.keywords}`}
                onSelect={() => go(a.href)}
                icon={<a.icon className="size-4" />}
                label={a.label}
              />
            ))}
          </CommandGroup>

          {/* Pages statiques + navigation */}
          <CommandGroup heading="Pages">
            {NAV_ITEMS.map((n) => (
              <CommandRow
                key={n.id}
                value={`page ${n.label}`}
                onSelect={() => go(n.href)}
                icon={<n.icon className="size-4" />}
                label={n.label}
                shortcut={n.shortcut}
              />
            ))}
            {STATIC_PAGES.map((p) => (
              <CommandRow
                key={p.id}
                value={`${p.label} ${p.keywords}`}
                onSelect={() => go(p.href)}
                icon={<p.icon className="size-4" />}
                label={p.label}
              />
            ))}
          </CommandGroup>

          {/* Missions DB (max 5 affichés via cmdk fuzzy) */}
          {db.dossiers.length > 0 && (
            <CommandGroup heading="Dossiers">
              {db.dossiers.slice(0, 5).map((d) => {
                const prop = pickFirst(d.properties)
                const subtitle = prop?.address
                  ? `${prop.address}${prop.city ? `, ${prop.city}` : ''}`
                  : undefined
                return (
                  <CommandRow
                    key={`dossier-${d.id}`}
                    value={`dossier ${d.reference} ${subtitle ?? ''}`}
                    onSelect={() => go(`/dashboard/dossiers/${d.id}`)}
                    icon={<FileText className="size-4" />}
                    label={d.reference}
                    subtitle={subtitle}
                    mono
                  />
                )
              })}
            </CommandGroup>
          )}

          {db.clients.length > 0 && (
            <CommandGroup heading="Clients">
              {db.clients.slice(0, 5).map((c) => (
                <CommandRow
                  key={`client-${c.id}`}
                  value={`client ${c.display_name} ${c.email ?? ''}`}
                  onSelect={() => go(`/dashboard/clients/${c.id}`)}
                  icon={<Users className="size-4" />}
                  label={c.display_name}
                  subtitle={c.email ?? undefined}
                />
              ))}
            </CommandGroup>
          )}

          {db.properties.length > 0 && (
            <CommandGroup heading="Biens">
              {db.properties.slice(0, 5).map((p) => (
                <CommandRow
                  key={`prop-${p.id}`}
                  value={`bien ${p.address ?? ''} ${p.city ?? ''}`}
                  onSelect={() => go(`/dashboard/properties/${p.id}`)}
                  icon={<Building2 className="size-4" />}
                  label={p.address ?? '(sans adresse)'}
                  subtitle={p.city ?? undefined}
                />
              ))}
            </CommandGroup>
          )}

          {/* Factures live — deep-link facturation?tab=factures&q=REF */}
          {db.invoices.length > 0 && (
            <CommandGroup heading="Factures">
              {db.invoices.slice(0, 5).map((inv) => {
                const ref = inv.reference ?? '(sans ref)'
                const amount = formatEur(inv.amount_ttc)
                const statusLabel = inv.status ? INVOICE_STATUS_LABELS[inv.status] : null
                const subtitleParts = [statusLabel, amount].filter(Boolean) as string[]
                return (
                  <CommandRow
                    key={`invoice-${inv.id}`}
                    value={`facture ${ref} ${inv.status ?? ''}`}
                    onSelect={() =>
                      go(`/dashboard/facturation?tab=factures&q=${encodeURIComponent(ref)}`)
                    }
                    icon={<Receipt className="size-4" />}
                    label={ref}
                    subtitle={subtitleParts.length > 0 ? subtitleParts.join(' · ') : undefined}
                    mono
                  />
                )
              })}
            </CommandGroup>
          )}

          {/* Devis live — deep-link facturation?tab=devis&q=REF */}
          {db.quotes.length > 0 && (
            <CommandGroup heading="Devis">
              {db.quotes.slice(0, 5).map((q) => {
                const ref = q.reference ?? '(sans ref)'
                const amount = formatEur(q.amount_ttc)
                const statusLabel = q.status ? QUOTE_STATUS_LABELS[q.status] : null
                const subtitleParts = [statusLabel, amount].filter(Boolean) as string[]
                return (
                  <CommandRow
                    key={`quote-${q.id}`}
                    value={`devis ${ref} ${q.status ?? ''}`}
                    onSelect={() =>
                      go(`/dashboard/facturation?tab=devis&q=${encodeURIComponent(ref)}`)
                    }
                    icon={<FileText className="size-4" />}
                    label={ref}
                    subtitle={subtitleParts.length > 0 ? subtitleParts.join(' · ') : undefined}
                    mono
                  />
                )
              })}
            </CommandGroup>
          )}

          {/* Recherches récentes (depuis localStorage) — visibles si search vide */}
          {search.length === 0 && recentQueries.length > 0 && (
            <CommandGroup heading="Recherches récentes">
              {recentQueries.map((q) => (
                <CommandRow
                  key={`recent-${q}`}
                  value={`recent ${q}`}
                  onSelect={() => setSearch(q)}
                  icon={<History className="size-4" />}
                  label={q}
                  mono
                />
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Compte">
            <CommandRow
              value="compte parametres settings"
              onSelect={() => go('/dashboard/account')}
              icon={<Settings className="size-4" />}
              label="Paramètres du compte"
              shortcut="⌘ ,"
            />
            <CommandRow
              value="accueil home dashboard"
              onSelect={() => go('/dashboard/dashboard')}
              icon={<Home className="size-4" />}
              label="Retour au tableau de bord"
            />
            <CommandRow
              value="deconnexion logout signout"
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

        <div className="flex items-center justify-between gap-3 border-t border-sidebar-bg/10 px-4 py-2 text-[10px] font-mono text-ink-mute">
          <span className="flex items-center gap-2">
            <kbd className="bg-sage rounded-sm px-1.5 py-0.5 border border-rule">↑↓</kbd>
            naviguer
            <kbd className="bg-sage rounded-sm px-1.5 py-0.5 border border-rule ml-2">↵</kbd>
            ouvrir
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-sage rounded-sm px-1.5 py-0.5 border border-rule">⌘K</kbd>
            <span className="text-ink-ghost">/</span>
            <kbd className="bg-sage rounded-sm px-1.5 py-0.5 border border-rule">Ctrl K</kbd>
          </span>
        </div>
      </Command>
    </div>
  )
}

/* ----------------------------------------------------------------------- */
/* Sous-composants                                                          */
/* ----------------------------------------------------------------------- */

function CommandGroup({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="text-[10px] font-mono uppercase tracking-[0.1em] font-medium text-ink-mute [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2"
    >
      {children}
    </Command.Group>
  )
}

interface CommandRowProps {
  value: string
  onSelect: () => void
  icon: React.ReactNode
  label: string
  subtitle?: string
  shortcut?: string
  disabled?: boolean
  mono?: boolean
}

function CommandRow({
  value,
  onSelect,
  icon,
  label,
  subtitle,
  shortcut,
  disabled,
  mono,
}: CommandRowProps) {
  return (
    <Command.Item
      value={value}
      onSelect={disabled ? undefined : onSelect}
      disabled={disabled}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm cursor-pointer',
        'border border-transparent transition-colors',
        // DS v5 — item highlighted : chartreuse #D4F542/15 + bordure subtile chartreuse, texte navy conservé
        'data-[selected=true]:bg-[#D4F542]/15 data-[selected=true]:border-[#D4F542]/40 data-[selected=true]:text-[#0F1419]',
        'aria-disabled:opacity-50 aria-disabled:cursor-not-allowed',
      )}
    >
      <span className="text-ink-mute shrink-0 [&_svg]:size-4 data-[selected=true]:text-[#0F1419]">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className={cn('truncate block', mono && 'font-mono text-[13px]')}>{label}</span>
        {subtitle && (
          <span className={cn('text-[11px] text-ink-mute truncate block', mono && 'font-mono')}>
            {subtitle}
          </span>
        )}
      </span>
      {shortcut && (
        <span className="flex gap-0.5 shrink-0">
          {shortcut.split(' ').map((k) => (
            <kbd
              key={`${shortcut}-${k}`}
              className="text-[10px] font-mono bg-sage rounded-sm px-1.5 py-0.5 border border-rule"
            >
              {k}
            </kbd>
          ))}
        </span>
      )}
    </Command.Item>
  )
}
