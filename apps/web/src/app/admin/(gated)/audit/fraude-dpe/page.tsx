import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { getPatternAccuracy, listPendingSignals } from '@/lib/fraud-detection/alert-manager'
import type { FraudPattern, ReviewedFraudSignalRow } from '@/lib/fraud-detection/types'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { markSignalReviewed } from './actions'

export const metadata: Metadata = { title: 'Audit fraude DPE · Admin' }

const PATTERN_LABEL: Record<FraudPattern, string> = {
  class_anomaly: 'Anomalie de classe',
  processing_velocity: 'Vitesse de traitement',
  geolocation_inconsistency: 'Incohérence géolocalisation',
  signature_similarity: 'Similarité de signature',
}

function severityVariant(severity: number): 'red' | 'orange' | 'yellow' {
  if (severity >= 0.85) return 'red'
  if (severity >= 0.7) return 'orange'
  return 'yellow'
}

function formatPercent(value: number, fractionDigits = 0): string {
  return `${(value * 100).toFixed(fractionDigits)} %`
}

export default async function FraudeDpePage() {
  const supabase = await createClient()
  const [pending, accuracy] = await Promise.all([
    listPendingSignals(supabase, { limit: 100, minSeverity: 0.5 }),
    getPatternAccuracy(supabase),
  ])

  const totalPending = pending.length
  const criticalCount = pending.filter((s) => s.severity >= 0.85).length

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-mute">
          Audit · Détection fraude DPE
        </p>
        <h1 className="text-[32px] font-semibold leading-tight text-ink">
          Signaux en attente de revue
        </h1>
        <p className="max-w-2xl text-[14px] text-ink-mute">
          Les signaux sont produits automatiquement par les quatre patterns de détection. Vous
          statuez sur chaque cas — votre verdict alimente l'apprentissage continu pour ajuster les
          seuils des patterns.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card variant="flat" padding="default">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-mute">À traiter</p>
          <p className="mt-2 font-serif text-[44px] italic leading-none text-ink">{totalPending}</p>
          <p className="mt-1 text-[12px] text-ink-mute">signaux pendants ≥ 50 %</p>
        </Card>
        <Card variant="flat" padding="default">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-mute">Critiques</p>
          <p className="mt-2 font-serif text-[44px] italic leading-none text-ink">
            {criticalCount}
          </p>
          <p className="mt-1 text-[12px] text-ink-mute">sévérité ≥ 85 %</p>
        </Card>
        <Card variant="flat" padding="default">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-mute">
            Patterns suivis
          </p>
          <p className="mt-2 font-serif text-[44px] italic leading-none text-ink">4</p>
          <p className="mt-1 text-[12px] text-ink-mute">Classe · Vitesse · Géoloc · Signature</p>
        </Card>
      </section>

      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="text-[20px] font-semibold text-ink">Précision historique par pattern</h2>
          <p className="text-[12px] text-ink-mute">
            Confirmés / Total révisés (faux positifs en rouge)
          </p>
        </header>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(Object.keys(PATTERN_LABEL) as FraudPattern[]).map((pattern) => {
            const stats = accuracy[pattern]
            return (
              <Card key={pattern} variant="flat" padding="default">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink">{PATTERN_LABEL[pattern]}</p>
                  <p className="font-mono text-[12px] text-ink-mute">
                    {stats ? `${stats.confirmed}/${stats.total}` : '0/0'}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                  <div>
                    <p className="text-ink-mute">Précision</p>
                    <p className="font-semibold text-ink">
                      {stats ? formatPercent(stats.precision) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink-mute">Faux positifs</p>
                    <p className="font-semibold text-[#8B1414]">
                      {stats ? stats.falsePositive : 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink-mute">Non concluants</p>
                    <p className="font-semibold text-ink">{stats ? stats.inconclusive : 0}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="text-[20px] font-semibold text-ink">File de revue</h2>
          <p className="text-[12px] text-ink-mute">Triée par sévérité décroissante</p>
        </header>

        {totalPending === 0 ? (
          <Card variant="flat" padding="lg">
            <p className="text-[14px] text-ink-mute">Aucun signal en attente — la file est vide.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {pending.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SignalCard({ signal }: { signal: ReviewedFraudSignalRow }) {
  const reason =
    typeof signal.details === 'object' &&
    signal.details !== null &&
    'reason' in signal.details &&
    typeof (signal.details as { reason?: unknown }).reason === 'string'
      ? (signal.details as { reason: string }).reason
      : null

  const source = signal.mission_id
    ? `Mission ${signal.mission_id.slice(0, 8)}…`
    : signal.diagnostic_scan_id
      ? `Scan ${signal.diagnostic_scan_id.slice(0, 8)}…`
      : 'Source inconnue'

  return (
    <Card variant="flat" padding="default">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2 md:flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={severityVariant(signal.severity)}>
              {formatPercent(signal.severity, 0)}
            </Badge>
            <Badge variant="muted">{PATTERN_LABEL[signal.pattern]}</Badge>
            <p className="font-mono text-[11px] text-ink-mute">{source}</p>
            <p className="font-mono text-[11px] text-ink-mute">
              {new Date(signal.detected_at).toLocaleString('fr-FR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </p>
          </div>

          {reason !== null ? (
            <p className="text-[14px] leading-relaxed text-ink">{reason}</p>
          ) : null}

          <details className="text-[12px]">
            <summary className="cursor-pointer text-ink-mute hover:text-ink">
              Détails techniques
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-cream-deep p-3 font-mono text-[11px] text-ink-mute">
              {JSON.stringify(signal.details, null, 2)}
            </pre>
          </details>
        </div>

        <div className="md:w-72">
          <form action={markSignalReviewed} className="space-y-2">
            <input type="hidden" name="signalId" value={signal.id} />
            <textarea
              name="notes"
              placeholder="Notes de revue (optionnel)"
              rows={2}
              className="w-full rounded-md border border-border bg-paper px-3 py-2 text-[12px] text-ink placeholder:text-ink-ghost focus:border-navy focus:outline-none"
            />
            <div className="grid grid-cols-1 gap-2">
              <button
                type="submit"
                name="outcome"
                value="confirmed_fraud"
                className="rounded-pill bg-[#8B1414] px-4 py-2 text-[12px] font-medium text-paper hover:opacity-90"
              >
                Fraude confirmée
              </button>
              <button
                type="submit"
                name="outcome"
                value="false_positive"
                className="rounded-pill bg-paper px-4 py-2 text-[12px] font-medium text-ink ring-1 ring-border hover:bg-cream-deep"
              >
                Faux positif
              </button>
              <button
                type="submit"
                name="outcome"
                value="inconclusive"
                className="rounded-pill bg-paper px-4 py-2 text-[12px] font-medium text-ink-mute ring-1 ring-border hover:bg-cream-deep"
              >
                Non concluant
              </button>
            </div>
          </form>
        </div>
      </div>
    </Card>
  )
}
