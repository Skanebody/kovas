'use client'

/**
 * Composant client du dashboard admin Observatoire.
 *
 * Affiche les KPI subscribers + la liste des rapports + permet de
 * relancer manuellement la génération.
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckCircle2, Download, Loader2, RefreshCw, Sparkles, XCircle } from 'lucide-react'
import { useState, useTransition } from 'react'
import { triggerManualGeneration } from './actions'
import type { AdminObservatoireSummary, ObservatoireReport } from './page'

interface Props {
  readonly reports: ReadonlyArray<ObservatoireReport>
  readonly summary: AdminObservatoireSummary
}

function formatEur(n: number, digits = 2): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)
}

function formatBytes(b: number | null): string {
  if (!b) return '—'
  if (b < 1024) return `${b} o`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`
  return `${(b / (1024 * 1024)).toFixed(1)} Mo`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusBadge(status: ObservatoireReport['status']) {
  switch (status) {
    case 'sent':
      return (
        <Badge variant="green" className="text-[10px]">
          Envoyé
        </Badge>
      )
    case 'failed':
      return (
        <Badge variant="red" className="text-[10px]">
          Échec
        </Badge>
      )
    default:
      return (
        <Badge variant="muted" className="text-[10px]">
          Draft
        </Badge>
      )
  }
}

export function ObservatoireAdminBoard({ reports, summary }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [, startTransition] = useTransition()

  async function handleGenerate(force: boolean, target?: ObservatoireReport) {
    setBusy(force ? `force-${target?.id ?? 'latest'}` : 'fresh')
    setMsg(null)
    const result = await triggerManualGeneration({
      force,
      targetYear: target?.periodYear,
      targetMonth: target?.periodMonth,
    })
    setBusy(null)
    if (!result.ok) {
      setMsg({ kind: 'err', text: result.error ?? 'Échec inconnu' })
      return
    }
    setMsg({ kind: 'ok', text: 'Génération déclenchée — actualisation…' })
    startTransition(() => window.location.reload())
  }

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Observatoire · Cron mensuel
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Rapport mensuel auto-généré.
        </h1>
        <p className="text-sm text-ink-mute max-w-2xl">
          Le 1er du mois à 6 h CET, l'Edge Function{' '}
          <code className="font-mono text-xs">observatoire-monthly-report</code> agrège les stats du
          mois écoulé, génère le PDF, l'archive et l'envoie à tous les subscribers actifs.
        </p>
      </div>

      {/* KPI grid */}
      <section
        aria-label="Indicateurs Observatoire"
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Subscribers actifs
          </p>
          <p className="font-serif italic text-3xl text-ink mt-1">
            {summary.activeSubscribers.toLocaleString('fr-FR')}
          </p>
          <p className="text-[11px] text-ink-faint mt-0.5">{summary.unsubscribed} désinscrits</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Taux d'ouverture
          </p>
          <p className="font-serif italic text-3xl text-ink mt-1">
            {summary.avgOpenRatePct.toFixed(1)}%
          </p>
          <p className="text-[11px] text-ink-faint mt-0.5">Dernier rapport envoyé</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Ouvertures cumulées
          </p>
          <p className="font-serif italic text-3xl text-ink mt-1">
            {summary.totalOpens.toLocaleString('fr-FR')}
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Dernier rapport
          </p>
          <p className="font-serif italic text-2xl text-ink mt-1">
            {summary.lastReport?.periodLabel ?? '—'}
          </p>
          <p className="text-[11px] text-ink-faint mt-0.5">
            {summary.lastReport?.sentAt
              ? `Envoyé ${formatDate(summary.lastReport.sentAt)}`
              : 'Aucun envoi'}
          </p>
        </Card>
      </section>

      {/* CTA + feedback */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-ink-mute">
          {reports.length} rapport{reports.length > 1 ? 's' : ''} archivé
          {reports.length > 1 ? 's' : ''}
        </p>
        <Button onClick={() => handleGenerate(false)} disabled={busy === 'fresh'}>
          {busy === 'fresh' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          Générer le rapport du mois écoulé
        </Button>
      </div>

      {msg ? (
        <Card
          className={
            msg.kind === 'ok'
              ? 'p-4 border-green-300 bg-green-50/60'
              : 'p-4 border-red-300 bg-red-50/60'
          }
        >
          <p
            className={
              msg.kind === 'ok'
                ? 'text-sm text-green-700 inline-flex items-center gap-2'
                : 'text-sm text-red-700 inline-flex items-center gap-2'
            }
          >
            {msg.kind === 'ok' ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <XCircle className="size-4" />
            )}
            {msg.text}
          </p>
        </Card>
      ) : null}

      {/* Reports table */}
      {reports.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-ink-mute">Aucun rapport généré pour le moment.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-deep border-b border-rule">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-ink">Période</th>
                <th className="text-left px-4 py-3 font-semibold text-ink">Statut</th>
                <th className="text-right px-4 py-3 font-semibold text-ink">Envoyés</th>
                <th className="text-right px-4 py-3 font-semibold text-ink">Ouverts</th>
                <th className="text-right px-4 py-3 font-semibold text-ink">DL</th>
                <th className="text-right px-4 py-3 font-semibold text-ink">Coût IA</th>
                <th className="text-right px-4 py-3 font-semibold text-ink">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-rule last:border-b-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{r.periodLabel}</p>
                    <p className="text-[11px] font-mono text-ink-faint">
                      {formatBytes(r.pdfSizeBytes)} · {formatDate(r.generatedAt)}
                    </p>
                  </td>
                  <td className="px-4 py-3">{statusBadge(r.status)}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink">
                    {r.emailsSent}
                    {r.emailsFailed > 0 ? (
                      <span className="text-red-600 text-xs ml-1">({r.emailsFailed} ✕)</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-ink">{r.emailsOpened}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink-mute">
                    {r.downloadsDirect}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-ink-mute">
                    {formatEur(r.aiCostEur)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      {r.pdfUrl ? (
                        <a
                          href={r.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-ink-mute hover:text-ink px-2 py-1 rounded hover:bg-cream-deep"
                        >
                          <Download className="size-3.5" />
                          PDF
                        </a>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleGenerate(true, r)}
                        disabled={busy === `force-${r.id}`}
                      >
                        {busy === `force-${r.id}` ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
