'use client'

import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { useState } from 'react'

interface EdgeResponseSummary {
  ok: boolean
  imported?: number
  updated?: number
  ceased?: number
  errors?: number
  durationMs?: number
  totalRows?: number
  certificationsUpserted?: number
  error?: string
  errorMessages?: string[]
}

interface RunResponse {
  ok: boolean
  edge?: EdgeResponseSummary
  triggeredBy: string
  triggeredAt: string
  error?: string
}

export function DhupImportPanel({ initialLastImportAt }: { initialLastImportAt: string | null }) {
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<RunResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    setPending(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/admin/diagnosticians/run-dhup-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const payload = (await res.json()) as RunResponse
      setResult(payload)
      if (!res.ok || !payload.ok) {
        setError(payload.error ?? 'Échec import DHUP — voir détails ci-dessous.')
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
          Appelle l'Edge Function <code>absorb-dhup-directory</code> avec authentification
          service_role. Durée typique : 30 s à 2 min selon la taille du dataset DHUP. La page peut
          être quittée pendant l'import.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleRun} disabled={pending} size="lg">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Import en cours…
            </>
          ) : (
            <>
              <RefreshCw className="size-4" />
              Lancer l'import DHUP
            </>
          )}
        </Button>
        {initialLastImportAt ? (
          <p className="text-[12px] text-ink-mute">
            Dernier import :{' '}
            {new Date(initialLastImportAt).toLocaleString('fr-FR', {
              timeZone: 'Europe/Paris',
            })}
          </p>
        ) : (
          <p className="text-[12px] text-ink-faint">Aucun import enregistré.</p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-coral/40 bg-coral/5 p-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-coral" />
          <div className="space-y-1">
            <p className="text-[12px] font-semibold text-coral">Erreur</p>
            <p className="text-[12px] text-coral/90">{error}</p>
          </div>
        </div>
      )}

      {result?.ok && result.edge?.ok && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-400/40 bg-emerald-400/5 p-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <div className="space-y-2">
            <p className="text-[12px] font-semibold text-emerald-700">
              Import terminé en{' '}
              {result.edge.durationMs ? `${Math.round(result.edge.durationMs / 1000)}s` : '—'}
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-4">
              <ResultStat label="Nouvelles" value={result.edge.imported ?? 0} />
              <ResultStat label="Mises à jour" value={result.edge.updated ?? 0} />
              <ResultStat label="Cessées" value={result.edge.ceased ?? 0} />
              <ResultStat label="Erreurs" value={result.edge.errors ?? 0} />
              <ResultStat label="Total lignes" value={result.edge.totalRows ?? 0} />
              <ResultStat label="Certifs upsert" value={result.edge.certificationsUpserted ?? 0} />
            </dl>
            <p className="text-[11px] text-ink-faint">
              Déclenché par {result.triggeredBy} le{' '}
              {new Date(result.triggeredAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
            </p>
          </div>
        </div>
      )}

      {result?.edge?.errorMessages && result.edge.errorMessages.length > 0 && (
        <details className="rounded-lg border border-rule/60 bg-cream-deep/40 p-3">
          <summary className="cursor-pointer text-[12px] font-medium text-ink-mute">
            Voir les {result.edge.errorMessages.length} message(s) d'erreur détaillé(s)
          </summary>
          <ul className="mt-2 space-y-1 text-[11px] font-mono text-ink-mute">
            {result.edge.errorMessages.slice(0, 50).map((msg) => (
              <li key={`err-${msg.slice(0, 80)}`}>• {msg}</li>
            ))}
            {result.edge.errorMessages.length > 50 && (
              <li className="italic">… {result.edge.errorMessages.length - 50} autres tronqués.</li>
            )}
          </ul>
        </details>
      )}
    </section>
  )
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="text-base font-semibold text-ink tabular-nums">
        {value.toLocaleString('fr-FR')}
      </dd>
    </div>
  )
}
