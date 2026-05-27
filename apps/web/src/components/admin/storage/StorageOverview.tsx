'use client'

/**
 * Vue d'ensemble du stockage par organisation.
 *
 * Server-component-friendly côté data (props), interactivité côté client pour
 * le dialog "Augmenter quota" et les filtres.
 *
 * Le tri est fixe (storage_used_bytes DESC, déjà appliqué dans
 * lib/admin/storage-metrics.ts).
 */

import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type {
  StorageOrgRow,
  StorageOverview as StorageOverviewData,
  StorageUsageFilter,
} from '@/lib/admin/storage-metrics'
import {
  AlertOctagon,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Database,
  HardDrive,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'

interface StorageOverviewProps {
  data: StorageOverviewData
  filterPlan: string
  filterPct: StorageUsageFilter
  page: number
  limit: number
}

const PAGE_LIMIT_DEFAULT = 25
const GB = 1024 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  if (bytes < GB) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  return `${(bytes / GB).toFixed(2)} Go`
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 30) return `il y a ${days}j`
  const months = Math.floor(days / 30)
  if (months < 12) return `il y a ${months}mois`
  return `il y a ${Math.floor(months / 12)}an${Math.floor(months / 12) > 1 ? 's' : ''}`
}

function pctBadgeVariant(pct: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (pct >= 100) return 'red'
  if (pct >= 90) return 'orange'
  if (pct >= 75) return 'yellow'
  return 'green'
}

