'use client'

/**
 * AccountSettingsClient — Page Réglages simplifiée 2026-05-21.
 *
 * Refonte UX : remplace les drawers Radix iOS-style par un layout **plat
 * et direct**. Toutes les infos sont visibles d'un coup, l'édition se fait
 * inline via expand/collapse (un seul bloc ouvert à la fois).
 *
 * Architecture :
 *   1. Carte "Mon profil" — preview + bouton "Modifier" qui expand le form
 *   2. Carte "Mon cabinet" — idem
 *   3. Carte "Mon abonnement" — KPIs visibles + portail Stripe + résilier
 *   4. Carte "Mes raccourcis" — grid 2×3 de liens (Logo / Tarifs / Carte visite / Modules / ADEME / Notifications)
 *   5. Carte "Mon stockage" — StorageQuotaCard directement visible
 *   6. Carte "Préférences" — toggles inline (rapport mensuel)
 *   7. Carte "Calendrier" — sync iCal/webcal direct
 *   8. Carte "Modules add-ons" — liste verticale 9 modules avec essai 14j inline
 *   9. Carte "Légal & RGPD" — 5 liens texte + Export RGPD
 *  10. Zone danger en bas — résilier abonnement + supprimer compte
 *
 * Workflow résiliation `/dashboard/account/cancellation?step=1` PROTÉGÉ (décret 2023-417).
 * ReactivationModal + winback code gérés par la page server parent.
 */

