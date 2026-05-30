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
  FileText,
  KeyRound,
  Layers,
  type LucideIcon,
  Plug,
  Radar,
  Receipt,
  Shield,
  User as UserIcon,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'

import { AdemeForm } from './ademe-form'
import { BaselineMinutesForm } from './baseline-minutes-form'
import { CompanyForm } from './company-form'
import { DeleteAccountButton } from './delete-account-button'
import { NotificationPrefsForm } from './notification-prefs-form'
import { ProfileForm } from './profile-form'
import { StartTrialButton } from './start-trial-button'

type TabKey = 'profil' | 'securite' | 'abonnement' | 'cabinet' | 'facturation'

/**
 * Tab "facturation" = Abonnement KOVAS (factures que KOVAS émet AU diagnostiqueur
 * pour son abonnement SaaS). À ne PAS confondre avec /dashboard/facturation qui
 * regroupe les factures que LE diagnostiqueur émet à ses propres clients (revenus).
 * Le libellé visible utilise "Factures KOVAS" pour lever toute ambiguïté.
 */
const TABS: ReadonlyArray<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: 'profil', label: 'Profil', icon: UserIcon },
  { key: 'securite', label: 'Sécurité', icon: Shield },
  { key: 'abonnement', label: 'Abonnement', icon: CreditCard },
  { key: 'cabinet', label: 'Cabinet', icon: Building2 },
  { key: 'facturation', label: 'Factures KOVAS', icon: Receipt },
]

/**
 * Modules add-ons RÉELLEMENT proposés à l'abonné (grille officielle V4).
 *
 * Les modules V3 historiques (signatures eIDAS, Pennylane, SMS, Communauté Pro)
 * restent dans `ADDON_MODULES` pour la rétro-compat de facturation des abonnés
 * déjà engagés, mais ne sont PLUS proposés ici : en V5 eIDAS et SMS sont devenus
 * des options ponctuelles à l'usage (2 €/sig, 0,15 €/SMS), et eIDAS est déjà
 * inclus dans le « Pack Conformité Avancée ». Les afficher créait des doublons
 * et une grille périmée (fix 2026-05-30).
 */
