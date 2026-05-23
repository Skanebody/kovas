/**
 * /app/prescripteurs — CRM prescripteurs (agences, notaires, syndics).
 */

import {
  AppListTable,
  AppListTableCell,
  AppListTableHead,
  AppListTableRow,
} from '@/components/ui/app-list-table'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { KpiHero } from '@/components/ui/kpi-hero'
import { Select } from '@/components/ui/select'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  PRESCRIBER_SILENT_THRESHOLD_DAYS,
  PRESCRIBER_TIERS,
  PRESCRIBER_TIER_BADGE_CLASS,
  PRESCRIBER_TIER_LABELS,
  type PrescriberContact,
  type PrescriberRelationshipRow,
  type PrescriberRowWithContact,
  type PrescriberTier,
  isSilent,
} from '@/lib/prescribers/types'
import { cn } from '@/lib/utils'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AlertTriangle, Network } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Prescripteurs' }

interface PageProps {
  searchParams: Promise<{
    tier?: string
    silentDays?: string
    sort?: string
  }>
}

interface PrescribersTable {
  select: (cols: string) => {
    eq: (col: string, val: string) => PrescribersChain
  }
}
type PrescribersChain = {
  eq: (col: string, val: string) => PrescribersChain
  gte: (col: string, val: number) => PrescribersChain
  order: (col: string, opts: { ascending: boolean; nullsFirst?: boolean }) => PrescribersChain
  limit: (n: number) => Promise<{
    data: PrescriberRelationshipRow[] | null
    error: { message: string } | null
  }>
}
interface ContactsTable {
  select: (cols: string) => {
    in: (
      col: string,
      values: string[],
    ) => Promise<{
      data: PrescriberContact[] | null
      error: { message: string } | null
    }>
  }
}

function prescribersTable(s: SupabaseClient): PrescribersTable {
  return (s as unknown as { from(t: 'prescriber_relationships'): PrescribersTable }).from(
    'prescriber_relationships',
  )
}
function contactsTable(s: SupabaseClient): ContactsTable {
  return (s as unknown as { from(t: 'contacts'): ContactsTable }).from('contacts')
}

const VALID_SORTS = ['revenue', 'missions', 'silence', 'tier'] as const
type SortKey = (typeof VALID_SORTS)[number]

