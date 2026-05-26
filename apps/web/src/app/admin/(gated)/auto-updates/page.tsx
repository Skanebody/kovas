/**
 * /admin/auto-updates — Gouvernance des auto-updates système (admin only).
 *
 * Affiche la liste des `system_auto_updates` (déclenchés par la veille IA)
 * avec filtres status/change_type/risk_level + actions admin :
 *   - Approuver / Rejeter (pending_review)
 *   - Appliquer (approved)
 *   - Rollback (applied) — route /rollback existante.
 *
 * Toutes les actions passent par des routes API protégées admin + 2FA, et
 * sont auditées via `admin_audit_log` (Edge Function ou Next.js selon l'action).
 */

import { AutoUpdateActions } from '@/components/admin/auto-updates/AutoUpdateActions'
import { AutoUpdatePayloadDiff } from '@/components/admin/auto-updates/AutoUpdatePayloadDiff'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import {
  type AutoUpdateChangeType,
  type AutoUpdateRiskLevel,
  type AutoUpdateStatus,
  CHANGE_TYPE_LABEL,
  RISK_BADGE,
  STATUS_BADGE,
  STATUS_LABEL,
  type SystemAutoUpdateRow,
} from '@/lib/regulatory/types'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Auto-updates système',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  searchParams: Promise<{
    status?: string
    change_type?: string
    risk_level?: string
  }>
}

interface RawAutoUpdate extends SystemAutoUpdateRow {
  regulatory_documents: { id: string; title: string } | { id: string; title: string }[] | null
}

interface AutoUpdatesQueryBuilder {
  select: (cols: string) => AutoUpdatesQueryBuilder
  in: (col: string, vals: string[]) => AutoUpdatesQueryBuilder
  order: (col: string, opts: { ascending: boolean }) => AutoUpdatesQueryBuilder
  limit: (n: number) => Promise<{ data: RawAutoUpdate[] | null; error: { message: string } | null }>
}

function parseList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function unwrapDoc(
  value: { id: string; title: string } | { id: string; title: string }[] | null,
): { id: string; title: string } | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

const STATUS_FILTERS: AutoUpdateStatus[] = [
  'pending_review',
  'approved',
  'rejected',
  'applied',
  'rolled_back',
  'failed',
]

const CHANGE_TYPE_FILTERS: AutoUpdateChangeType[] = [
  'config',
  'seed_data',
  'code_patch',
  'content_update',
  'manual_task',
]

