'use client'

import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { useState } from 'react'

interface EdgeResponseSummary {
  ok: boolean
  processed?: number
  dhupActive?: number
  dhupInactive?: number
  sireneActive?: number
  sireneCeased?: number
  sireneSkipped?: number
  gmbEnriched?: number
  gmbSkipped?: number
  flaggedFraud?: number
  belowThreshold?: number
  durationMs?: number
  batchOffset?: number
  batchLimit?: number
  notes?: string[]
  error?: string
}

interface RunResponse {
  ok: boolean
  edge?: EdgeResponseSummary
  triggeredBy: string
  triggeredAt: string
  error?: string
}

/**
 * Panel client de déclenchement manuel de l'Edge Function
 * `verify-diagnosticians-daily` via `/api/admin/diagnosticians/run-verify-daily`.
 *
 * Affiche en temps réel le résultat (durée, stats par source, fraud_flags).
 */
export function VerifyAuditPanel() {
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<RunResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState<number>(500)

  async function handleRun() {
    setPending(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/diagnosticians/run-verify-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit }),
      })
      const payload = (await res.json()) as RunResponse
      setResult(payload)
      if (!res.ok || !payload.ok) {
        setError(payload.error ?? 'Échec vérification — voir détails ci-dessous.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau inconnue.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-rule/60 bg-paper p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-ink">Déclencheur manuel</h2>
        <p className="text-[12px] text-ink-mute">
          Force un passage immédiat (en plus du cron 03:00 UTC). Batch limité à <code>500</code> par
          défaut pour rester sous les timeouts Edge Function (5min).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[12px] text-ink-mute">
          Batch :{' '}
          <input
            type="number"
            min={50}
            max={2000}
            step={50}
            value={limit}
            onChange={(e) => setLimit(Math.max(50, Math.min(2000, Number(e.target.value) || 500)))}
            className="w-24 rounded-md border border-rule/60 bg-bg px-2 py-1 font-mono text-[13px]"
            disabled={pending}
          />
        </label>
        <Button onClick={handleRun} disabled={pending} variant="default" size="default">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Vérification…
            </>
          ) : (
            <>
              <RefreshCw className="size-4" />
              Lancer vérif manuelle
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-[13px] text-red-900">
          <AlertCircle className="size-4 shrink-0" />
          <div>
            <p className="font-medium">Erreur</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {result?.edge && (
        <div className="space-y-3 rounded-lg border border-rule/60 bg-bg/50 p-3 text-[12px]">
          <div className="flex items-center gap-2 text-ink">
            {result.ok ? (
              <CheckCircle2 className="size-4 text-green-700" />
            ) : (
              <AlertCircle className="size-4 text-amber-700" />
            )}
            <span className="font-medium">
              {result.ok ? 'Vérification terminée' : 'Vérification terminée avec erreurs'}
            </span>
            {typeof result.edge.durationMs === 'number' && (
              <span className="font-mono text-ink-faint">
                ({(result.edge.durationMs / 1000).toFixed(1)}s)
              </span>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            <Stat label="Traités" value={result.edge.processed ?? 0} />
            <Stat label="DHUP actif" value={result.edge.dhupActive ?? 0} />
            <Stat label="DHUP inactif" value={result.edge.dhupInactive ?? 0} />
            <Stat label="SIRET actif" value={result.edge.sireneActive ?? 0} />
            <Stat label="SIRET radié" value={result.edge.sireneCeased ?? 0} />
            <Stat label="SIRET skip" value={result.edge.sireneSkipped ?? 0} />
            <Stat label="GMB enrichi" value={result.edge.gmbEnriched ?? 0} />
            <Stat label="GMB skip" value={result.edge.gmbSkipped ?? 0} />
            <Stat label="Fraud flag" value={result.edge.flaggedFraud ?? 0} tone="warn" />
            <Stat label="Sous seuil" value={result.edge.belowThreshold ?? 0} tone="warn" />
          </dl>

          {result.edge.notes && result.edge.notes.length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
              <p className="font-medium">Notes :</p>
              <ul className="ml-4 list-disc">
                {result.edge.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="font-mono text-[11px] text-ink-faint">
            Déclenché par {result.triggeredBy} · {formatDate(result.triggeredAt)}
          </p>
        </div>
      )}
    </section>
  )
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: 'neutral' | 'warn'
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-ink-faint">{label}</dt>
      <dd className={`font-mono tabular-nums ${tone === 'warn' ? 'text-amber-700' : 'text-ink'}`}>
        {value.toLocaleString('fr-FR')}
      </dd>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
}