import { CalendarSyncExport } from '@/components/calendar/calendar-sync-export'
import { StorageQuotaCard } from '@/components/storage/StorageQuotaCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ADDON_MODULES, type PricingPlanCode, PRICING_PLANS } from '@/lib/pricing-plans'
import {
  ArrowRight,
  Building2,
  Calculator,
  Calendar,
  ChevronDown,
  CreditCard,
  Download,
  ExternalLink,
  IdCard,
  Layers,
  Palette,
  Radar,
  Shield,
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
  const toggle = (key: ExpandedSection) =>
    setExpanded((cur) => (cur === key ? null : key))

  const isCancelling = props.subscription?.cancel_at_period_end === true
  const isActive = props.subscription?.status === 'active'
  const initials = getInitials(props.profile.full_name ?? props.profile.email)

  return (
    <div className="space-y-4">
      {/* ============== 1. PROFIL & CABINET ============== */}
      <Card variant="opaque" padding="default" className="space-y-4">
        {/* Identité user */}
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="size-12 rounded-full bg-[#0F1419] text-[#D4F542] flex items-center justify-center font-mono font-semibold text-[15px] shrink-0"
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-[#0F1419] truncate">
              {props.profile.full_name ?? '—'}
            </p>
            <p className="text-[12px] text-[#0F1419]/55 truncate">{props.profile.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggle('profile')}
            aria-expanded={expanded === 'profile'}
          >
            {expanded === 'profile' ? 'Fermer' : 'Modifier'}
            <ChevronDown
              className={cn(
                'size-4 transition-transform',
                expanded === 'profile' && 'rotate-180',
              )}
            />
          </Button>
        </div>

        {/* Form profil expand */}
        {expanded === 'profile' && (
          <div className="pt-3 border-t border-[#0F1419]/[0.08]">
            <ProfileForm
              initial={{
                full_name: props.profile.full_name,
                email: props.profile.email,
                phone: props.profile.phone,
              }}
            />
          </div>
        )}

        {/* Entreprise summary */}
        <div className="pt-3 border-t border-[#0F1419]/[0.08] flex items-start gap-3">
          <span
            aria-hidden
            className="size-9 rounded-md bg-[#AF52DE]/10 text-[#AF52DE] flex items-center justify-center shrink-0"
          >
            <Building2 className="size-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-[#0F1419]/55">
              Cabinet
            </p>
            <p className="text-[14px] font-medium text-[#0F1419] mt-0.5">
              {props.organization.name ?? '—'}
            </p>
            <p className="text-[12px] text-[#0F1419]/55 mt-0.5">
              {props.organization.siret
                ? `SIRET ${formatSiret(props.organization.siret)}`
                : 'SIRET non renseigné'}
              {props.organization.city ? ` · ${props.organization.city}` : ''}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggle('company')}
            aria-expanded={expanded === 'company'}
          >
            {expanded === 'company' ? 'Fermer' : 'Modifier'}
            <ChevronDown
              className={cn(
                'size-4 transition-transform',
                expanded === 'company' && 'rotate-180',
              )}
            />
          </Button>
        </div>

        {/* Form entreprise expand */}
        {expanded === 'company' && (
          <div className="pt-3 border-t border-[#0F1419]/[0.08]">
            <CompanyForm initial={props.organization} />
          </div>
        )}
      </Card>

      {/* ============== 2. ABONNEMENT ============== */}
      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionHeader icon={CreditCard} iconColor="#007AFF" title="Abonnement" />

        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="font-serif italic text-2xl text-[#0F1419] leading-tight">
              {props.planName ?? 'Aucune formule active'}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {isActive && (
                <Badge variant={isCancelling ? 'orange' : 'green'} className="text-[10px]">
                  {isCancelling ? 'Annulation en cours' : 'Actif'}
                </Badge>
              )}
              {props.planCode && (
                <span className="font-mono text-[11px] text-[#0F1419]/55">
                  {PRICING_PLANS.find((p) => p.code === props.planCode)?.monthlyPrice ?? '—'}€
                  HT/mois
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPI missions ce mois */}
        {props.missionsQuota > 0 ? (
          <div className="rounded-[12px] bg-[#F5F7F4] p-3 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#0F1419]/55">
                Missions ce mois
              </p>
              <p className="font-mono text-[14px] tabular-nums">
                <span className="text-[#0F1419] font-semibold">{props.missionsCount}</span>
                <span className="text-[#0F1419]/55"> / {props.missionsQuota}</span>
              </p>
            </div>
            <div className="h-1.5 rounded-full bg-[#0F1419]/[0.08] overflow-hidden">
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
                {props.overageTotal.toFixed(2)} €
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-[12px] bg-[#F5F7F4] p-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#0F1419]/55">
              Missions ce mois
            </p>
            <p className="font-serif italic text-2xl text-[#0F1419] mt-1">
              {props.missionsCount}
            </p>
            <p className="text-[11px] text-[#0F1419]/55 mt-0.5">Forfait illimité</p>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
            <Link href="/dashboard/facturation">
              <CreditCard className="size-3.5" /> Mes factures
            </Link>
          </Button>
          {isActive && (
            <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
              <Link href="/pricing">
                Changer de formule <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </Card>

      {/* ============== 3. RACCOURCIS (grid 2×3) ============== */}
      <Card variant="opaque" padding="default" className="space-y-3">
        <SectionHeader icon={Layers} iconColor="#0F1419" title="Mes raccourcis" />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <ShortcutTile
            href="/dashboard/compte/branding"
            icon={Palette}
            iconBg="#FF9500"
            label="Logo & couleur"
            sublabel="Identité visuelle"
          />
          <ShortcutTile
            href="/dashboard/compte/tarifs"
            icon={Calculator}
            iconBg="#34C759"
            label="Mes tarifs"
            sublabel="Prestations & packs"
          />
          <ShortcutTile
            href="/dashboard/compte/carte-visite"
            icon={IdCard}
            iconBg="#5AC8FA"
            label="Carte de visite"
            sublabel="QR + Wallet"
          />
        </div>
      </Card>

      {/* ============== 4. PRÉFÉRENCES ADEME + NOTIFICATIONS ============== */}
      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionHeader icon={Radar} iconColor="#FF9500" title="Conformité & notifications" />

        {/* ADEME monitoring */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-[14px] font-medium text-[#0F1419]">Surveillance ADEME</p>
            <p className="text-[12px] text-[#0F1419]/55 mt-0.5">
              {props.certificatRge ? (
                <>
                  Cert. RGE {props.certificatRge} ·{' '}
                  {props.ademeMonitoringEnabled ? 'Active' : 'En pause'}
                </>
              ) : (
                'Cert. RGE à renseigner'
              )}
              {props.lastAdemeSyncAt && (
                <span> · Dernière sync {formatRelative(props.lastAdemeSyncAt)}</span>
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggle('ademe')}
            aria-expanded={expanded === 'ademe'}
          >
            {expanded === 'ademe' ? 'Fermer' : 'Modifier'}
            <ChevronDown
              className={cn(
                'size-4 transition-transform',
                expanded === 'ademe' && 'rotate-180',
              )}
            />
          </Button>
        </div>
        {expanded === 'ademe' && (
          <div className="pt-3 border-t border-[#0F1419]/[0.08]">
            <AdemeForm
              initialCertificatRge={props.certificatRge}
              initialMonitoringEnabled={props.ademeMonitoringEnabled}
              lastSyncAt={props.lastAdemeSyncAt}
            />
          </div>
        )}

        {/* Notifications */}
        <div className="pt-3 border-t border-[#0F1419]/[0.08] flex items-start gap-3">
          <div className="flex-1">
            <p className="text-[14px] font-medium text-[#0F1419]">Notifications email</p>
            <p className="text-[12px] text-[#0F1419]/55 mt-0.5">
              Rapport mensuel d'activité :{' '}
              {props.monthlyReportEnabled ? 'Activé' : 'Désactivé'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggle('notifications')}
            aria-expanded={expanded === 'notifications'}
          >
            {expanded === 'notifications' ? 'Fermer' : 'Modifier'}
            <ChevronDown
              className={cn(
                'size-4 transition-transform',
                expanded === 'notifications' && 'rotate-180',
              )}
            />
          </Button>
        </div>
        {expanded === 'notifications' && (
          <div className="pt-3 border-t border-[#0F1419]/[0.08]">
            <NotificationPrefsForm
              initialMonthlyReportEnabled={props.monthlyReportEnabled}
            />
          </div>
        )}
      </Card>

      {/* ============== 5. CALENDRIER & STOCKAGE ============== */}
      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionHeader icon={Calendar} iconColor="#5AC8FA" title="Calendrier & stockage" />

        <CalendarSyncExport
          httpsUrl={props.calendarHttpsUrl}
          webcalUrl={props.calendarWebcalUrl}
        />

        {props.storageUsage && (
          <div className="pt-3 border-t border-[#0F1419]/[0.08]">
            <StorageQuotaCard
              usedBytes={props.storageUsage.usedBytes}
              quotaBytes={props.storageUsage.quotaBytes}
            />
          </div>
        )}
      </Card>

      {/* ============== 6. MODULES ADD-ONS ============== */}
      <Card variant="opaque" padding="default" className="space-y-3">
        <SectionHeader
          icon={Layers}
          iconColor="#D4F542"
          iconFg="#0F1419"
          title={`Mes modules · ${ADDON_MODULES.length}`}
        />

        <p className="text-[12px] text-[#0F1419]/55">
          Modules activables séparément. Essai gratuit 14 jours, désactivables d'un clic.
        </p>

        <ul className="space-y-2">
          {ADDON_MODULES.map((m) => {
            const included = props.modulesIncludedMap[m.code] === true
            return (
              <li
                key={m.code}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-[12px] border',
                  included
                    ? 'border-[#D4F542]/40 bg-[#D4F542]/[0.08]'
                    : 'border-[#0F1419]/[0.08] bg-white',
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-[#0F1419] truncate">{m.name}</p>
                  <p className="text-[11px] text-[#0F1419]/55 line-clamp-1">{m.description}</p>
                </div>
                <span className="font-mono text-[11px] tabular-nums text-[#0F1419]/55 shrink-0">
                  {m.monthlyPrice}€/mo
                </span>
                {included ? (
                  <Badge variant="green" className="text-[9px]">
                    Inclus
                  </Badge>
                ) : (
                  <StartTrialButton moduleCode={m.code} />
                )}
              </li>
            )
          })}
        </ul>
      </Card>

      {/* ============== 7. LÉGAL & RGPD ============== */}
      <Card variant="opaque" padding="default" className="space-y-3">
        <SectionHeader icon={Shield} iconColor="#48484A" title="Légal & RGPD" />

        <div className="grid grid-cols-2 gap-2">
          <LegalLink href="/mentions-legales" label="Mentions légales" />
          <LegalLink href="/cgu" label="CGU" />
          <LegalLink href="/cgv" label="CGV" />
          <LegalLink href="/confidentialite" label="Politique RGPD" />
        </div>

        <div className="pt-3 border-t border-[#0F1419]/[0.08]">
          <form action="/api/rgpd/request" method="POST">
            <input type="hidden" name="type" value="export" />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
            >
              <Download className="size-3.5" /> Exporter toutes mes données (RGPD)
            </Button>
          </form>
        </div>

        <p className="text-[11px] text-[#0F1419]/55 leading-relaxed">
          Vos factures KOVAS sont émises HT avec TVA 20% en sus, déductible si vous êtes
          assujetti. Conservation 10 ans (obligation comptable L.123-22).
        </p>
      </Card>

      {/* ============== 8. ZONE DANGER ============== */}
      <Card
        variant="opaque"
        padding="default"
        className="border-l-2 border-l-[#DC2626]/30 space-y-3"
      >
        <SectionHeader icon={XCircle} iconColor="#DC2626" title="Zone danger" />

        <p className="text-[12px] text-[#0F1419]/55 leading-relaxed">
          Conformément au décret 2023-417 et au RGPD, vos données sont conservées 90 jours en
          grâce avant suppression irréversible. Vos factures restent conservées 10 ans
          (obligation comptable L.123-22).
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

function ShortcutTile({
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
      className="group flex flex-col items-start gap-2 p-3 rounded-[12px] bg-white border border-[#0F1419]/[0.08] hover:border-[#0F1419]/20 hover:shadow-sm transition-all"
    >
      <span
        aria-hidden
        className="size-9 rounded-md flex items-center justify-center"
        style={{ backgroundColor: iconBg }}
      >
        <Icon className="size-4 text-white" />
      </span>
      <div className="space-y-0.5">
        <p className="text-[13px] font-medium text-[#0F1419] leading-tight">{label}</p>
        <p className="text-[11px] text-[#0F1419]/55 leading-tight">{sublabel}</p>
      </div>
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