function formatRevenue(eur: number): string {
  return `${Math.round(eur).toLocaleString('fr-FR')} €`
}
function formatLastMission(iso: string | null): string {
  if (!iso) return 'Jamais'
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 30) return `il y a ${days} j`
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`
  return `il y a ${Math.floor(days / 365)} an`
}

export default async function PrescribersPage({ searchParams }: PageProps) {
  const { supabase, orgId } = await getCurrentUser()
  const params = await searchParams

  const tierFilter = (PRESCRIBER_TIERS as readonly string[]).includes(params.tier ?? '')
    ? (params.tier as PrescriberTier)
    : null
  const silentDaysRaw = Number.parseInt(params.silentDays ?? '0', 10)
  const silentDays = Number.isFinite(silentDaysRaw) && silentDaysRaw > 0 ? silentDaysRaw : null
  const sortParam = (params.sort ?? 'revenue') as SortKey
  const sort = VALID_SORTS.includes(sortParam) ? sortParam : 'revenue'

  let q = prescribersTable(supabase)
    .select(
      'id, organization_id, contact_id, user_id, tier, revenue_12m_eur, missions_12m_count, acceptance_rate, avg_basket_eur, last_mission_at, last_contact_at, silent_since_days, notes, next_action_at, next_action_type, created_at, updated_at',
    )
    .eq('organization_id', orgId)

  if (tierFilter) q = q.eq('tier', tierFilter)
  if (silentDays != null) q = q.gte('silent_since_days', silentDays)

  switch (sort) {
    case 'missions':
      q = q.order('missions_12m_count', { ascending: false })
      break
    case 'silence':
      q = q.order('silent_since_days', { ascending: false, nullsFirst: false })
      break
    case 'tier':
      q = q.order('tier', { ascending: true }).order('revenue_12m_eur', { ascending: false })
      break
    default:
      q = q.order('revenue_12m_eur', { ascending: false })
  }

  const { data: rows } = await q.limit(200)
  const list = rows ?? []

  // Join contacts
  let contactsById = new Map<string, PrescriberContact>()
  if (list.length > 0) {
    const { data: contacts } = await contactsTable(supabase)
      .select('id, display_name, kind, email, phone, company_name')
      .in(
        'id',
        list.map((r) => r.contact_id),
      )
    contactsById = new Map((contacts ?? []).map((c) => [c.id, c]))
  }
  const rich: PrescriberRowWithContact[] = list.map((r) => ({
    ...r,
    contact: contactsById.get(r.contact_id) ?? null,
  }))

  // KPI hero
  const totalRevenue = rich.reduce((sum, r) => sum + Number(r.revenue_12m_eur), 0)
  const tierCounts = rich.reduce<Record<PrescriberTier, number>>(
    (acc, r) => {
      acc[r.tier] = (acc[r.tier] ?? 0) + 1
      return acc
    },
    { platinum: 0, gold: 0, silver: 0, bronze: 0 },
  )
  const topTier: PrescriberTier =
    tierCounts.platinum > 0
      ? 'platinum'
      : tierCounts.gold > 0
        ? 'gold'
        : tierCounts.silver > 0
          ? 'silver'
          : 'bronze'
  const silentCount = rich.filter(isSilent).length

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="sticky top-0 z-20 -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-b sm:border border-rule/60 bg-paper/95 backdrop-blur-xl px-4 sm:px-7 py-5 shadow-glass-sm">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
            CRM cabinet
          </p>
          <h1 className="font-sans text-[28px] font-semibold leading-tight tracking-tight text-ink truncate">
            Vos <span className="font-serif italic font-normal text-ink-mute">prescripteurs</span>
            <span className="text-ink-mute">.</span>
          </h1>
          <p className="text-sm text-ink-mute max-w-xl">
            {rich.length} relations actives · {silentCount} silencieux &gt;
            {PRESCRIBER_SILENT_THRESHOLD_DAYS}j
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiHero value={rich.length} label="Prescripteurs actifs" trend={null} />
        <KpiHero value={formatRevenue(totalRevenue)} label="CA total 12m" trend={null} />
        <KpiHero
          value={PRESCRIBER_TIER_LABELS[topTier]}
          label="Tier dominant"
          hint={`${tierCounts[topTier]} prescripteurs`}
          trend={null}
        />
        <KpiHero
          value={silentCount}
          label="Silencieux à relancer"
          hint={`> ${PRESCRIBER_SILENT_THRESHOLD_DAYS}j`}
          trend={null}
        />
      </div>

      <form
        method="GET"
        className="rounded-2xl border border-rule glass-opaque p-4 grid grid-cols-1 sm:grid-cols-4 gap-3"
      >
        <Select name="tier" defaultValue={tierFilter ?? ''}>
          <option value="">Tous tiers</option>
          {PRESCRIBER_TIERS.map((t) => (
            <option key={t} value={t}>
              {PRESCRIBER_TIER_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select name="silentDays" defaultValue={silentDays ?? ''}>
          <option value="">Tout silence</option>
          <option value="30">Silencieux &gt; 30j</option>
          <option value="60">Silencieux &gt; 60j</option>
          <option value="90">Silencieux &gt; 90j</option>
        </Select>
        <Select name="sort" defaultValue={sort}>
          <option value="revenue">CA décroissant</option>
          <option value="missions">Volume missions</option>
          <option value="silence">Silence décroissant</option>
          <option value="tier">Tier</option>
        </Select>
        <div className="flex items-center gap-2 justify-end">
          {(tierFilter || silentDays != null) && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/prescripteurs">Réinitialiser</Link>
            </Button>
          )}
          <Button type="submit" variant="default" size="sm">
            Filtrer
          </Button>
        </div>
      </form>

      {rich.length === 0 ? (
        <EmptyState
          icon={Network}
          title="Aucun prescripteur encore."
          description="Vos prescripteurs sont créés automatiquement à partir de vos contacts kind=prescriber dès qu'une mission leur est rattachée."
          action={
            <Button asChild variant="accent">
              <Link href="/dashboard/clients/new">Créer un contact</Link>
            </Button>
          }
        />
      ) : (
        <AppListTable className="min-w-0">
          <AppListTableHead>
            <tr>
              <th className="text-left font-medium px-4 py-3 min-w-[180px]">Nom</th>
              <th className="text-left font-medium px-4 py-3 hidden sm:table-cell w-[110px]">
                Type
              </th>
              <th className="text-left font-medium px-4 py-3 w-[100px]">Tier</th>
              <th className="text-right font-medium px-4 py-3 hidden md:table-cell w-[90px]">
                Missions
              </th>
              <th className="text-right font-medium px-4 py-3 w-[120px]">CA 12m</th>
              <th className="text-right font-medium px-4 py-3 hidden lg:table-cell w-[120px]">
                Panier moyen
              </th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell w-[160px]">
                Dernière
              </th>
              <th className="text-left font-medium px-4 py-3 w-[160px]">Actions</th>
            </tr>
          </AppListTableHead>
          <tbody>
            {rich.map((r) => {
              const silent = isSilent(r)
              return (
                <AppListTableRow key={r.id}>
                  <AppListTableCell>
                    <Link
                      href={`/dashboard/prescripteurs/${r.id}`}
                      className="font-semibold text-ink hover:underline"
                    >
                      {r.contact?.display_name ?? '—'}
                    </Link>
                    {r.contact?.company_name ? (
                      <p className="text-[11px] text-ink-faint mt-0.5">{r.contact.company_name}</p>
                    ) : null}
                  </AppListTableCell>
                  <AppListTableCell className="hidden sm:table-cell text-ink-mute">
                    {r.contact?.kind ?? '—'}
                  </AppListTableCell>
                  <AppListTableCell>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]',
                        PRESCRIBER_TIER_BADGE_CLASS[r.tier],
                      )}
                    >
                      {PRESCRIBER_TIER_LABELS[r.tier]}
                    </span>
                  </AppListTableCell>
                  <AppListTableCell className="text-right hidden md:table-cell font-mono tabular-nums">
                    {r.missions_12m_count}
                  </AppListTableCell>
                  <AppListTableCell className="text-right font-mono tabular-nums text-ink">
                    {formatRevenue(Number(r.revenue_12m_eur))}
                  </AppListTableCell>
                  <AppListTableCell className="text-right font-mono tabular-nums hidden lg:table-cell text-ink-mute">
                    {r.avg_basket_eur ? formatRevenue(Number(r.avg_basket_eur)) : '—'}
                  </AppListTableCell>
                  <AppListTableCell className="hidden md:table-cell text-ink-mute">
                    <div className="flex items-center gap-2">
                      <span className={cn(silent && 'text-accent-red font-semibold')}>
                        {formatLastMission(r.last_mission_at)}
                      </span>
                      {silent ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-pill border border-accent-red/30 bg-accent-red/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent-red"
                          title={`Silencieux depuis ${r.silent_since_days} jours`}
                        >
                          <AlertTriangle className="size-3" />
                          {r.silent_since_days}j
                        </span>
                      ) : null}
                    </div>
                  </AppListTableCell>
                  <AppListTableCell>
                    <div className="flex items-center gap-1.5">
                      {r.contact?.phone ? (
                        <Button asChild variant="ghost" size="sm">
                          <a href={`tel:${r.contact.phone}`}>Appeler</a>
                        </Button>
                      ) : null}
                      {r.contact?.email ? (
                        <Button asChild variant="ghost" size="sm">
                          <a href={`mailto:${r.contact.email}`}>Email</a>
                        </Button>
                      ) : null}
                    </div>
                  </AppListTableCell>
                </AppListTableRow>
              )
            })}
          </tbody>
        </AppListTable>
      )}
    </div>
  )
}
