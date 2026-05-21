'use client'

/**
 * AccountSettingsClient V5.2 — refonte 2026-05-21 (3e itération).
 *
 * Architecture tabs horizontaux + content focus (1 section à la fois).
 * Hiérarchie visuelle claire : un seul groupe d'infos visible, le reste
 * accessible via la navigation onglets. URL hash sync pour partage/refresh.
 *
 * 5 tabs :
 *   1. Profil       — user + cabinet (forms inline always visible)
 *   2. Abonnement   — plan KPI hero + quotas + stockage + factures
 *   3. Modules      — 9 add-ons (grid 2-col lg, 1 col mobile)
 *   4. Conformité   — ADEME + notifications + sync calendrier
 *   5. Légal        — mentions/CGU/CGV/RGPD + zone danger
 *
 * DS v5 : sage bg + dark accents + chartreuse active state.
 * Mobile : tabs en flex scrollable horizontal.
 * Workflow résiliation `/dashboard/account/cancellation?step=1` PROTÉGÉ.
 */

import { CalendarSyncExport } from '@/components/calendar/calendar-sync-export'
import { StorageQuotaCard } from '@/components/storage/StorageQuotaCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatPriceEur, formatPriceEurCompact } from '@/lib/format/price'
import { cn } from '@/lib/utils'
import { ADDON_MODULES, type PricingPlanCode, PRICING_PLANS } from '@/lib/pricing-plans'
import {
  ArrowRight,
  Bell,
  Building2,
  Calculator,
  Calendar,
  CreditCard,
  Download,
  ExternalLink,
  IdCard,
  Layers,
  Palette,
  Radar,
  Shield,
  User as UserIcon,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'

import { AdemeForm } from './ademe-form'
import { CompanyForm } from './company-form'
import { DeleteAccountButton } from './delete-account-button'
import { NotificationPrefsForm } from './notification-prefs-form'
import { ProfileForm } from './profile-form'
import { StartTrialButton } from './start-trial-button'

type TabKey = 'profil' | 'abonnement' | 'modules' | 'conformite' | 'legal'

const TABS: ReadonlyArray<{ key: TabKey; label: string; icon: typeof CreditCard }> = [
  { key: 'profil', label: 'Profil', icon: UserIcon },
  { key: 'abonnement', label: 'Abonnement', icon: CreditCard },
  { key: 'modules', label: 'Modules', icon: Layers },
  { key: 'conformite', label: 'Conformité', icon: Radar },
  { key: 'legal', label: 'Légal', icon: Shield },
]

interface AccountSettingsClientProps {
  profile: { full_name: string | null; email: string; phone: string | null }
  organization: {
    name: string | null
    siret: string | null
    vat_number: string | null
    address: string | null
    postal_code: string | null
    city: string | null
    certification_n: string | null
  }
  subscription: {
    status: string
    cancel_at_period_end: boolean | null
    missions_included: number | null
    overage_price_cents: number | null
    current_period_end: string | null
  } | null
  planCode: PricingPlanCode | null
  planName: string | null
  missionsCount: number
  missionsQuota: number
  overage: number
  overageTotal: number
  usagePct: number
  certificatRge: string | null
  ademeMonitoringEnabled: boolean
  lastAdemeSyncAt: string | null
  monthlyReportEnabled: boolean
  calendarHttpsUrl: string
  calendarWebcalUrl: string
  storageUsage: { usedBytes: number; quotaBytes: number } | null
  modulesIncludedMap: Record<string, boolean>
}

export function AccountSettingsClient(props: AccountSettingsClientProps) {
  const [tab, setTab] = useState<TabKey>('profil')

  // Sync URL hash ↔ tab pour deep link / share / refresh.
  useEffect(() => {
    const hash = window.location.hash.slice(1) as TabKey
    if (hash && TABS.some((t) => t.key === hash)) {
      setTab(hash)
    }
  }, [])

  useEffect(() => {
    if (window.location.hash !== `#${tab}`) {
      window.history.replaceState(null, '', `#${tab}`)
    }
  }, [tab])

  return (
    <div className="space-y-5">
      {/* ════════════════════════════════════════════════════════════
          TABS NAVIGATION
          ══════════════════════════════════════════════════════════ */}
      <div
        role="tablist"
        aria-label="Sections réglages"
        className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1 border-b border-[#0F1419]/[0.08]"
      >
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${t.key}`}
              onClick={() => setTab(t.key)}
              className={cn(
                'relative flex items-center gap-2 px-4 py-2.5 rounded-t-[10px] text-[13px] font-medium whitespace-nowrap transition-colors',
                active
                  ? 'text-[#0F1419] bg-white'
                  : 'text-[#0F1419]/55 hover:text-[#0F1419] hover:bg-white/50',
              )}
            >
              <Icon className="size-4" strokeWidth={active ? 2.25 : 1.75} />
              <span>{t.label}</span>
              {active && (
                <span
                  aria-hidden
                  className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full bg-[#D4F542]"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════
          TAB CONTENT
          ══════════════════════════════════════════════════════════ */}
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={tab} className="max-w-4xl">
        {tab === 'profil' && <ProfilTab props={props} />}
        {tab === 'abonnement' && <AbonnementTab props={props} />}
        {tab === 'modules' && <ModulesTab props={props} />}
        {tab === 'conformite' && <ConformiteTab props={props} />}
        {tab === 'legal' && <LegalTab props={props} />}
      </div>
    </div>
  )
}

/* ============== TAB 1 — PROFIL ============== */

function ProfilTab({ props }: { props: AccountSettingsClientProps }) {
  const initials = getInitials(props.profile.full_name ?? props.profile.email)

  return (
    <div className="space-y-5">
      {/* Identité user */}
      <Card variant="opaque" padding="default" className="space-y-5">
        <div className="flex items-center gap-4">
          <div
            aria-hidden
            className="size-14 rounded-full bg-[#0F1419] text-[#D4F542] flex items-center justify-center font-mono font-semibold text-[18px] shrink-0"
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-[#0F1419]/55">
              Identité
            </p>
            <p className="text-[18px] font-semibold text-[#0F1419] truncate mt-0.5">
              {props.profile.full_name ?? '—'}
            </p>
            <p className="text-[13px] text-[#0F1419]/65 truncate">
              {props.profile.email}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-[#0F1419]/[0.08]">
          <ProfileForm
            initial={{
              full_name: props.profile.full_name,
              email: props.profile.email,
              phone: props.profile.phone,
            }}
          />
        </div>
      </Card>

      {/* Cabinet */}
      <Card variant="opaque" padding="default" className="space-y-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="size-10 rounded-md bg-[#AF52DE]/15 text-[#AF52DE] flex items-center justify-center shrink-0"
          >
            <Building2 className="size-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-[#0F1419]/55">
              Cabinet
            </p>
            <p className="text-[16px] font-semibold text-[#0F1419] truncate mt-0.5">
              {props.organization.name ?? '—'}
            </p>
            {props.organization.siret && (
              <p className="text-[12px] text-[#0F1419]/55">
                SIRET {formatSiret(props.organization.siret)}
              </p>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-[#0F1419]/[0.08]">
          <CompanyForm initial={props.organization} />
        </div>
      </Card>

      {/* Raccourcis personnalisation */}
      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionTitle icon={Palette} title="Personnalisation" iconColor="#FF9500" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ShortcutCard
            href="/dashboard/compte/branding"
            icon={Palette}
            iconBg="#FF9500"
            label="Logo & couleur"
            sublabel="Identité visuelle cabinet"
          />
          <ShortcutCard
            href="/dashboard/compte/tarifs"
            icon={Calculator}
            iconBg="#34C759"
            label="Mes tarifs"
            sublabel="Prestations & packs"
          />
          <ShortcutCard
            href="/dashboard/compte/carte-visite"
            icon={IdCard}
            iconBg="#5AC8FA"
            label="Carte de visite"
            sublabel="QR + Wallet"
          />
        </div>
      </Card>
    </div>
  )
}

/* ============== TAB 2 — ABONNEMENT ============== */

function AbonnementTab({ props }: { props: AccountSettingsClientProps }) {
  const isCancelling = props.subscription?.cancel_at_period_end === true
  const isActive = props.subscription?.status === 'active'
  const currentPlan = props.planCode
    ? PRICING_PLANS.find((p) => p.code === props.planCode) ?? null
    : null
  const periodEnd = props.subscription?.current_period_end ?? null

  return (
    <div className="space-y-5">
      {/* HERO Plan KPI dramatisé */}
      <Card variant="opaque" padding="default" className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="space-y-3">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#0F1419]/55">
              Forfait actuel
            </p>
            <p className="font-serif italic text-[44px] md:text-[56px] leading-none text-[#0F1419]">
              {props.planName ?? 'Aucun'}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {currentPlan && (
                <span className="font-mono text-[15px] tabular-nums text-[#0F1419] font-semibold">
                  {formatPriceEurCompact(currentPlan.monthlyPrice)} HT
                  <span className="text-[#0F1419]/55 font-normal">/mois</span>
                </span>
              )}
              {isActive && (
                <Badge variant={isCancelling ? 'orange' : 'green'} className="text-[10px]">
                  {isCancelling ? 'Annulation en cours' : 'Actif'}
                </Badge>
              )}
            </div>
            {periodEnd && (
              <p className="text-[12px] text-[#0F1419]/55">
                Renouvellement le {formatDateFr(periodEnd)}
              </p>
            )}
          </div>

          {/* KPI missions ce mois */}
          {props.missionsQuota > 0 ? (
            <div className="rounded-[14px] bg-[#F5F7F4] p-5 space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#0F1419]/55">
                Missions ce mois
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-serif italic text-[36px] leading-none text-[#0F1419]">
                  {props.missionsCount}
                </span>
                <span className="text-[#0F1419]/55 text-[14px]">
                  / {props.missionsQuota}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#0F1419]/[0.08] overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all',
                    props.usagePct >= 100
                      ? 'bg-[#DC2626]'
                      : props.usagePct >= 80
                        ? 'bg-[#FF9500]'
                        : 'bg-[#D4F542]',
                  )}
                  style={{ width: `${Math.min(props.usagePct, 100)}%` }}
                />
              </div>
              {props.overage > 0 && (
                <p className="text-[12px] text-[#DC2626] font-medium">
                  +{props.overage} mission{props.overage > 1 ? 's' : ''} hors forfait —{' '}
                  {formatPriceEur(Math.round(props.overageTotal * 100))}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-[14px] bg-[#F5F7F4] p-5 space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#0F1419]/55">
                Missions ce mois
              </p>
              <p className="font-serif italic text-[44px] leading-none text-[#0F1419]">
                {props.missionsCount}
              </p>
              <p className="text-[11px] text-[#0F1419]/55">Forfait illimité</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-5 pt-5 border-t border-[#0F1419]/[0.08]">
          <Button asChild variant="outline" size="default" className="flex-1">
            <Link href="/dashboard/facturation">
              <CreditCard className="size-4" /> Mes factures
            </Link>
          </Button>
          {isActive && (
            <Button asChild variant="default" size="default" className="flex-1">
              <Link href="/pricing">
                Changer de formule <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>
      </Card>

      {/* Storage */}
      {props.storageUsage && (
        <Card variant="opaque" padding="default" className="space-y-3">
          <SectionTitle icon={Layers} title="Stockage cloud" iconColor="#0F1419" />
          <StorageQuotaCard
            usedBytes={props.storageUsage.usedBytes}
            quotaBytes={props.storageUsage.quotaBytes}
          />
        </Card>
      )}
    </div>
  )
}

/* ============== TAB 3 — MODULES ============== */

function ModulesTab({ props }: { props: AccountSettingsClientProps }) {
  return (
    <div className="space-y-4">
      <Card variant="opaque" padding="default" className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SectionTitle
            icon={Layers}
            title={`Modules add-ons · ${ADDON_MODULES.length}`}
            iconColor="#D4F542"
            iconFg="#0F1419"
          />
        </div>
        <p className="text-[12px] text-[#0F1419]/55">
          Modules activables séparément. Essai gratuit 14 jours, désactivables d'un clic.
        </p>
      </Card>

      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {ADDON_MODULES.map((m) => {
          const included = props.modulesIncludedMap[m.code] === true
          return (
            <li
              key={m.code}
              className={cn(
                'flex flex-col gap-3 p-4 rounded-[14px] border transition-all bg-white',
                included
                  ? 'border-[#D4F542]/50 bg-[#D4F542]/[0.10]'
                  : 'border-[#0F1419]/[0.08] hover:border-[#0F1419]/20 hover:shadow-sm',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#0F1419] leading-tight">
                    {m.name}
                  </p>
                  <p className="text-[12px] text-[#0F1419]/55 mt-1 line-clamp-2">
                    {m.description}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-[14px] tabular-nums font-semibold text-[#0F1419]">
                    {formatPriceEurCompact(m.monthlyPrice)}
                  </p>
                  <p className="text-[10px] text-[#0F1419]/55">par mois</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[#0F1419]/[0.06]">
                {included ? (
                  <Badge variant="green" className="text-[10px]">
                    Inclus dans votre forfait
                  </Badge>
                ) : (
                  <span className="text-[11px] text-[#0F1419]/55">14 j d'essai gratuit</span>
                )}
                {!included && <StartTrialButton moduleCode={m.code} />}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ============== TAB 4 — CONFORMITÉ ============== */

function ConformiteTab({ props }: { props: AccountSettingsClientProps }) {
  return (
    <div className="space-y-5">
      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionTitle icon={Radar} title="Surveillance ADEME" iconColor="#FF9500" />
        <AdemeForm
          initialCertificatRge={props.certificatRge}
          initialMonitoringEnabled={props.ademeMonitoringEnabled}
          lastSyncAt={props.lastAdemeSyncAt}
        />
      </Card>

      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionTitle icon={Bell} title="Notifications email" iconColor="#34C759" />
        <NotificationPrefsForm initialMonthlyReportEnabled={props.monthlyReportEnabled} />
      </Card>

      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionTitle icon={Calendar} title="Synchronisation calendrier" iconColor="#5AC8FA" />
        <CalendarSyncExport
          httpsUrl={props.calendarHttpsUrl}
          webcalUrl={props.calendarWebcalUrl}
        />
      </Card>
    </div>
  )
}

/* ============== TAB 5 — LÉGAL ============== */

function LegalTab({ props }: { props: AccountSettingsClientProps }) {
  const isActive = props.subscription?.status === 'active'

  return (
    <div className="space-y-5">
      {/* Légal & RGPD */}
      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionTitle icon={Shield} title="Légal & RGPD" iconColor="#48484A" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <LegalLink href="/mentions-legales" label="Mentions légales" />
          <LegalLink href="/cgu" label="CGU" />
          <LegalLink href="/cgv" label="CGV" />
          <LegalLink href="/confidentialite" label="Politique RGPD" />
        </div>

        <div className="pt-4 border-t border-[#0F1419]/[0.08]">
          <form action="/api/rgpd/request" method="POST">
            <input type="hidden" name="type" value="export" />
            <Button type="submit" variant="outline" size="default" className="w-full sm:w-auto">
              <Download className="size-4" /> Exporter toutes mes données (RGPD)
            </Button>
          </form>
        </div>

        <p className="text-[11px] text-[#0F1419]/55 leading-relaxed pt-2 border-t border-[#0F1419]/[0.08]">
          Vos factures KOVAS sont émises HT avec TVA 20% en sus, déductible si vous êtes
          assujetti. Conservation 10 ans (obligation comptable L.123-22).
        </p>
      </Card>

      {/* Zone danger */}
      <Card
        variant="opaque"
        padding="default"
        className="border-l-2 border-l-[#DC2626]/30 space-y-4"
      >
        <SectionTitle icon={XCircle} title="Zone danger" iconColor="#DC2626" />

        <p className="text-[12px] text-[#0F1419]/55 leading-relaxed">
          Conformément au décret 2023-417 et au RGPD, vos données sont conservées 90 jours en
          grâce avant suppression irréversible. Vos factures restent conservées 10 ans
          (obligation comptable L.123-22).
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          {isActive && (
            <Button asChild variant="outline" size="default" className="flex-1">
              <Link href="/dashboard/account/cancellation?step=1">
                Résilier mon abonnement
              </Link>
            </Button>
          )}
          <DeleteAccountButton />
        </div>
      </Card>
    </div>
  )
}

/* ============== SOUS-COMPOSANTS ============== */

function SectionTitle({
  icon: Icon,
  iconColor,
  iconFg = '#FFFFFF',
  title,
}: {
  icon: typeof CreditCard
  iconColor: string
  iconFg?: string
  title: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="size-8 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: iconColor }}
      >
        <Icon className="size-4" style={{ color: iconFg }} />
      </span>
      <h2 className="font-sans text-[15px] font-semibold text-[#0F1419]">{title}</h2>
    </div>
  )
}

function ShortcutCard({
  href,
  icon: Icon,
  iconBg,
  label,
  sublabel,
}: {
  href: string
  icon: typeof CreditCard
  iconBg: string
  label: string
  sublabel: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 p-4 rounded-[12px] bg-white border border-[#0F1419]/[0.08] hover:border-[#0F1419]/20 hover:shadow-sm transition-all"
    >
      <span
        aria-hidden
        className="size-10 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: iconBg }}
      >
        <Icon className="size-5 text-white" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[#0F1419] leading-tight">{label}</p>
        <p className="text-[11px] text-[#0F1419]/55 leading-tight mt-1">{sublabel}</p>
      </div>
    </Link>
  )
}

function LegalLink({ href, label }: { href: string; label: string }): ReactNode {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 px-4 py-3 rounded-[10px] text-[13px] text-[#0F1419] hover:bg-[#F5F7F4] transition-colors border border-[#0F1419]/[0.06]"
    >
      <span>{label}</span>
      <ExternalLink className="size-3.5 text-[#0F1419]/40" />
    </Link>
  )
}

/* ============== HELPERS ============== */

function getInitials(nameOrEmail: string): string {
  const clean = nameOrEmail.trim()
  if (!clean) return '·'
  if (clean.includes('@')) return clean[0]?.toUpperCase() ?? '·'
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

function formatSiret(siret: string): string {
  const clean = siret.replace(/\s/g, '')
  if (clean.length !== 14) return siret
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)} ${clean.slice(9, 14)}`
}

function formatDateFr(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