export default async function AdminAutoUpdatesPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const statusFilter = parseList(sp.status) as AutoUpdateStatus[]
  const changeTypeFilter = parseList(sp.change_type) as AutoUpdateChangeType[]
  const riskFilter = parseList(sp.risk_level) as AutoUpdateRiskLevel[]

  const supabase = createAdminClient()
  let qb = (supabase.from('system_auto_updates') as unknown as AutoUpdatesQueryBuilder).select(
    'id, triggered_by_doc_id, detected_by, title, summary, rationale, affected_areas, change_type, proposed_payload, rollback_payload, status, reviewed_by, reviewed_at, review_notes, applied_by, applied_at, apply_result, apply_error, risk_level, created_at, updated_at, regulatory_documents:regulatory_documents!triggered_by_doc_id ( id, title )',
  )
  if (statusFilter.length > 0) qb = qb.in('status', statusFilter)
  if (changeTypeFilter.length > 0) qb = qb.in('change_type', changeTypeFilter)
  if (riskFilter.length > 0) qb = qb.in('risk_level', riskFilter)
  qb = qb.order('created_at', { ascending: false })
  const { data } = await qb.limit(80)
  const rows = (data ?? []) as RawAutoUpdate[]

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          🛡️ Gouvernance · Auto-updates
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Auto-updates.
        </h1>
        <p className="text-sm text-ink-mute max-w-xl">
          Propositions de mise à jour générées par la veille IA. Approbation admin obligatoire avant
          exécution.
        </p>
      </div>

      {/* Filtres */}
      <FilterBar
        currentStatus={statusFilter}
        currentChangeType={changeTypeFilter}
        currentRisk={riskFilter}
      />

      {/* Liste */}
      {rows.length === 0 ? (
        <Card variant="flat" padding="default">
          <p className="text-sm text-ink-mute">Aucune auto-update à afficher pour ces filtres.</p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.id}>
              <AutoUpdateCard row={row} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Filter bar (server, render only — la navigation est en GET avec liens)
// ────────────────────────────────────────────────────────────

interface FilterBarProps {
  currentStatus: AutoUpdateStatus[]
  currentChangeType: AutoUpdateChangeType[]
  currentRisk: AutoUpdateRiskLevel[]
}

function buildHref(
  base: 'status' | 'change_type' | 'risk_level',
  value: string,
  current: {
    status: AutoUpdateStatus[]
    change_type: AutoUpdateChangeType[]
    risk_level: AutoUpdateRiskLevel[]
  },
): string {
  const toggled = (list: string[]) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  const next = {
    status: base === 'status' ? toggled(current.status) : current.status,
    change_type: base === 'change_type' ? toggled(current.change_type) : current.change_type,
    risk_level: base === 'risk_level' ? toggled(current.risk_level) : current.risk_level,
  }
  const params = new URLSearchParams()
  if (next.status.length > 0) params.set('status', next.status.join(','))
  if (next.change_type.length > 0) params.set('change_type', next.change_type.join(','))
  if (next.risk_level.length > 0) params.set('risk_level', next.risk_level.join(','))
  const qs = params.toString()
  return `/admin/auto-updates${qs ? `?${qs}` : ''}`
}

function FilterBar({ currentStatus, currentChangeType, currentRisk }: FilterBarProps) {
  const current = {
    status: currentStatus,
    change_type: currentChangeType,
    risk_level: currentRisk,
  }
  return (
    <section aria-label="Filtres" className="rounded-xl border border-rule bg-paper p-4 space-y-3">
      <FilterGroup label="Statut">
        {STATUS_FILTERS.map((s) => {
          const on = currentStatus.includes(s)
          return (
            <Link
              key={s}
              href={buildHref('status', s, current)}
              className={`rounded-pill border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                on
                  ? 'bg-navy text-paper border-navy'
                  : 'bg-paper text-ink border-rule hover:bg-cream-deep'
              }`}
            >
              {STATUS_LABEL[s]}
            </Link>
          )
        })}
      </FilterGroup>
      <FilterGroup label="Type de change">
        {CHANGE_TYPE_FILTERS.map((c) => {
          const on = currentChangeType.includes(c)
          return (
            <Link
              key={c}
              href={buildHref('change_type', c, current)}
              className={`rounded-pill border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                on
                  ? 'bg-navy text-paper border-navy'
                  : 'bg-paper text-ink border-rule hover:bg-cream-deep'
              }`}
            >
              {CHANGE_TYPE_LABEL[c]}
            </Link>
          )
        })}
      </FilterGroup>
      <FilterGroup label="Risque">
        {(['low', 'medium', 'high', 'critical'] as AutoUpdateRiskLevel[]).map((r) => {
          const on = currentRisk.includes(r)
          return (
            <Link
              key={r}
              href={buildHref('risk_level', r, current)}
              className={`rounded-pill border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                on
                  ? 'bg-navy text-paper border-navy'
                  : 'bg-paper text-ink border-rule hover:bg-cream-deep'
              }`}
            >
              {r}
            </Link>
          )
        })}
      </FilterGroup>
    </section>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint min-w-[80px]">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// AutoUpdateCard
// ────────────────────────────────────────────────────────────

function AutoUpdateCard({ row }: { row: RawAutoUpdate }) {
  const source = unwrapDoc(row.regulatory_documents)
  return (
    <Card variant="flat" padding="default" className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge variant={STATUS_BADGE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
            <Badge variant={RISK_BADGE[row.risk_level]}>Risque · {row.risk_level}</Badge>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              {CHANGE_TYPE_LABEL[row.change_type]} · détecté par {row.detected_by}
            </span>
          </div>
          <h3 className="text-[16px] font-semibold text-ink leading-snug">{row.title}</h3>
          <p className="text-[13px] text-ink-mute mt-1 leading-relaxed">{row.summary}</p>
        </div>
        <div className="shrink-0">
          <AutoUpdateActions id={row.id} status={row.status} />
        </div>
      </div>

      {source && (
        <div className="border-t border-rule pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-1">
            Source réglementaire
          </p>
          <Link
            href={`/dashboard/veille/${source.id}`}
            className="text-[13px] text-ink hover:underline"
          >
            {source.title}
          </Link>
        </div>
      )}

      {row.rationale && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint mb-1">
            Justification
          </p>
          <p className="text-[12px] text-ink leading-relaxed">{row.rationale}</p>
        </div>
      )}

      {row.affected_areas.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            Zones impactées
          </span>
          {row.affected_areas.map((a) => (
            <Badge key={a} variant="outline" className="text-[10px]">
              {a}
            </Badge>
          ))}
        </div>
      )}

      <details className="rounded-md bg-cream-deep p-2">
        <summary className="cursor-pointer text-[12px] font-semibold text-ink">
          Voir le diff (avant / après)
        </summary>
        <div className="mt-3">
          <AutoUpdatePayloadDiff proposed={row.proposed_payload} rollback={row.rollback_payload} />
        </div>
      </details>

      {(row.reviewed_at || row.applied_at || row.apply_error) && (
        <dl className="text-[11px] text-ink-mute flex flex-wrap gap-x-5 gap-y-1 border-t border-rule pt-3">
          {row.reviewed_at && (
            <div>
              <dt className="inline font-mono uppercase tracking-[0.12em] text-ink-faint mr-1">
                Revue :
              </dt>
              <dd className="inline">{formatDateTime(row.reviewed_at)}</dd>
            </div>
          )}
          {row.applied_at && (
            <div>
              <dt className="inline font-mono uppercase tracking-[0.12em] text-ink-faint mr-1">
                Appliquée :
              </dt>
              <dd className="inline">{formatDateTime(row.applied_at)}</dd>
            </div>
          )}
          {row.review_notes && (
            <div className="w-full">
              <dt className="inline font-mono uppercase tracking-[0.12em] text-ink-faint mr-1">
                Note :
              </dt>
              <dd className="inline text-ink">{row.review_notes}</dd>
            </div>
          )}
          {row.apply_error && (
            <div className="w-full">
              <dt className="inline font-mono uppercase tracking-[0.12em] text-ink-faint mr-1">
                Erreur :
              </dt>
              <dd className="inline text-[#8B1414]">{row.apply_error}</dd>
            </div>
          )}
        </dl>
      )}
    </Card>
  )
}
