/**
 * Tableau des latences p50/p95/p99 par opération.
 * Inclut ai_usage (préfixe `ai:`) + perf_metrics (opérations non-IA).
 */

import { Card } from '@/components/ui/card'
import type { OperationPerf } from '@/lib/admin/observability'

interface Props {
  rows: OperationPerf[]
}

function formatMs(ms: number): string {
  if (ms === 0) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

const OPERATION_LABEL: Record<string, string> = {
  'ai:transcribe': 'Transcription Whisper',
  'ai:classify': 'Classification Haiku',
  'ai:extract': 'Extraction Sonnet',
  'ai:structure': 'Structuration vocale',
  'ai:vision': 'Vision IA',
  export_zip_liciel: 'Export ZIP Liciel',
  pdf_generation: 'Génération PDF',
  mission_consolidate: 'Consolidation mission',
  liciel_import: 'Import Liciel',
}

function labelFor(op: string): string {
  return OPERATION_LABEL[op] ?? op
}

export function OperationLatencyTable({ rows }: Props) {
  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Latence par opération</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          7 derniers jours
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">Aucune mesure sur 7 jours.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] tabular-nums">
            <thead>
              <tr className="border-b border-rule/60 text-left text-ink-mute font-mono uppercase tracking-[0.14em] text-[10px]">
                <th className="py-2 pr-3">Opération</th>
                <th className="py-2 pr-3 text-right">p50</th>
                <th className="py-2 pr-3 text-right">p95</th>
                <th className="py-2 pr-3 text-right">p99</th>
                <th className="py-2 pr-3 text-right">Calls</th>
                <th className="py-2 text-right">Erreurs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.operation} className="border-b border-rule/30 last:border-0">
                  <td className="py-2 pr-3 text-ink">
                    {labelFor(r.operation)}
                    {r.operation.startsWith('ai:') ? (
                      <span className="ml-2 font-mono text-[9px] uppercase tracking-wider text-ink-faint">
                        IA
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-right text-ink-mute">{formatMs(r.p50ms)}</td>
                  <td className="py-2 pr-3 text-right text-ink">{formatMs(r.p95ms)}</td>
                  <td className="py-2 pr-3 text-right text-ink-mute">{formatMs(r.p99ms)}</td>
                  <td className="py-2 pr-3 text-right text-ink-mute">{formatInt(r.callsCount)}</td>
                  <td className="py-2 text-right">
                    {r.errorRate === 0 ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      <span
                        className={
                          r.errorRate >= 0.05
                            ? 'text-danger font-medium'
                            : r.errorRate >= 0.01
                              ? 'text-amber font-medium'
                              : 'text-ink-mute'
                        }
                      >
                        {formatPct(r.errorRate)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
