/**
 * /admin/refonte — Tableau de bord introspection live de la refonte
 * acqui-target.
 *
 * Consolide en une page les compteurs des surfaces livrées :
 *   - Algos A1.3.5 (leads scorés)
 *   - Algos A1.3.10/11 (renouvellements + churn priorisés)
 *   - GC4 (état profession)
 *   - GC5 (presse — contacts opt-in + releases)
 *   - Data lake (properties_unified, ademe_dpe, dvf_mutations)
 *   - API publique (à brancher post-Upstash quand on aura les metrics)
 *
 * Aide Benjamin à voir d'un coup d'œil "ce qui tourne en prod" depuis le merge.
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 + PROGRESS.md.
 */

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import {
  Activity,
  BookOpen,
  Building2,
  CalendarCheck,
  Database,
  ExternalLink,
  FileText,
  Megaphone,
  Sparkles,
  UserMinus,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { BackfillButton, SeoAuditButton } from './BackfillButton'

export const metadata: Metadata = {
  title: 'Refonte acqui-target — Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface CountResult {
  count: number | null
  error: string | null
}

async function safeCount(
  supabase: ReturnType<typeof createAdminClient>,
  table: string,
  schema: 'public' | 'data' | 'analytics' = 'public',
  filter?: { column: string; op: 'eq' | 'is_not_null' | 'gte'; value?: unknown },
): Promise<CountResult> {
  try {
    // biome-ignore lint/suspicious/noExplicitAny: schémas dynamiques pas dans Database.types
    let query = (supabase as any).schema(schema).from(table).select('*', {
      count: 'exact',
      head: true,
    })
    if (filter) {
      if (filter.op === 'eq') query = query.eq(filter.column, filter.value)
      else if (filter.op === 'gte') query = query.gte(filter.column, filter.value)
      else if (filter.op === 'is_not_null') query = query.not(filter.column, 'is', null)
    }
    const { count, error } = await query
    return { count: count ?? 0, error: error?.message ?? null }
  } catch (err) {
    return { count: null, error: err instanceof Error ? err.message : 'unknown' }
  }
}

async function fetchMaxTimestamp(
  supabase: ReturnType<typeof createAdminClient>,
  table: string,
  column: string,
  schema: 'public' | 'data' | 'analytics' = 'public',
): Promise<string | null> {
  try {
    // biome-ignore lint/suspicious/noExplicitAny: schémas dynamiques
    const { data } = await (supabase as any)
      .schema(schema)
      .from(table)
      .select(column)
      .order(column, { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    if (!data) return null
    const value = (data as Record<string, unknown>)[column]
    return typeof value === 'string' ? value : null
  } catch {
    return null
  }
}

function formatDateFr(iso: string | null): string {
  if (!iso) return 'jamais'
  return new Date(iso).toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCount(c: CountResult): string {
  if (c.error) return 'erreur'
  if (c.count == null) return '—'
  return c.count.toLocaleString('fr-FR')
}

export default async function AdminRefontePage() {
  const supabase = createAdminClient()

  const [
    // GC3 / A1.3.5
    quoteRequestsTotal,
    quoteRequestsScored,
    quoteRequestsPremium,
    // GC4
    diagnosticiansTotal,
    diagnosticiansVerified,
    // GC5 presse
    pressContactsActive,
    pressReleasesSent,
    pressReleasesDraft,
    // Data lake
    propertiesUnifiedCount,
    ademeDpeCount,
    dvfMutationsCount,
    // Timestamps
    lastDhupSync,
    lastQuoteScored,
    lastPressReleaseSent,
    lastObservatoireReport,
  ] = await Promise.all([
    safeCount(supabase, 'quote_requests'),
    safeCount(supabase, 'quote_requests', 'public', {
      column: 'intent_score',
      op: 'is_not_null',
    }),
    safeCount(supabase, 'quote_requests', 'public', {
      column: 'intent_bucket',
      op: 'eq',
      value: 'premium',
    }),
    safeCount(supabase, 'diagnosticians'),
    safeCount(supabase, 'diagnosticians', 'public', {
      column: 'validation_status',
      op: 'eq',
      value: 'verified',
    }),
    safeCount(supabase, 'press_contacts', 'public', {
      column: 'opt_in',
      op: 'eq',
      value: true,
    }),
    safeCount(supabase, 'press_releases', 'public', {
      column: 'status',
      op: 'eq',
      value: 'sent',
    }),
    safeCount(supabase, 'press_releases', 'public', {
      column: 'status',
      op: 'eq',
      value: 'draft',
    }),
    safeCount(supabase, 'properties_unified', 'data'),
    safeCount(supabase, 'ademe_dpe', 'data'),
    safeCount(supabase, 'dvf_mutations', 'data'),
    fetchMaxTimestamp(supabase, 'diagnosticians', 'dhup_last_synced_at'),
    fetchMaxTimestamp(supabase, 'quote_requests', 'intent_scored_at'),
    fetchMaxTimestamp(supabase, 'press_releases', 'sent_at'),
    fetchMaxTimestamp(supabase, 'observatoire_reports', 'sent_at'),
  ])

  return (
    <div className="space-y-8 animate-fade-in motion-reduce:animate-none">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          Admin · Refonte acqui-target
        </p>
        <h1 className="font-sans font-light text-3xl tracking-tight text-ink">
          État <span className="font-serif italic font-normal">de la refonte</span>
          <span className="text-ink-mute">.</span>
        </h1>
        <p className="text-sm text-ink-mute max-w-2xl">
          Introspection live des surfaces livrées sur la branche{' '}
          <code className="font-mono text-[12px]">refonte-acqui-target-2026-05</code>. Compteurs
          synchronisés avec la prod.
        </p>
      </header>

      {/* ALGORITHMES ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-mono uppercase tracking-[0.06em] text-ink-mute">
          Algorithmes acqui-target (13/13)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard
            icon={<Sparkles className="size-4" />}
            label="Leads scorés (A1.3.5)"
            value={formatCount(quoteRequestsScored)}
            sublabel={`sur ${formatCount(quoteRequestsTotal)} total`}
            footer={`Dernier scoring : ${formatDateFr(lastQuoteScored)}`}
          />
          <KpiCard
            icon={<Sparkles className="size-4" />}
            label="Leads premium"
            value={formatCount(quoteRequestsPremium)}
            sublabel="bucket ≥ 75 (sms_immediate)"
          />
          <KpiCard
            icon={<Activity className="size-4" />}
            label="Diagnostiqueurs"
            value={formatCount(diagnosticiansTotal)}
            sublabel={`${formatCount(diagnosticiansVerified)} vérifiés (A1.3.8)`}
            footer={`Sync DHUP : ${formatDateFr(lastDhupSync)}`}
          />
        </div>
        {/* Backfill action — utile post-déploiement initial */}
        <div className="rounded-lg border border-rule/60 bg-paper px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-[13px] font-medium text-ink">Backfill leads non scorés</p>
            <p className="text-[11px] text-ink-mute leading-relaxed">
              Applique A1.3.5 aux quote_requests créés avant le déploiement initial de l&apos;algo.
              Batch 200 par exécution.
            </p>
          </div>
          <BackfillButton />
        </div>
        {/* Audit SEO batch — A1.3.12 */}
        <div className="rounded-lg border border-rule/60 bg-paper px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-[13px] font-medium text-ink">Audit SEO pages programmatiques</p>
            <p className="text-[11px] text-ink-mute leading-relaxed">
              Recompute quality_score + needs_refresh + refresh_reason sur seo_page_quality_signals
              via A1.3.12. Batch 500 par exécution.
            </p>
          </div>
          <SeoAuditButton />
        </div>
      </section>

      {/* GAME CHANGERS UI ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-mono uppercase tracking-[0.06em] text-ink-mute">
          Game Changers
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SurfaceCard
            icon={<Building2 className="size-4" />}
            title="GC1 — Pre-export panel"
            description="Endpoint /api/missions/[id]/prevalidation-score actif sur toute mission DPE en cours."
            href="/admin/observatoire"
            hrefLabel="Voir admin observatoire"
          />
          <SurfaceCard
            icon={<UserMinus className="size-4" />}
            title="GC4 — État profession publique"
            description="Page /observatoire/etat-profession + endpoint API publique. Données DHUP + Sirene croisées."
            href="/observatoire/etat-profession"
            hrefLabel="Voir la page publique"
            external
          />
          <SurfaceCard
            icon={<Megaphone className="size-4" />}
            title="GC5 — Presse automatisée"
            description={`${formatCount(pressContactsActive)} contacts opt-in · ${formatCount(pressReleasesSent)} communiqués diffusés · ${formatCount(pressReleasesDraft)} brouillons en attente.`}
            href="/admin/press"
            hrefLabel="Cockpit presse"
          />
          <SurfaceCard
            icon={<FileText className="size-4" />}
            title="GC6 — Cockpit fraude DPE"
            description="Détection DPE shopping diagnostiqueur-facing. Endpoint dpe-shopping-check cache 6h."
            href="/dashboard/cockpit-fraude"
            hrefLabel="Cockpit diag-facing"
            external
          />
        </div>
        <p className="text-[11px] text-ink-mute italic">
          GC2 (mission flow continu) et GC3 (annuaire B2C fiche enrichie) à venir.
        </p>
      </section>

      {/* COCKPITS ADMIN ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-mono uppercase tracking-[0.06em] text-ink-mute">
          Cockpits rétention (algos vague 3)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SurfaceCard
            icon={<CalendarCheck className="size-4" />}
            title="Renouvellements (A1.3.10)"
            description="COFRAC + RC Pro expiration ≤ 90 jours, priorisé par urgence."
            href="/admin/renewals"
            hrefLabel="Ouvrir cockpit"
          />
          <SurfaceCard
            icon={<UserMinus className="size-4" />}
            title="Churn (A1.3.11)"
            description="7 signaux pondérés. Bucket critical → winback offer."
            href="/admin/churn"
            hrefLabel="Ouvrir cockpit"
          />
          <SurfaceCard
            icon={<Sparkles className="size-4" />}
            title="Queue leads (A1.3.5)"
            description="Colonne Intent + filtre bucket. Détail breakdown signal par signal."
            href="/admin/leads/queue"
            hrefLabel="Ouvrir queue"
          />
        </div>
      </section>

      {/* DATA LAKE ─────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-mono uppercase tracking-[0.06em] text-ink-mute">Data lake</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard
            icon={<Database className="size-4" />}
            label="Propriétés cachées"
            value={formatCount(propertiesUnifiedCount)}
            sublabel="data.properties_unified (TTL 7j)"
          />
          <KpiCard
            icon={<Database className="size-4" />}
            label="DPE ADEME ingérés"
            value={formatCount(ademeDpeCount)}
            sublabel="data.ademe_dpe (cron quotidien)"
          />
          <KpiCard
            icon={<Database className="size-4" />}
            label="Mutations DVF"
            value={formatCount(dvfMutationsCount)}
            sublabel="data.dvf_mutations (trimestriel)"
          />
        </div>
      </section>

      {/* API PUBLIQUE ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-mono uppercase tracking-[0.06em] text-ink-mute">
          API publique V1
        </h2>
        <Card variant="opaque" padding="default" className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5 max-w-2xl">
              <p className="text-sm text-ink">
                3 endpoints LIVE, rate-limit 60/600 req/min, OpenAPI 3.1.
              </p>
              <p className="text-[12px] text-ink-mute leading-relaxed">
                <code className="font-mono text-[11px]">/property/{'{banId}'}</code> ·{' '}
                <code className="font-mono text-[11px]">/observatoire/profession</code> ·{' '}
                <code className="font-mono text-[11px]">/commune/{'{inseeCode}'}</code>
              </p>
            </div>
            <Badge variant="green">LIVE</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/public/v1/openapi.json"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md border border-rule px-3 py-1.5 text-[12px] hover:bg-paper transition-colors"
            >
              <BookOpen className="size-3.5" />
              OpenAPI 3.1
              <ExternalLink className="size-3 opacity-50" />
            </a>
            <Link
              href="/pros/api"
              className="inline-flex items-center gap-1.5 rounded-md border border-rule px-3 py-1.5 text-[12px] hover:bg-paper transition-colors"
            >
              Page publique /pros/api
            </Link>
          </div>
        </Card>
      </section>

      {/* ACTUS ─────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-mono uppercase tracking-[0.06em] text-ink-mute">
          Cycles automatiques
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SmallStat
            label="Dernier rapport Observatoire envoyé"
            value={formatDateFr(lastObservatoireReport)}
            href="/admin/observatoire"
          />
          <SmallStat
            label="Dernier communiqué presse diffusé"
            value={formatDateFr(lastPressReleaseSent)}
            href="/admin/press"
          />
        </div>
      </section>

      {/* DOC ─────────────────────────────────────────────────────────── */}
      <Card variant="opaque" padding="default" className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
          Documentation
        </p>
        <p className="text-sm text-ink">
          Suivi exhaustif :{' '}
          <code className="font-mono text-[12px]">docs/refonte-2026-05/PROGRESS.md</code>
        </p>
        <p className="text-[12px] text-ink-mute leading-relaxed">
          Spec source de vérité :{' '}
          <code className="font-mono text-[11px]">
            docs/refonte-2026-05/REFONTE-ACQUI-TARGET-V2.md
          </code>
        </p>
      </Card>
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  sublabel,
  footer,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sublabel?: string
  footer?: string
}) {
  return (
    <Card variant="opaque" padding="default" className="space-y-2">
      <div className="flex items-center gap-2 text-ink-mute">
        {icon}
        <p className="font-mono text-[10px] uppercase tracking-[0.06em]">{label}</p>
      </div>
      <p className="font-serif italic font-normal text-ink leading-none text-3xl">{value}</p>
      {sublabel ? <p className="text-[12px] text-ink-mute">{sublabel}</p> : null}
      {footer ? (
        <p className="text-[10px] font-mono text-ink-mute uppercase tracking-wide">{footer}</p>
      ) : null}
    </Card>
  )
}

function SurfaceCard({
  icon,
  title,
  description,
  href,
  hrefLabel,
  external,
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  hrefLabel: string
  external?: boolean
}) {
  return (
    <Card variant="opaque" padding="default" className="space-y-2">
      <div className="flex items-center gap-2 text-ink-mute">
        {icon}
        <p className="text-sm font-semibold text-ink">{title}</p>
      </div>
      <p className="text-[12px] text-ink-mute leading-relaxed">{description}</p>
      {external ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-[12px] text-ink hover:underline"
        >
          {hrefLabel} <ExternalLink className="size-3 opacity-50" />
        </a>
      ) : (
        <Link href={href} className="text-[12px] text-ink hover:underline">
          {hrefLabel} →
        </Link>
      )}
    </Card>
  )
}

function SmallStat({
  label,
  value,
  href,
}: {
  label: string
  value: string
  href: string
}) {
  return (
    <Link href={href} className="block">
      <Card
        variant="opaque"
        padding="default"
        className="space-y-1 hover:bg-paper transition-colors"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">{label}</p>
        <p className="text-base font-medium text-ink">{value}</p>
      </Card>
    </Link>
  )
}
