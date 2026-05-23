'use client'

/**
 * AccountSettingsClient V5.3 — refonte 2026-05-23.
 *
 * Aligné sur pattern fiche client (`/dashboard/clients/[id]`) :
 *  - Tabs canoniques style PageTabs (pillule navy active, sync URL ?tab=)
 *  - 5 tabs : Profil / Sécurité / Abonnement / Cabinet / Facturation
 *  - Contenu serveur passé en props, édition via forms inline
 *  - Mobile responsive (overflow-x-auto)
 *
 * Workflow résiliation /dashboard/account/cancellation PROTÉGÉ (décret 2023-417).
 *
 * Réutilisation existante :
 *  - ProfileForm, CompanyForm, AdemeForm, NotificationPrefsForm
 *  - DeleteAccountButton, StartTrialButton, CalendarSyncExport, StorageQuotaCard
 *  - ADDON_MODULES catalog + PRICING_PLANS canonique
 */

import { CalendarSyncExport } from '@/components/calendar/calendar-sync-export'
import { StorageQuotaCard } from '@/components/storage/StorageQuotaCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatPriceEur, formatPriceEurCompact } from '@/lib/format/price'
import { ADDON_MODULES, PRICING_PLANS, type PricingPlanCode } from '@/lib/pricing-plans'
import { cn } from '@/lib/utils'
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
  KeyRound,
  Layers,
  type LucideIcon,
  Palette,
  Radar,
  Receipt,
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

type TabKey = 'profil' | 'securite' | 'abonnement' | 'cabinet' | 'facturation'

const TABS: ReadonlyArray<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: 'profil', label: 'Profil', icon: UserIcon },
  { key: 'securite', label: 'Sécurité', icon: Shield },
  { key: 'abonnement', label: 'Abonnement', icon: CreditCard },
  { key: 'cabinet', label: 'Cabinet', icon: Building2 },
  { key: 'facturation', label: 'Facturation', icon: Receipt },
]

interface AccountSettingsClientProps {
  initialTab: TabKey
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
  const [tab, setTab] = useState<TabKey>(props.initialTab)

  // Sync URL ?tab=X via history.replaceState (pas de rerender server).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (url.searchParams.get('tab') !== tab) {
      url.searchParams.set('tab', tab)
      window.history.replaceState(null, '', url.toString())
    }
  }, [tab])

  return (
    <div className="space-y-6">
      {/* ════════════════════════════════════════════════════════════
          PAGE TABS — style canonique (idem clients/[id])
          ══════════════════════════════════════════════════════════ */}
      <nav
        aria-label="Sections compte"
        role="tablist"
        className="flex items-center gap-1 overflow-x-auto rounded-pill border border-rule/60 bg-paper/85 p-1 shadow-glass-sm backdrop-blur-xl"
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
                'inline-flex items-center gap-2 whitespace-nowrap rounded-pill px-4 py-1.5 text-sm transition-colors',
                active
                  ? 'bg-navy text-paper font-semibold shadow-accent'
                  : 'text-ink-mute hover:text-ink font-medium',
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{t.label}</span>
            </button>
          )
        })}
      </nav>

      {/* ════════════════════════════════════════════════════════════
          TAB CONTENT
          ══════════════════════════════════════════════════════════ */}
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={tab}>
        {tab === 'profil' && (
          <div className="max-w-3xl">
            <ProfilTab props={props} />
          </div>
        )}
        {tab === 'securite' && (
          <div className="max-w-3xl">
            <SecuriteTab props={props} />
          </div>
        )}
        {tab === 'abonnement' && (
          <div className="max-w-4xl">
            <AbonnementTab props={props} />
          </div>
        )}
        {tab === 'cabinet' && (
          <div className="max-w-3xl">
            <CabinetTab props={props} />
          </div>
        )}
        {tab === 'facturation' && (
          <div className="max-w-3xl">
            <FacturationTab props={props} />
          </div>
        )}
      </div>
    </div>
  )
}

/* ============== TAB 1 — PROFIL ============== */

function ProfilTab({ props }: { props: AccountSettingsClientProps }) {
  const initials = getInitials(props.profile.full_name ?? props.profile.email)

  return (
    <div className="space-y-5">
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
            <p className="text-[13px] text-[#0F1419]/65 truncate">{props.profile.email}</p>
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
    </div>
  )
}

/* ============== TAB 2 — SÉCURITÉ ============== */

