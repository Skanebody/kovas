'use client'

/**
 * Tableau de bord admin pour le refresh manuel des stats observatoire.
 *
 * Bouton "Régénérer maintenant" + table de toutes les périodes/régions
 * actuellement en DB.
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckCircle2, Database, Loader2, RefreshCw, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { triggerStatsRefresh } from './actions'
import type { LiveStatRowAdmin } from './page'

interface Props {
  readonly rows: ReadonlyArray<LiveStatRowAdmin>
  readonly lastGeneratedLabel: string | null
}

function formatEur(n: number | null): string {
  if (n === null) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function formatPct(n: number | null): string {
  if (n === null) return '—'
  return `${n.toFixed(1)} %`
}

export function RefreshAdminBoard({ rows, lastGeneratedLabel }: Props) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [lastRun, setLastRun] = useState<{
    durationMs: number
    rowsUpserted?: number
    usedRealData?: boolean
    revalidated?: boolean
    finishedAt: string
  } | null>(null)
  const [, startTransition] = useTransition()

  async function handleRefresh() {
    setBusy(true)
    setMsg(null)
    const startedAt = Date.now()
    const result = await triggerStatsRefresh()
    const durationMs = Date.now() - startedAt
    setBusy(false)

    if (!result.ok) {
      setMsg({ kind: 'err', text: result.error ?? 'Échec inconnu' })
      return
    }
    setMsg({ kind: 'ok', text: 'Refresh déclenché — actualisation des données…' })
    setLastRun({
      durationMs,
      rowsUpserted: result.details?.rows_upserted,
      usedRealData: result.details?.used_real_data,
      revalidated: result.details?.revalidated,
      finishedAt: new Date().toISOString(),
    })
    startTransition(() => {
      // Petit délai pour laisser la DB se propager
      setTimeout(() => window.location.reload(), 1200)
    })
  }

  const totalRows = rows.length
  const distinctPeriods = new Set(rows.map((r) => `${r.periodYear}-${r.periodMonth}`)).size
  const distinctRegions = new Set(rows.map((r) => r.regionCode ?? 'NULL')).size

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Observatoire · Stats live · Refresh manuel
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Régénération des statistiques publiques.
        </h1>
        <p className="text-sm text-ink-mute max-w-2xl">
          Le 1er du mois à 02:00 UTC, l'Edge Function{' '}
          <code className="font-mono text-xs">observatoire-stats-refresh</code> recalcule les
          agrégats de la table <code className="font-mono text-xs">observatoire_live_stats</code>{' '}
          puis invalide le cache ISR de{' '}
          <Link href="/observatoire" className="underline">
            /observatoire
          </Link>
          . Vous pouvez forcer un refresh ponctuel ici.
        </p>
        <p className="text-xs text-ink-faint">
          Lien admin parent :{' '}
          <Link href="/admin/observatoire" className="underline">
            /admin/observatoire
          </Link>
        </p>
      </div>

      {/* KPI grid */}
      <section
        aria-label="Indicateurs stats live"
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Périodes en DB
          </p>
          <p className="font-serif italic text-3xl text-ink mt-1">{distinctPeriods}</p>
          <p className="text-[11px] text-ink-faint mt-0.5">mois distincts</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Régions couvertes
          </p>
          <p className="font-serif italic text-3xl text-ink mt-1">{distinctRegions}</p>
          <p className="text-[11px] text-ink-faint mt-0.5">dont total France</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Lignes totales
          </p>
          <p className="font-serif italic text-3xl text-ink mt-1">
            {totalRows.toLocaleString('fr-FR')}
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Dernière maj
          </p>
          <p className="font-serif italic text-2xl text-ink mt-1">{lastGeneratedLabel ?? '—'}</p>
        </Card>
      </section>

      {/* Action box */}
      <Card className="p-6 bg-paper">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-sans font-semibold text-lg text-ink">
              Régénérer les stats maintenant
            </h2>
            <p className="text-sm text-ink-mute max-w-xl">
              Recalcule les agrégats du mois précédent et invalide le cache ISR de /observatoire.
              Durée moyenne : 5 à 15 secondes.
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={busy}
            className="bg-navy text-paper hover:bg-navy-deep gap-2"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {busy ? 'Génération…' : 'Régénérer maintenant'}
          </Button>
        </div>

        {msg && (
          <div
            className={`mt-4 flex items-center gap-2 text-sm ${
              msg.kind === 'ok' ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {msg.kind === 'ok' ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <XCircle className="size-4" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {lastRun && (
          <div className="mt-4 border-t border-rule/40 pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Durée</p>
              <p className="font-medium text-ink mt-0.5">
                {(lastRun.durationMs / 1000).toFixed(1)} s
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Lignes upsertées
              </p>
              <p className="font-medium text-ink mt-0.5">{lastRun.rowsUpserted ?? '—'}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Source
              </p>
              <p className="font-medium text-ink mt-0.5">
                {lastRun.usedRealData ? (
                  <Badge variant="green" className="text-[10px]">
                    Data réelle
                  </Badge>
                ) : (
                  <Badge variant="muted" className="text-[10px]">
                    Placeholder
                  </Badge>
                )}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Cache ISR
              </p>
              <p className="font-medium text-ink mt-0.5">
                {lastRun.revalidated ? (
                  <Badge variant="green" className="text-[10px]">
                    Revalidé
                  </Badge>
                ) : (
                  <Badge variant="yellow" className="text-[10px]">
                    Token manquant
                  </Badge>
                )}
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Table des stats actuelles */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-sans font-semibold text-lg text-ink flex items-center gap-2">
            <Database className="size-4 text-ink-mute" />
            Stats live actuelles
          </h2>
          <p className="text-xs text-ink-faint">
            {totalRows} ligne{totalRows > 1 ? 's' : ''} · trié du plus récent au plus ancien
          </p>
        </div>

        {totalRows === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-ink-mute text-sm">
              Aucune donnée dans <code className="font-mono">observatoire_live_stats</code>. Lancez
              un refresh pour amorcer la table.
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-paper border-b border-rule/40">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                      Période
                    </th>
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                      Région
                    </th>
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint text-right">
                      Prix médian
                    </th>
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint text-right">
                      F-G
                    </th>
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint text-right">
                      Diagnostics
                    </th>
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                      Généré le
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-rule/20 last:border-b-0 hover:bg-paper/50"
                    >
                      <td className="px-4 py-3 font-medium text-ink">{r.periodLabel}</td>
                      <td className="px-4 py-3 text-ink">
                        {r.regionCode === null ? (
                          <span className="font-medium">{r.regionLabel}</span>
                        ) : (
                          <span>
                            <code className="font-mono text-[11px] text-ink-faint">
                              FR-{r.regionCode}
                            </code>{' '}
                            {r.regionLabel}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink">
                        {formatEur(r.medianPriceEur)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-mute">
                        {formatPct(r.fgRatePct)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-mute">
                        {r.diagnosticsCount.toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-faint">{r.generatedAtLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      <p className="text-xs text-ink-faint">
        Cron pg_cron : <code className="font-mono">kovas-observatoire-stats-refresh</code> —
        schedule <code className="font-mono">0 2 1 * *</code> (1er du mois 02:00 UTC).
      </p>
    </div>
  )
}