export function StorageOverview({
  data,
  filterPlan,
  filterPct,
  page,
  limit,
}: StorageOverviewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [dialogOrg, setDialogOrg] = useState<StorageOrgRow | null>(null)
  const [addGo, setAddGo] = useState('20')
  const [error, setError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(data.rows.length / limit))
  const start = (page - 1) * limit
  const paged = data.rows.slice(start, start + limit)

  const updateUrl = useCallback(
    (patches: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(patches)) {
        if (v === null || v === '') next.delete(k)
        else next.set(k, v)
      }
      router.push(`/admin/storage?${next.toString()}`)
    },
    [router, searchParams],
  )

  const closeDialog = () => {
    setDialogOrg(null)
    setError(null)
    setAddGo('20')
  }

  const handleIncreaseQuota = () => {
    if (!dialogOrg) return
    const addBytes = Number(addGo) * GB
    if (!Number.isFinite(addBytes) || addBytes <= 0) {
      setError('Valeur invalide')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/admin/storage/increase-quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: dialogOrg.organization_id,
          additional_bytes: addBytes,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? `HTTP ${res.status}`)
        return
      }
      closeDialog()
      router.refresh()
    })
  }

  return (
    <div className="space-y-7">
      {/* KPIs */}
      <section
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="KPI stockage"
      >
        <AdminMetricCard
          eyebrow="Stockage global"
          value={`${data.kpi.totalUsedGo.toFixed(1)} Go`}
          hint={`sur ${data.kpi.totalQuotaGo.toFixed(0)} Go alloués`}
          icon={Database}
        />
        <AdminMetricCard
          eyebrow="Organisations"
          value={String(data.kpi.totalOrgs)}
          hint="actives (non supprimées)"
          icon={HardDrive}
        />
        <AdminMetricCard
          eyebrow="Saturation > 80%"
          value={String(data.kpi.orgsAbove80)}
          hint="quota proche, à surveiller"
          icon={AlertTriangle}
        />
        <AdminMetricCard
          eyebrow="Dépassements"
          value={String(data.kpi.orgsAbove100)}
          hint="quota dépassé — intervention requise"
          icon={AlertOctagon}
        />
      </section>

      {/* Filtres */}
      <section className="rounded-xl border border-rule bg-paper p-4 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
            Plan
          </span>
          <select
            value={filterPlan}
            onChange={(e) =>
              updateUrl({ plan: e.target.value === 'all' ? null : e.target.value, page: null })
            }
            className="rounded-md border border-rule bg-paper px-3 py-1.5 text-[13px] text-ink"
          >
            <option value="all">Tous</option>
            <option value="decouverte">Découverte</option>
            <option value="standard">Standard</option>
            <option value="volume">Volume</option>
            <option value="founder">Founder</option>
            <option value="cabinet">Cabinet</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
            Utilisation min
          </span>
          <select
            value={filterPct}
            onChange={(e) =>
              updateUrl({
                pct: e.target.value === 'all' ? null : e.target.value,
                page: null,
              })
            }
            className="rounded-md border border-rule bg-paper px-3 py-1.5 text-[13px] text-ink"
          >
            <option value="all">Toutes</option>
            <option value="over_75">≥ 75 %</option>
            <option value="over_90">≥ 90 %</option>
            <option value="over_100">≥ 100 % (dépassement)</option>
          </select>
        </label>
      </section>

      {/* Tableau */}
      <div className="rounded-xl border border-rule bg-paper overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-cream-deep/40 border-b border-rule">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium"
                >
                  Organisation
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium"
                >
                  Plan
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium text-right"
                >
                  Utilisé
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium text-right"
                >
                  Quota
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium text-right"
                >
                  %
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium"
                >
                  Dernière mission
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium text-right"
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-ink-mute text-sm">
                    Aucune organisation ne correspond aux filtres.
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <tr
                    key={row.organization_id}
                    className="border-b border-rule/40 last:border-0 hover:bg-cream-deep/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-[13px] text-ink font-medium">
                      {row.organization_name}
                    </td>
                    <td className="px-4 py-3 text-[12px]">
                      <Badge variant="muted">{row.plan}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-ink tabular-nums text-right">
                      {formatBytes(row.storage_used_bytes)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-ink-mute tabular-nums text-right">
                      {formatBytes(row.storage_quota_bytes)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={pctBadgeVariant(row.utilization_pct)}>
                        <span className="tabular-nums">{row.utilization_pct.toFixed(1)} %</span>
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-ink-mute">
                      {formatRelativeDate(row.last_mission_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDialogOrg(row)}
                        aria-label={`Augmenter le quota de ${row.organization_name}`}
                      >
                        + Quota
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-rule bg-cream-deep/20">
            <p className="text-[11px] text-ink-mute font-mono">
              Page {page} / {totalPages} · {data.rows.length} organisations
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-rule px-2.5 py-1.5 text-[12px] text-ink hover:bg-paper disabled:opacity-40 disabled:pointer-events-none"
                disabled={page <= 1}
                onClick={() => updateUrl({ page: String(page - 1) })}
                aria-label="Page précédente"
              >
                <ChevronLeft className="size-3.5" aria-hidden />
                Précédent
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-rule px-2.5 py-1.5 text-[12px] text-ink hover:bg-paper disabled:opacity-40 disabled:pointer-events-none"
                disabled={page >= totalPages}
                onClick={() => updateUrl({ page: String(page + 1) })}
                aria-label="Page suivante"
              >
                Suivant
                <ChevronRight className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Dialog : Augmenter quota */}
      <Dialog open={dialogOrg !== null} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Augmenter le quota de stockage</DialogTitle>
            <DialogDescription>
              {dialogOrg ? (
                <>
                  Organisation <strong>{dialogOrg.organization_name}</strong> — quota actuel{' '}
                  {formatBytes(dialogOrg.storage_quota_bytes)} (
                  {dialogOrg.utilization_pct.toFixed(1)} % utilisé).
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block">
              <span className="text-[11px] font-mono uppercase tracking-wider text-ink-mute">
                Ajouter (Go)
              </span>
              <Input
                type="number"
                min="1"
                max="500"
                step="1"
                value={addGo}
                onChange={(e) => setAddGo(e.target.value)}
                className="mt-1"
              />
            </label>
            {error ? (
              <p className="text-[12px] text-danger" role="alert">
                {error}
              </p>
            ) : null}
            <p className="text-[11px] text-ink-faint">
              L&apos;action est journalisée dans admin_audit_log (action_type :
              storage_quota_increased).
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={closeDialog} disabled={isPending}>
              Annuler
            </Button>
            <Button variant="default" size="sm" onClick={handleIncreaseQuota} disabled={isPending}>
              {isPending ? 'Application…' : 'Augmenter le quota'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { PAGE_LIMIT_DEFAULT }