function SecuriteTab({ props }: { props: AccountSettingsClientProps }) {
  const isActive = props.subscription?.status === 'active'

  return (
    <div className="space-y-5">
      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionTitle icon={KeyRound} title="Authentification" iconColor="#0F1419" />
        <p className="text-[13px] text-[#0F1419]/65 leading-relaxed">
          Vous êtes connecté avec l'email <strong>{props.profile.email}</strong>. Pour changer votre
          mot de passe, utilisez le lien de récupération depuis la page de connexion. Pour modifier
          l'adresse email, contactez le support.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button asChild variant="outline" size="default">
            <Link href="/reset-password">
              <KeyRound className="size-4" /> Réinitialiser le mot de passe
            </Link>
          </Button>
        </div>
      </Card>

      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionTitle icon={Shield} title="Données personnelles · RGPD" iconColor="#48484A" />
        <p className="text-[13px] text-[#0F1419]/65 leading-relaxed">
          Vous pouvez à tout moment exporter vos données ou demander leur suppression. Conformément
          au décret 2023-417 et au RGPD, une période de grâce de 90 jours s'applique avant
          suppression irréversible. Vos factures restent conservées 10 ans (obligation comptable
          L.123-22).
        </p>
        <form action="/api/rgpd/request" method="POST">
          <input type="hidden" name="type" value="export" />
          <Button type="submit" variant="outline" size="default" className="w-full sm:w-auto">
            <Download className="size-4" /> Exporter toutes mes données
          </Button>
        </form>
      </Card>

      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionTitle icon={ExternalLink} title="Documents légaux" iconColor="#0F1419" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <LegalLink href="/mentions-legales" label="Mentions légales" />
          <LegalLink href="/cgu" label="CGU" />
          <LegalLink href="/cgv" label="CGV" />
          <LegalLink href="/confidentialite" label="Politique RGPD" />
        </div>
      </Card>

      <Card
        variant="opaque"
        padding="default"
        className="border-l-2 border-l-[#DC2626]/30 space-y-4"
      >
        <SectionTitle icon={XCircle} title="Zone danger" iconColor="#DC2626" />
        <p className="text-[12px] text-[#0F1419]/55 leading-relaxed">
          Conformément au décret 2023-417 et au RGPD, vos données sont conservées 90 jours en grâce
          avant suppression irréversible. Vos factures restent conservées 10 ans (obligation
          comptable L.123-22).
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          {isActive && (
            <Button asChild variant="outline" size="default" className="flex-1">
              <Link href="/dashboard/account/cancellation?step=1">Résilier mon abonnement</Link>
            </Button>
          )}
          <DeleteAccountButton />
        </div>
      </Card>
    </div>
  )
}

/* ============== TAB 3 — ABONNEMENT ============== */

function AbonnementTab({ props }: { props: AccountSettingsClientProps }) {
  const isCancelling = props.subscription?.cancel_at_period_end === true
  const isActive = props.subscription?.status === 'active'
  const currentPlan = props.planCode
    ? (PRICING_PLANS.find((p) => p.code === props.planCode) ?? null)
    : null
  const periodEnd = props.subscription?.current_period_end ?? null

  return (
    <div className="space-y-5">
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

          {props.missionsQuota > 0 ? (
            <div className="rounded-[14px] bg-[#F5F7F4] p-5 space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#0F1419]/55">
                Missions ce mois
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-serif italic text-[36px] leading-none text-[#0F1419]">
                  {props.missionsCount}
                </span>
                <span className="text-[#0F1419]/55 text-[14px]">/ {props.missionsQuota}</span>
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

      <Card variant="opaque" padding="default" className="space-y-3">
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
      </Card>
    </div>
  )
}

/* ============== TAB 4 — CABINET ============== */

function CabinetTab({ props }: { props: AccountSettingsClientProps }) {
  return (
    <div className="space-y-5">
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
              Identité cabinet
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

      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionTitle icon={Radar} title="Surveillance ADEME" iconColor="#FF9500" />
        <AdemeForm
          initialCertificatRge={props.certificatRge}
          initialMonitoringEnabled={props.ademeMonitoringEnabled}
          lastSyncAt={props.lastAdemeSyncAt}
        />
      </Card>

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

/* ============== TAB 5 — FACTURATION ============== */

function FacturationTab({ props }: { props: AccountSettingsClientProps }) {
  return (
    <div className="space-y-5">
      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionTitle icon={Receipt} title="Historique de facturation" iconColor="#0F1419" />
        <p className="text-[13px] text-[#0F1419]/65 leading-relaxed">
          Toutes vos factures KOVAS (abonnement + dépassements) sont disponibles en téléchargement
          PDF. TVA 20% en sus, déductible si vous êtes assujetti. Conservation 10 ans (obligation
          comptable L.123-22).
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button asChild variant="default" size="default">
            <Link href="/dashboard/facturation">
              <Receipt className="size-4" /> Accéder à mes factures
            </Link>
          </Button>
          <Button asChild variant="outline" size="default">
            <Link href="/pricing">
              <ArrowRight className="size-4" /> Comparer les forfaits
            </Link>
          </Button>
        </div>
      </Card>

      {props.storageUsage && (
        <Card variant="opaque" padding="default" className="space-y-3">
          <SectionTitle icon={Layers} title="Stockage cloud" iconColor="#0F1419" />
          <StorageQuotaCard
            usedBytes={props.storageUsage.usedBytes}
            quotaBytes={props.storageUsage.quotaBytes}
          />
        </Card>
      )}

      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionTitle icon={Bell} title="Notifications email" iconColor="#34C759" />
        <NotificationPrefsForm initialMonthlyReportEnabled={props.monthlyReportEnabled} />
      </Card>

      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionTitle icon={Calendar} title="Synchronisation calendrier" iconColor="#5AC8FA" />
        <CalendarSyncExport httpsUrl={props.calendarHttpsUrl} webcalUrl={props.calendarWebcalUrl} />
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
  icon: LucideIcon
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
  icon: LucideIcon
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
  const first = parts[0] ?? ''
  if (parts.length === 1) return first.slice(0, 2).toUpperCase()
  const last = parts[parts.length - 1] ?? ''
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
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
