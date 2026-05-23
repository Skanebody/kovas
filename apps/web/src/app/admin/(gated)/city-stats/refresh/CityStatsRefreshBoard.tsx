'use client'

/**
 * Tableau de bord admin — refresh des stats villes.
 *
 * KPI fresh/stale/pending/failed + tableau + boutons unitaires.
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckCircle2, Clock, Database, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { useState, useTransition } from 'react'
import { triggerCityStatsBatch, triggerCityStatsUnit } from './actions'
import type { CityStatsRow, CityStatsSummary } from './page'

interface Props {
  readonly rows: ReadonlyArray<CityStatsRow>
  readonly summary: CityStatsSummary
}

type FilterStatus = 'all' | 'fresh' | 'stale' | 'pending' | 'failed' | 'fetching'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function healthBadge(health: CityStatsRow['healthStatus']): React.ReactNode {
  switch (health) {
    case 'fresh':
      return (
        <Badge variant="green" className="text-[10px]">
          Fresh
        </Badge>
      )
    case 'stale':
      return (
        <Badge variant="yellow" className="text-[10px]">
          Stale
        </Badge>
      )
    case 'pending':
      return (
        <Badge variant="muted" className="text-[10px]">
          Pending
        </Badge>
      )
    case 'fetching':
      return (
        <Badge variant="blue" className="text-[10px]">
          Fetching…
        </Badge>
      )
    case 'failed':
      return (
        <Badge variant="red" className="text-[10px]">
          Failed
        </Badge>
      )
    default:
      return (
        <Badge variant="muted" className="text-[10px]">
          —
        </Badge>
      )
  }
}

export function CityStatsRefreshBoard({ rows, summary }: Props) {
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [batchBusy, setBatchBusy] = useState(false)
  const [unitBusy, setUnitBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [, startTransition] = useTransition()

  const filteredRows = filter === 'all' ? rows : rows.filter((r) => r.healthStatus === filter)

  async function handleBatch() {
    setBatchBusy(true)
    setMsg(null)
    const result = await triggerCityStatsBatch(50)
    setBatchBusy(false)
    if (!result.ok) {
      setMsg({ kind: 'err', text: result.error ?? 'Échec inconnu' })
      return
    }
    setMsg({
      kind: 'ok',
      text: `Batch lancé : ${result.details?.succeeded ?? 0}/${result.details?.total_selected ?? 0} villes rafraîchies en ${result.details?.total_ms ?? 0}ms.`,
    })
    startTransition(() => {
      setTimeout(() => window.location.reload(), 1500)
    })
  }

  async function handleUnit(row: CityStatsRow) {
    setUnitBusy(row.citySlug)
    setMsg(null)
    const result = await triggerCityStatsUnit({
      citySlug: row.citySlug,
      cityName: row.cityName,
      deptCode: row.deptCode,
      inseeCode: row.inseeCode,
    })
    setUnitBusy(null)
    if (!result.ok) {
      setMsg({ kind: 'err', text: `${row.citySlug} : ${result.error ?? 'Échec'}` })
      return
    }
    setMsg({
      kind: 'ok',
      text: `${row.cityName} rafraîchie : ${result.details?.total_dpe_count ?? 0} DPE comptabilisés${
        result.details?.ai_generated ? ' + paragraphes IA générés' : ''
      } (${result.details?.duration_ms ?? 0}ms).`,
    })
    startTransition(() => {
      setTimeout(() => window.location.reload(), 1500)
    })
  }

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          City Stats · Refresh queue · ADEME + INSEE + Claude
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Pipeline data réelles des villes.
        </h1>
        <p className="text-sm text-ink-mute max-w-2xl">
          Cron quotidien <code className="font-mono text-xs">kovas-refresh-city-stats-daily</code> à
          02:00 UTC — 200 villes/jour en rotation continue. Les pages publiques{' '}
          <code className="font-mono text-xs">/trouver-un-diagnostiqueur/[dept]/[city]</code>{' '}
          consomment ces données en priorité.
        </p>
      </div>

      {/* KPI grid */}
      <section aria-label="Indicateurs santé" className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Total</p>
          <p className="font-serif italic text-3xl text-ink mt-1">
            {summary.total.toLocaleString('fr-FR')}
          </p>
          <p className="text-[11px] text-ink-faint mt-0.5">villes en queue</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent-green">Fresh</p>
          <p className="font-serif italic text-3xl text-ink mt-1">
            {summary.fresh.toLocaleString('fr-FR')}
          </p>
          <p className="text-[11px] text-ink-faint mt-0.5">{'< 60 j'}</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent-yellow">Stale</p>
          <p className="font-serif italic text-3xl text-ink mt-1">
            {summary.stale.toLocaleString('fr-FR')}
          </p>
          <p className="text-[11px] text-ink-faint mt-0.5">60-90 j</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">Pending</p>
          <p className="font-serif italic text-3xl text-ink mt-1">
            {summary.pending.toLocaleString('fr-FR')}
          </p>
          <p className="text-[11px] text-ink-faint mt-0.5">jamais traitées</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent-blue">
            Fetching
          </p>
          <p className="font-serif italic text-3xl text-ink mt-1">
            {summary.fetching.toLocaleString('fr-FR')}
          </p>
          <p className="text-[11px] text-ink-faint mt-0.5">en cours</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent-red">Failed</p>
          <p className="font-serif italic text-3xl text-ink mt-1">
            {summary.failed.toLocaleString('fr-FR')}
          </p>
          <p className="text-[11px] text-ink-faint mt-0.5">à investiguer</p>
        </Card>
      </section>

      {/* Action box */}
      <Card className="p-6 bg-paper">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-sans font-semibold text-lg text-ink">Lancer un batch maintenant</h2>
            <p className="text-sm text-ink-mute max-w-xl">
              Rafraîchit jusqu'à 50 villes éligibles (queue triée par next_refresh_due). Durée
              moyenne : 1-3 min.
            </p>
          </div>
          <Button
            onClick={handleBatch}
            disabled={batchBusy}
            className="bg-navy text-paper hover:bg-navy-deep gap-2"
          >
            {batchBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {batchBusy ? 'Batch en cours…' : 'Lancer batch (50 villes)'}
          </Button>
        </div>

        {msg && (
          <div
            className={`mt-4 flex items-start gap-2 text-sm ${
              msg.kind === 'ok' ? 'text-accent-green' : 'text-accent-red'
            }`}
          >
            {msg.kind === 'ok' ? (
              <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="size-4 mt-0.5 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono text-ink-faint uppercase tracking-wider mr-2">
          Filtre :
        </span>
        {(['all', 'fresh', 'stale', 'pending', 'fetching', 'failed'] as FilterStatus[]).map((f) => (
          <button
            type="button"
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-pill border transition-colors ${
              filter === f
                ? 'border-ink bg-ink text-paper'
                : 'border-rule text-ink-mute hover:border-ink hover:text-ink'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <section className="space-y-3">
        <h2 className="font-sans font-semibold text-lg text-ink flex items-center gap-2">
          <Database className="size-4 text-ink-mute" />
          Queue ({filteredRows.length})
        </h2>

        {filteredRows.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-ink-mute text-sm">
              Aucune ville pour le filtre <code className="font-mono">{filter}</code>.
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper border-b border-rule/40">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                      Ville
                    </th>
                    <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                      Dept
                    </th>
                    <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                      Santé
                    </th>
                    <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint text-right">
                      DPE
                    </th>
                    <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint text-right">
                      Sources
                    </th>
                    <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                      Last refresh
                    </th>
                    <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                      Next due
                    </th>
                    <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.slice(0, 200).map((row) => (
                    <tr
                      key={row.citySlug}
                      className="border-b border-rule/20 last:border-b-0 hover:bg-paper/50"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{row.cityName}</p>
                        <p className="font-mono text-[10px] text-ink-faint">{row.citySlug}</p>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-ink-mute">{row.deptCode}</td>
                      <td className="px-3 py-3">{healthBadge(row.healthStatus)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink">
                        {row.totalDpeCount.toLocaleString('fr-FR')}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-ink-mute">
                        {row.sourcesCount}
                      </td>
                      <td className="px-3 py-3 text-xs text-ink-faint">
                        {formatDate(row.lastRefreshedAt)}
                      </td>
                      <td className="px-3 py-3 text-xs text-ink-faint">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" aria-hidden />
                          {formatDate(row.nextRefreshDue)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={unitBusy === row.citySlug}
                          onClick={() => handleUnit(row)}
                          className="gap-1.5"
                        >
                          {unitBusy === row.citySlug ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <RefreshCw className="size-3" />
                          )}
                          {unitBusy === row.citySlug ? 'En cours' : 'Refresh'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredRows.length > 200 ? (
              <div className="px-4 py-3 text-xs text-ink-faint border-t border-rule/40">
                Affichage limité à 200 lignes. Total filtré : {filteredRows.length}.
              </div>
            ) : null}
          </Card>
        )}
      </section>

      <p className="text-xs text-ink-faint">
        Cron pg_cron : <code className="font-mono">kovas-refresh-city-stats-daily</code> — schedule{' '}
        <code className="font-mono">0 2 * * *</code> (02:00 UTC) → 200 villes/jour.
      </p>
    </div>
  )
}