const OFFERABLE_ADDON_CODES: ReadonlySet<string> = new Set([
  'addon_extra_user',
  'addon_ia_volume',
  'addon_conformite_avancee',
  'addon_international',
])

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
    baseline_minutes_per_mission: number | null
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
    <div className="space-y-6 w-full">
      {/* ════════════════════════════════════════════════════════════
          PAGE TABS — style canonique (idem clients/[id])
          ══════════════════════════════════════════════════════════ */}
      <nav
        aria-label="Sections compte"
        role="tablist"
        className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-pill border border-[#0F1419]/[0.08] bg-paper p-1"
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
                  ? 'bg-[#0F1419] text-[#D4F542] font-semibold'
                  : 'text-[#0F1419]/72 hover:text-[#0F1419] font-medium',
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
        {/*
          Panneaux pleine largeur du conteneur racine (max-w-4xl unique défini
          dans page.tsx). Plus de re-bridage max-w-3xl/4xl par onglet : header,
          KPI, bannière, barre d'onglets ET contenu partagent désormais
          exactement les mêmes bords gauche/droite (fix « escalier » 2026-05-30).
        */}
        {tab === 'profil' && <ProfilTab props={props} />}
        {tab === 'securite' && <SecuriteTab props={props} />}
        {tab === 'abonnement' && <AbonnementTab props={props} />}
        {tab === 'cabinet' && <CabinetTab props={props} />}
        {tab === 'facturation' && <FacturationTab props={props} />}
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
            <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-[#0F1419]/72">
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
          Tu es connecté avec l'email <strong>{props.profile.email}</strong>. Pour changer ton mot
          de passe, utilise le lien de récupération depuis la page de connexion. Pour modifier
          l'adresse email, contacte le support.
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
          Tu peux à tout moment exporter tes données ou demander leur suppression. Conformément au
          décret 2023-417 et au RGPD, une période de grâce de 90 jours s'applique avant suppression
          irréversible. Tes factures restent conservées 10 ans (obligation comptable L.123-22).
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
          Conformément au décret 2023-417 et au RGPD, tes données sont conservées 90 jours en grâce
          avant suppression irréversible. Tes factures restent conservées 10 ans (obligation
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
  const offerableAddons = ADDON_MODULES.filter((m) => OFFERABLE_ADDON_CODES.has(m.code))

  return (
    <div className="space-y-5">
      {/* Ribbon de distinction "Abonnement KOVAS" (dépenses) */}
      <div
        className="inline-flex items-center gap-2 rounded-pill border border-[#0F1419]/15 bg-[#0F1419]/[0.06] px-3 py-1 text-[11px] font-mono uppercase tracking-[0.12em] text-[#0F1419]"
        aria-label="Cette section concerne ton abonnement KOVAS"
      >
        <span aria-hidden className="size-1.5 rounded-full bg-[#0F1419]" />
        Ton abonnement KOVAS · tes dépenses
      </div>

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
              <p className="font-serif italic text-[36px] sm:text-[44px] leading-none text-[#0F1419]">
                {props.missionsCount}
              </p>
              <p className="text-[11px] text-[#0F1419]/55">Forfait illimité</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-5 pt-5 border-t border-[#0F1419]/[0.08]">
          {/*
            Bouton "Factures KOVAS" → tab #facturation de la page Compte
            (= factures que KOVAS m'émet pour mon abonnement). À ne PAS confondre
            avec /dashboard/facturation (factures que J'émets à MES clients).
          */}
          <Button asChild variant="outline" size="default" className="flex-1">
            <Link href="/dashboard/account?tab=facturation">
              <Receipt className="size-4" /> Mes factures KOVAS
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
            title={`Modules add-ons · ${offerableAddons.length}`}
            iconColor="#D4F542"
            iconFg="#0F1419"
          />
        </div>
        <p className="text-[12px] text-[#0F1419]/55">
          Modules activables séparément. Essai gratuit 14 jours, désactivable d'un clic.
        </p>

        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {offerableAddons.map((m) => {
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
                      Inclus dans ton forfait
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

      {/* Préférence gain de temps personnalisé (CLAUDE.md §2 + KOVAS_TABLEAU_DE_BORD préambule) */}
      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionTitle
          icon={Calculator}
          title="Gain de temps · personnalisation"
          iconColor="#34C759"
        />
        <BaselineMinutesForm initialMinutes={props.organization.baseline_minutes_per_mission} />
      </Card>

      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionTitle icon={Radar} title="Surveillance ADEME" iconColor="#FF9500" />
        <AdemeForm
          initialCertificatRge={props.certificatRge}
          initialMonitoringEnabled={props.ademeMonitoringEnabled}
          lastSyncAt={props.lastAdemeSyncAt}
        />
      </Card>

      {/*
        Section Préférences cabinet — 4 raccourcis vers les pages de configuration :
        tarifs prestations, intégrations comptables PDP, attestations légales, alertes.
        (Logo & couleur + Carte de visite retirés refonte 2026-05 : gimmicks non-moat.)
      */}
      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionTitle icon={Plug} title="Préférences cabinet" iconColor="#0F1419" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ShortcutCard
            href="/dashboard/compte/tarifs"
            icon={Calculator}
            iconBg="#34C759"
            label="Mes tarifs"
            sublabel="Prestations & packs"
          />
          <ShortcutCard
            href="/dashboard/account/integrations"
            icon={Plug}
            iconBg="#0F1419"
            label="Intégrations"
            sublabel="Qonto · Pennylane"
          />
          <ShortcutCard
            href="/dashboard/account/legal"
            icon={FileText}
            iconBg="#AF52DE"
            label="Attestations légales"
            sublabel="LAFT · RGPD · DGFiP"
          />
          <ShortcutCard
            href="/dashboard/account/preferences/alertes"
            icon={Bell}
            iconBg="#FF9500"
            label="Préférences d'alertes"
            sublabel="Notifications & rappels"
          />
        </div>
      </Card>
    </div>
  )
}

/* ============== TAB 5 — FACTURES KOVAS (abonnement SaaS) ============== */

/**
 * Tab "Factures KOVAS" = les factures que KOVAS émet AU diagnostiqueur pour son
 * abonnement SaaS (prélèvement mensuel + dépassements éventuels). Source =
 * Stripe via /api/billing/invoices. À ne PAS confondre avec /dashboard/facturation
 * qui liste les factures que LE diagnostiqueur émet à SES propres clients.
 */
function FacturationTab({ props }: { props: AccountSettingsClientProps }) {
  return (
    <div className="space-y-5">
      {/* Ribbon de distinction visuelle — navy pour identifier "dépenses KOVAS" */}
      <div
        className="inline-flex items-center gap-2 rounded-pill border border-[#0F1419]/15 bg-[#0F1419]/[0.06] px-3 py-1 text-[11px] font-mono uppercase tracking-[0.12em] text-[#0F1419]"
        aria-label="Cette section concerne ton abonnement KOVAS, pas les factures émises à tes clients"
      >
        <span aria-hidden className="size-1.5 rounded-full bg-[#0F1419]" />
        Ton abonnement KOVAS · factures payées par toi à KOVAS
      </div>

      <Card variant="opaque" padding="default" className="space-y-4">
        <SectionTitle icon={Receipt} title="Historique des factures KOVAS" iconColor="#0F1419" />
        <p className="text-[13px] text-[#0F1419]/65 leading-relaxed">
          Factures émises par <strong>SASU Nexus 1993</strong> (éditeur KOVAS) pour ton abonnement
          SaaS et les éventuels dépassements de quota. TVA 20% en sus, déductible si tu es
          assujetti. Conservation 10 ans (obligation comptable L.123-22).
        </p>
        <KovasInvoicesEmbedded />
        <p className="text-[11px] text-[#0F1419]/50 leading-snug">
          Pour tes propres factures clients (revenus), va sur la page{' '}
          <Link
            href="/dashboard/facturation"
            className="underline underline-offset-2 hover:text-[#0F1419]"
          >
            Facturation
          </Link>
          .
        </p>
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#0F1419]/[0.08]">
          <Button asChild variant="default" size="default">
            <Link href="/api/billing/portal" prefetch={false}>
              <CreditCard className="size-4" /> Gérer mon abonnement (Stripe)
            </Link>
          </Button>
          <Button asChild variant="outline" size="default">
            <Link href="/pricing">
              <ArrowRight className="size-4" /> Changer de plan
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

/* ============== KovasInvoicesEmbedded ============== */

interface StripeInvoiceSummary {
  id: string
  number: string | null
  status: string | null
  amount_paid: number
  amount_due: number
  currency: string
  created: number
  period_start: number
  period_end: number
  invoice_pdf: string | null
  hosted_invoice_url: string | null
}

/**
 * Liste embedded des factures Stripe KOVAS pour l'utilisateur courant.
 * Charge depuis /api/billing/invoices (route déjà sécurisée par session).
 * Responsive : sur mobile, montre uniquement Date + Montant + bouton PDF ;
 * sur desktop, ajoute Numéro / Période / Statut.
 */
function KovasInvoicesEmbedded() {
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'empty' }
    | { kind: 'ready'; items: StripeInvoiceSummary[] }
    | { kind: 'error'; message: string }
  >({ kind: 'loading' })

  useEffect(() => {
    let alive = true
    fetch('/api/billing/invoices', { cache: 'no-store' })
      .then(async (res) => {
        if (!alive) return
        if (res.status === 503) {
          setState({ kind: 'empty' })
          return
        }
        if (!res.ok) {
          setState({ kind: 'error', message: `HTTP ${res.status}` })
          return
        }
        const body = (await res.json()) as { invoices?: StripeInvoiceSummary[] }
        const items = body.invoices ?? []
        if (items.length === 0) {
          setState({ kind: 'empty' })
          return
        }
        setState({ kind: 'ready', items })
      })
      .catch((err: unknown) => {
        if (!alive) return
        const message = err instanceof Error ? err.message : 'Erreur inconnue'
        setState({ kind: 'error', message })
      })
    return () => {
      alive = false
    }
  }, [])

  if (state.kind === 'loading') {
    return (
      <div className="rounded-[12px] border border-[#0F1419]/[0.08] bg-[#F5F7F4] px-4 py-6 text-center text-[12px] text-[#0F1419]/55">
        Chargement de ton historique Stripe…
      </div>
    )
  }
  if (state.kind === 'error') {
    return (
      <div className="rounded-[12px] border border-[#DC2626]/30 bg-[#DC2626]/[0.06] px-4 py-3 text-[12px] text-[#DC2626]">
        Impossible de charger l'historique : {state.message}
      </div>
    )
  }
  if (state.kind === 'empty') {
    return (
      <div className="rounded-[12px] border border-[#0F1419]/[0.08] bg-[#F5F7F4] px-4 py-6 text-center text-[12px] text-[#0F1419]/55">
        Aucune facture KOVAS pour l'instant. Tes factures apparaîtront ici après le premier
        prélèvement automatique.
      </div>
    )
  }

  return (
    <div className="rounded-[12px] border border-[#0F1419]/[0.08] overflow-hidden bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[320px]">
          <thead className="bg-[#F5F7F4] text-[#0F1419]/72 text-[10px] font-mono uppercase tracking-[0.1em]">
            <tr>
              <th scope="col" className="text-left px-3 py-2.5">
                Date
              </th>
              <th scope="col" className="text-left px-3 py-2.5 hidden md:table-cell">
                Numéro
              </th>
              <th scope="col" className="text-left px-3 py-2.5 hidden lg:table-cell">
                Période
              </th>
              <th scope="col" className="text-left px-3 py-2.5 hidden sm:table-cell">
                Statut
              </th>
              <th scope="col" className="text-right px-3 py-2.5">
                Total TTC
              </th>
              <th scope="col" className="text-right px-3 py-2.5">
                PDF
              </th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((inv) => (
              <KovasInvoiceRow key={inv.id} invoice={inv} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KovasInvoiceRow({ invoice }: { invoice: StripeInvoiceSummary }) {
  const status = invoice.status ?? 'draft'
  const STATUS_LABEL: Record<string, string> = {
    paid: 'Payée',
    open: 'En attente',
    draft: 'Brouillon',
    uncollectible: 'Échec',
    void: 'Annulée',
  }
  const STATUS_VARIANT: Record<string, 'green' | 'orange' | 'red' | 'muted' | 'blue'> = {
    paid: 'green',
    open: 'orange',
    draft: 'muted',
    uncollectible: 'red',
    void: 'muted',
  }
  const amount = status === 'paid' ? invoice.amount_paid : invoice.amount_due
  const dateFmt = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const date = invoice.created ? dateFmt.format(new Date(invoice.created * 1000)) : '—'
  const periodStart = invoice.period_start
    ? dateFmt.format(new Date(invoice.period_start * 1000))
    : '—'
  const periodEnd = invoice.period_end ? dateFmt.format(new Date(invoice.period_end * 1000)) : '—'
  const amountFmt = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: (invoice.currency ?? 'EUR').toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100)

  return (
    <tr className="border-t border-[#0F1419]/[0.06] hover:bg-[#F5F7F4]/50 transition-colors">
      <td className="px-3 py-2.5 whitespace-nowrap text-[#0F1419]">{date}</td>
      <td className="px-3 py-2.5 hidden md:table-cell font-mono text-[12px] text-[#0F1419]/65">
        {invoice.number ?? '—'}
      </td>
      <td className="px-3 py-2.5 hidden lg:table-cell text-[#0F1419]/65 whitespace-nowrap">
        {periodStart} → {periodEnd}
      </td>
      <td className="px-3 py-2.5 hidden sm:table-cell">
        <Badge variant={STATUS_VARIANT[status] ?? 'muted'} className="text-[10px]">
          {STATUS_LABEL[status] ?? status}
        </Badge>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-[#0F1419]">
        {amountFmt}
      </td>
      <td className="px-3 py-2.5 text-right">
        {invoice.invoice_pdf ? (
          <Button asChild size="sm" variant="outline">
            <a
              href={invoice.invoice_pdf}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Télécharger la facture KOVAS ${invoice.number ?? invoice.id} en PDF`}
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </a>
          </Button>
        ) : (
          <span className="text-[#0F1419]/35 text-[11px]">—</span>
        )}
      </td>
    </tr>
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
