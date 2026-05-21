'use client'

/**
 * AccountSettingsClient V5 — refonte 2026-05-21.
 *
 * Architecture cible (DS v5 sage + dark + chartreuse) :
 *
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │ HERO STRIPE (full width)                                       │
 *   │  Avatar dark/chartreuse + Nom + Cabinet + Plan actif KPI       │
 *   │  Instrument Serif italic sur le nom du plan.                   │
 *   └───────────────────────────────────────────────────────────────┘
 *   ┌─────────────────┬─────────────────┬─────────────────┐
 *   │ COL 1 — Identité│ COL 2 — Abo +   │ COL 3 — Réglages│
 *   │ Profil          │ Stockage        │ ADEME           │
 *   │ Cabinet         │ Cap missions    │ Notifications   │
 *   │                 │ Period end      │ Calendrier      │
 *   └─────────────────┴─────────────────┴─────────────────┘
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │ MODULES (full width, grid 4-col xl, 2-col sm, 1-col mobile)   │
 *   └───────────────────────────────────────────────────────────────┘
 *   ┌─────────────────┬─────────────────────────────────────────────┐
 *   │ LÉGAL & RGPD    │ ZONE DANGER (résilier + supprimer)         │
 *   └─────────────────┴─────────────────────────────────────────────┘
 *
 * Workflow résiliation `/dashboard/account/cancellation?step=1` PROTÉGÉ
 * (décret 2023-417). ReactivationModal géré par la page server parent.
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
  ChevronDown,
  CreditCard,
  Download,
  ExternalLink,
  HardDrive,
  IdCard,
  Layers,
  Palette,
  Radar,
  Shield,
  User as UserIcon,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { type ReactNode, useState } from 'react'

import { AdemeForm } from './ademe-form'
import { CompanyForm } from './company-form'
import { DeleteAccountButton } from './delete-account-button'
import { NotificationPrefsForm } from './notification-prefs-form'
import { ProfileForm } from './profile-form'
import { StartTrialButton } from './start-trial-button'

type ExpandedSection = null | 'profile' | 'company' | 'ademe' | 'notifications'

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
  const [expanded, setExpanded] = useState<ExpandedSection>(null)
  const toggle = (key: Exclude<ExpandedSection, null>) =>
    setExpanded((cur) => (cur === key ? null : key))

  const isCancelling = props.subscription?.cancel_at_period_end === true
  const isActive = props.subscription?.status === 'active'
  const initials = getInitials(props.profile.full_name ?? props.profile.email)
  const currentPlan = props.planCode
    ? PRICING_PLANS.find((p) => p.code === props.planCode) ?? null
    : null
  const periodEnd = props.subscription?.current_period_end ?? null

  return (
    <div className="space-y-5">
      {/* ════════════════════════════════════════════════════════════
          HERO STRIPE — Identité + plan KPI dramatisé
          ══════════════════════════════════════════════════════════ */}
      <Card variant="opaque" padding="default" className="relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-center gap-4 md:gap-6">
          {/* Avatar */}
          <div
            aria-hidden
            className="size-14 md:size-16 rounded-full bg-[#0F1419] text-[#D4F542] flex items-center justify-center font-mono font-semibold text-[18px] md:text-[20px] shrink-0"
          >
            {initials}
          </div>

          {/* Identité + cabinet */}
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#0F1419]/55">
              Compte
            </p>
            <h2 className="text-[20px] md:text-[24px] font-semibold text-[#0F1419] leading-tight mt-0.5 truncate">
              {props.profile.full_name ?? '—'}
            </h2>
            <p className="text-[13px] text-[#0F1419]/65 mt-0.5 truncate">
              {props.organization.name ?? 'Sans cabinet'}
              {props.organization.siret ? ` · SIRET ${formatSiret(props.organization.siret)}` : ''}
            </p>
          </div>

          {/* Plan KPI dramatisé Instrument Serif */}
          <div className="md:text-right">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#0F1419]/55">
              Forfait actif
            </p>
            <p className="font-serif italic text-[28px] md:text-[36px] leading-none text-[#0F1419] mt-1">
              {props.planName ?? 'Aucun'}
            </p>
            <div className="flex md:justify-end items-center gap-2 mt-1.5 flex-wrap">
              {currentPlan && (
                <span className="font-mono text-[12px] tabular-nums text-[#0F1419]/70">
                  {formatPriceEurCompact(currentPlan.monthlyPrice)} HT/mois
                </span>
              )}
              {isActive && (
                <Badge
                  variant={isCancelling ? 'orange' : 'green'}
                  className="text-[10px]"
                >
                  {isCancelling ? 'Annulation en cours' : 'Actif'}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ════════════════════════════════════════════════════════════
          GRID 3 COLONNES — Identité / Abonnement+Stockage / Réglages
          ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 items-start">
        {/* ============== COL 1 — IDENTITÉ ============== */}
        <Card variant="opaque" padding="default" className="space-y-4">
          <SectionHeader icon={UserIcon} iconColor="#007AFF" title="Identité" />

          <InlineRow
            label="Mon profil"
            value={props.profile.email}
            sublabel={props.profile.phone ?? 'Téléphone non renseigné'}
            expanded={expanded === 'profile'}
            onToggle={() => toggle('profile')}
            expandContent={
              <ProfileForm
                initial={{
                  full_name: props.profile.full_name,
                  email: props.profile.email,
                  phone: props.profile.phone,
                }}
              />
            }
          />

          <InlineRow
            label="Mon cabinet"
            value={props.organization.name ?? '—'}
            sublabel={
              props.organization.siret
                ? `SIRET ${formatSiret(props.organization.siret)}`
                : 'SIRET non renseigné'
            }
            icon={Building2}
            iconColor="#AF52DE"
            expanded={expanded === 'company'}
            onToggle={() => toggle('company')}
            expandContent={<CompanyForm initial={props.organization} />}
          />

          {/* Raccourcis identité visuelle */}
          <div className="pt-3 border-t border-[#0F1419]/[0.08]">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#0F1419]/55 mb-2">
              Personnalisation
            </p>
            <div className="grid grid-cols-3 gap-2">
              <ShortcutTile
                href="/dashboard/compte/branding"
                icon={Palette}
                iconBg="#FF9500"
                label="Logo"
              />
              <ShortcutTile
                href="/dashboard/compte/tarifs"
                icon={Calculator}
                iconBg="#34C759"
                label="Tarifs"
              />
              <ShortcutTile
                href="/dashboard/compte/carte-visite"
                icon={IdCard}
                iconBg="#5AC8FA"
                label="Carte"
              />
            </div>
          </div>
        </Card>

        {/* ============== COL 2 — ABONNEMENT + STOCKAGE ============== */}
        <Card variant="opaque" padding="default" className="space-y-4">
          <SectionHeader icon={CreditCard} iconColor="#0F1419" title="Abonnement" />

          {/* KPI missions ce mois */}
          {props.missionsQuota > 0 ? (
            <div className="rounded-[14px] bg-[#F5F7F4] p-4 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#0F1419]/55">
                  Missions ce mois
                </p>
                <p className="font-mono text-[13px] tabular-nums">
                  <span className="text-[#0F1419] font-semibold">{props.missionsCount}</span>
                  <span className="text-[#0F1419]/55"> / {props.missionsQuota}</span>
                </p>
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
              {periodEnd && (
                <p className="text-[11px] text-[#0F1419]/55 pt-1 border-t border-[#0F1419]/[0.06]">
                  Renouvellement le {formatDateFr(periodEnd)}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-[14px] bg-[#F5F7F4] p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#0F1419]/55">
                Missions ce mois
              </p>
              <p className="font-serif italic text-[36px] leading-none text-[#0F1419] mt-1">
                {props.missionsCount}
              </p>
              <p className="text-[11px] text-[#0F1419]/55 mt-1">Forfait illimité</p>
            </div>
          )}

          {/* Storage gauge */}
          {props.storageUsage && (
            <div className="pt-3 border-t border-[#0F1419]/[0.08]">
              <div className="flex items-center gap-2 mb-2">
                <span
                  aria-hidden
                  className="size-6 rounded-md bg-[#0F1419] text-[#D4F542] flex items-center justify-center shrink-0"
                >
                  <HardDrive className="size-3" />
                </span>
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#0F1419]/55">
                  Stockage cloud
                </p>
              </div>
              <StorageQuotaCard
                usedBytes={props.storageUsage.usedBytes}
                quotaBytes={props.storageUsage.quotaBytes}
              />
            </div>
          )}

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link href="/dashboard/facturation">
                <CreditCard className="size-3.5" /> Mes factures
              </Link>
            </Button>
            {isActive && (
              <Button asChild variant="default" size="sm" className="flex-1">
                <Link href="/pricing">
                  Changer de formule <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </Card>

        {/* ============== COL 3 — CONFORMITÉ + NOTIFS + CALENDRIER ============== */}
        <Card variant="opaque" padding="default" className="space-y-4">
          <SectionHeader icon={Radar} iconColor="#FF9500" title="Réglages" />

          <InlineRow
            label="Surveillance ADEME"
            value={
              props.certificatRge
                ? `Cert. RGE ${props.certificatRge}`
                : 'Cert. RGE à renseigner'
            }
            sublabel={
              props.lastAdemeSyncAt
                ? `${props.ademeMonitoringEnabled ? 'Active' : 'En pause'} · Dernière sync ${formatRelative(props.lastAdemeSyncAt)}`
                : props.ademeMonitoringEnabled
                  ? 'Active · jamais sync'
                  : 'En pause'
            }
            icon={Radar}
            iconColor="#FF9500"
            expanded={expanded === 'ademe'}
            onToggle={() => toggle('ademe')}
            expandContent={
              <AdemeForm
                initialCertificatRge={props.certificatRge}
                initialMonitoringEnabled={props.ademeMonitoringEnabled}
                lastSyncAt={props.lastAdemeSyncAt}
              />
            }
          />

          <InlineRow
            label="Notifications email"
            value={`Rapport mensuel : ${props.monthlyReportEnabled ? 'Activé' : 'Désactivé'}`}
            icon={Bell}
            iconColor="#34C759"
            expanded={expanded === 'notifications'}
            onToggle={() => toggle('notifications')}
            expandContent={
              <NotificationPrefsForm
                initialMonthlyReportEnabled={props.monthlyReportEnabled}
              />
            }
          />

          <div className="pt-3 border-t border-[#0F1419]/[0.08]">
            <div className="flex items-center gap-2 mb-3">
              <span
                aria-hidden
                className="size-6 rounded-md bg-[#5AC8FA] text-white flex items-center justify-center shrink-0"
              >
                <Calendar className="size-3" />
              </span>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#0F1419]/55">
                Sync calendrier
              </p>
            </div>
            <CalendarSyncExport
              httpsUrl={props.calendarHttpsUrl}
              webcalUrl={props.calendarWebcalUrl}
            />
          </div>
        </Card>
      </div>

      {/* ════════════════════════════════════════════════════════════
          MODULES ADD-ONS — full width grid 4-col xl
          ══════════════════════════════════════════════════════════ */}
      <Card variant="opaque" padding="default" className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SectionHeader
            icon={Layers}
            iconColor="#D4F542"
            iconFg="#0F1419"
            title={`Modules · ${ADDON_MODULES.length}`}
          />
          <p className="text-[11px] text-[#0F1419]/55">
            Essai gratuit 14 jours · résiliable d'un clic
          </p>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {ADDON_MODULES.map((m) => {
            const included = props.modulesIncludedMap[m.code] === true
            return (
              <li
                key={m.code}
                className={cn(
                  'flex flex-col gap-2 p-4 rounded-[14px] border transition-all',
                  included
                    ? 'border-[#D4F542]/50 bg-[#D4F542]/[0.10]'
                    : 'border-[#0F1419]/[0.08] bg-white hover:border-[#0F1419]/20 hover:shadow-sm',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-semibold text-[#0F1419] leading-tight">
                    {m.name}
                  </p>
                  {included ? (
                    <Badge variant="green" className="text-[9px] shrink-0">
                      Inclus
                    </Badge>
                  ) : (
                    <span className="font-mono text-[12px] tabular-nums text-[#0F1419] shrink-0">
                      {formatPriceEurCompact(m.monthlyPrice)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#0F1419]/55 line-clamp-2 flex-1">
                  {m.description}
                </p>
                {!included && (
                  <div className="pt-2">
                    <StartTrialButton moduleCode={m.code} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      {/* ════════════════════════════════════════════════════════════
          LÉGAL + ZONE DANGER — 2 cols lg
          ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-start">
        {/* Légal & RGPD */}
        <Card variant="opaque" padding="default" className="space-y-3">
          <SectionHeader icon={Shield} iconColor="#48484A" title="Légal & RGPD" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <LegalLink href="/mentions-legales" label="Mentions légales" />
            <LegalLink href="/cgu" label="CGU" />
            <LegalLink href="/cgv" label="CGV" />
            <LegalLink href="/confidentialite" label="Politique RGPD" />
          </div>

          <div className="pt-3 border-t border-[#0F1419]/[0.08]">
            <form action="/api/rgpd/request" method="POST">
              <input type="hidden" name="type" value="export" />
              <Button type="submit" variant="outline" size="sm" className="w-full">
                <Download className="size-3.5" /> Exporter mes données (RGPD)
              </Button>
            </form>
          </div>

          <p className="text-[10px] text-[#0F1419]/55 leading-relaxed pt-1">
            Factures émises HT avec TVA 20% en sus, déductible si assujetti.
            Conservation 10 ans (L.123-22).
          </p>
        </Card>

        {/* Zone danger */}
        <Card
          variant="opaque"
          padding="default"
          className="border-l-2 border-l-[#DC2626]/30 space-y-3"
        >
          <SectionHeader icon={XCircle} iconColor="#DC2626" title="Zone danger" />

          <p className="text-[11px] text-[#0F1419]/55 leading-relaxed">
            Conformément au décret 2023-417, vos données sont conservées 90 jours en
            grâce avant suppression irréversible. Factures conservées 10 ans
            (L.123-22).
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            {isActive && (
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href="/dashboard/account/cancellation?step=1">
                  Résilier mon abonnement
                </Link>
              </Button>
            )}
            <DeleteAccountButton />
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ============== SOUS-COMPOSANTS ============== */

function SectionHeader({
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
        className="size-7 rounded-md flex items-center justify-center"
        style={{ backgroundColor: iconColor }}
      >
        <Icon className="size-3.5" style={{ color: iconFg }} />
      </span>
      <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] font-semibold text-[#0F1419]">
        {title}
      </h2>
    </div>
  )
}

function InlineRow({
  label,
  value,
  sublabel,
  icon,
  iconColor,
  expanded,
  onToggle,
  expandContent,
}: {
  label: string
  value: string
  sublabel?: string
  icon?: typeof CreditCard
  iconColor?: string
  expanded: boolean
  onToggle: () => void
  expandContent: ReactNode
}) {
  const Icon = icon
  return (
    <div className={cn(expanded ? 'space-y-3' : '')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full text-left flex items-start gap-3 group"
      >
        {Icon && iconColor && (
          <span
            aria-hidden
            className="size-9 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${iconColor}15`, color: iconColor }}
          >
            <Icon className="size-4" />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#0F1419]/55">
            {label}
          </p>
          <p className="text-[14px] font-medium text-[#0F1419] truncate mt-0.5">
            {value}
          </p>
          {sublabel && (
            <p className="text-[11px] text-[#0F1419]/55 mt-0.5 truncate">{sublabel}</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            'size-4 text-[#0F1419]/40 shrink-0 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded && (
        <div className="pt-3 border-t border-[#0F1419]/[0.08]">{expandContent}</div>
      )}
    </div>
  )
}

function ShortcutTile({
  href,
  icon: Icon,
  iconBg,
  label,
}: {
  href: string
  icon: typeof CreditCard
  iconBg: string
  label: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-1.5 p-2 rounded-[10px] bg-white border border-[#0F1419]/[0.08] hover:border-[#0F1419]/20 hover:shadow-sm transition-all"
    >
      <span
        aria-hidden
        className="size-8 rounded-md flex items-center justify-center"
        style={{ backgroundColor: iconBg }}
      >
        <Icon className="size-3.5 text-white" />
      </span>
      <p className="text-[11px] font-medium text-[#0F1419]">{label}</p>
    </Link>
  )
}

function LegalLink({ href, label }: { href: string; label: string }): ReactNode {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 px-3 py-2 rounded-[10px] text-[13px] text-[#0F1419] hover:bg-[#F5F7F4] transition-colors"
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

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.round(diffMs / 60_000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.round(h / 24)
  return `il y a ${d} j`
}

function formatDateFr(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
