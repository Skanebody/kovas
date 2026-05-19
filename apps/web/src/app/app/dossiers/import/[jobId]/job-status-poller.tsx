'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IMPORT_LIMITS, type ImportJobStatus, type JobStatusResponse } from '@/lib/import/types'
import { cn } from '@/lib/utils'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

interface JobStatusPollerProps {
  jobId: string
  initialStatus: ImportJobStatus
}

type LineState = 'done' | 'current' | 'future'

/** Ordre logique des sous-étapes (mapping status → progress numérique). */
const STATUS_ORDER: ImportJobStatus[] = [
  'uploaded',
  'parsing',
  'parsed',
  'normalizing',
  'normalized',
  'deduping',
  'deduped',
]

/** Définition des 7 lignes affichées + status minimum pour passer 'done'. */
const STEPS: { key: string; label: string; doneAt: ImportJobStatus }[] = [
  { key: 'read', label: 'Lecture du fichier', doneAt: 'parsing' },
  { key: 'extract', label: 'Extraction des données', doneAt: 'parsed' },
  { key: 'addr', label: 'Normalisation des adresses', doneAt: 'normalizing' },
  { key: 'siret', label: 'Vérification des SIRET', doneAt: 'normalized' },
  { key: 'dedupe', label: 'Détection des doublons', doneAt: 'deduping' },
  { key: 'enrich', label: 'Enrichissement', doneAt: 'deduped' },
  { key: 'validate', label: 'Préparation de la validation', doneAt: 'deduped' },
]

function statusIndex(s: ImportJobStatus): number {
  const i = STATUS_ORDER.indexOf(s)
  return i === -1 ? -1 : i
}

function isTerminal(s: ImportJobStatus): boolean {
  return s === 'completed' || s === 'failed' || s === 'cancelled'
}

function lineStateFor(
  doneAt: ImportJobStatus,
  current: ImportJobStatus,
  index: number,
  steps: typeof STEPS,
): LineState {
  // Si job en succès complet → tout est done
  if (current === 'completed') return 'done'

  const currentIdx = statusIndex(current)
  const doneAtIdx = statusIndex(doneAt)
  if (currentIdx === -1 || doneAtIdx === -1) return 'future'

  // 'done' = on a dépassé l'étape : status courant >= doneAt
  if (currentIdx >= doneAtIdx) return 'done'

  // 'current' = première ligne pas encore 'done'
  for (let i = 0; i < index; i++) {
    const prev = steps[i]
    if (!prev) continue
    const prevDoneAtIdx = statusIndex(prev.doneAt)
    if (currentIdx < prevDoneAtIdx) return 'future'
  }
  return 'current'
}

/**
 * Composant client polling /api/import/status/[jobId] toutes les 2s.
 *
 * Affiche les 7 sous-étapes avec coches/spinners/labels selon l'avancement.
 * Stop le polling sur statut terminal (completed/failed/cancelled).
 *
 * Sur succès : redirige vers /app/dossiers?imported={jobId} (placeholder
 * pour l'étape 5 qui sera implémentée plus tard).
 */
export function JobStatusPoller({ jobId, initialStatus }: JobStatusPollerProps) {
  const router = useRouter()
  const [status, setStatus] = useState<ImportJobStatus>(initialStatus)
  const [response, setResponse] = useState<JobStatusResponse | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const triggeredParseRef = useRef(false)
  // Ref miroir de `status` pour éviter de redémarrer le setInterval à chaque tick.
  const statusRef = useRef<ImportJobStatus>(initialStatus)
  statusRef.current = status

  // Trigger automatique du parse (stub) au chargement si status='uploaded'.
  // En vrai, le parse serait déclenché par un worker / cron — pour l'instant
  // on le lance depuis le client juste après l'upload.
  useEffect(() => {
    if (triggeredParseRef.current) return
    if (initialStatus !== 'uploaded') return
    triggeredParseRef.current = true
    void fetch(`/api/import/parse/${jobId}`, { method: 'POST' }).catch(() => {
      /* on laisse le polling remonter l'erreur */
    })
  }, [jobId, initialStatus])

  // Polling
  useEffect(() => {
    let cancelled = false

    async function tick() {
      try {
        const res = await fetch(`/api/import/status/${jobId}`, {
          cache: 'no-store',
        })
        if (!res.ok) {
          if (!cancelled) setPollError(`Erreur ${res.status}`)
          return
        }
        const body = (await res.json()) as JobStatusResponse
        if (cancelled) return
        setResponse(body)
        setStatus(body.job.status)
      } catch (err) {
        if (!cancelled) {
          setPollError(err instanceof Error ? err.message : 'polling failed')
        }
      }
    }

    // Premier tick immédiat
    void tick()

    const interval = setInterval(() => {
      if (isTerminal(statusRef.current)) {
        clearInterval(interval)
        return
      }
      void tick()
    }, IMPORT_LIMITS.POLLING_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [jobId])

  // Transitions : 'deduped' → on rafraîchit pour que la page parent affiche
  // la DuplicateReviewView. 'completed' → idem pour basculer sur ImportSummary.
  useEffect(() => {
    if (status === 'deduped' || status === 'completed') {
      router.refresh()
    }
  }, [status, router])

  async function onCancel() {
    if (cancelling) return
    setCancelling(true)
    try {
      await fetch(`/api/import/${jobId}`, { method: 'DELETE' })
      router.push('/app/dossiers/import')
    } catch {
      setCancelling(false)
    }
  }

  const isFailed = status === 'failed'
  const isCancelled = status === 'cancelled'
  const isComplete = status === 'completed'
  const progressPercent = response?.progress_percent ?? null

  return (
    <Card variant="opaque" padding="default">
      <CardContent className="pt-2 space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
              Job · {jobId.slice(0, 8)}
            </p>
            <h2 className="font-serif italic font-normal text-xl md:text-2xl text-ink leading-tight">
              {isFailed
                ? 'Échec de l’import.'
                : isCancelled
                  ? 'Import annulé.'
                  : isComplete
                    ? 'Import terminé.'
                    : 'Analyse en cours…'}
            </h2>
          </div>
          {progressPercent !== null && !isFailed && !isCancelled && (
            <Badge variant={isComplete ? 'green' : 'blue'} className="font-mono">
              {progressPercent}%
            </Badge>
          )}
        </header>

        {/* Barre de progression globale */}
        {!isFailed && !isCancelled && progressPercent !== null && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-deep">
            <div
              className={cn(
                'h-full transition-all duration-700 ease-out',
                isComplete ? 'bg-accent-green' : 'bg-navy',
              )}
              style={{ width: `${progressPercent}%` }}
              aria-hidden
            />
          </div>
        )}

        {/* Erreur de polling */}
        {pollError && !isFailed && (
          <output className="text-xs text-orange-600 italic">
            Connexion instable : {pollError}. Nouvelle tentative…
          </output>
        )}

        {/* Message d'erreur job */}
        {isFailed && response?.job.error_message && (
          <div className="rounded-lg border border-danger/40 bg-danger/5 p-3 flex items-start gap-2 text-sm text-danger">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" aria-hidden />
            <p>{response.job.error_message}</p>
          </div>
        )}

        {/* Liste des 7 sous-étapes */}
        <ol className="space-y-2">
          {STEPS.map((step, idx) => {
            const state = lineStateFor(step.doneAt, status, idx, STEPS)
            return (
              <li
                key={step.key}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2',
                  state === 'current' && 'bg-chartreuse/10 border border-chartreuse/40',
                  state === 'done' && 'bg-paper/40',
                )}
              >
                <span
                  className={cn(
                    'inline-flex size-5 items-center justify-center rounded-full shrink-0',
                    state === 'done' && 'bg-accent-green text-paper',
                    state === 'current' && 'bg-chartreuse text-ink',
                    state === 'future' && 'border border-rule bg-paper',
                  )}
                  aria-hidden
                >
                  {state === 'done' ? (
                    <Check className="size-3" strokeWidth={3} />
                  ) : state === 'current' ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : null}
                </span>
                <span
                  className={cn(
                    'text-sm',
                    state === 'done' && 'text-ink-mute line-through decoration-1',
                    state === 'current' && 'text-ink font-medium',
                    state === 'future' && 'text-ink-mute',
                  )}
                >
                  {step.label}
                </span>
              </li>
            )
          })}
        </ol>

        {/* Métriques après dédoublonnage */}
        {response && (status === 'deduped' || status === 'completed') && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-rule/40">
            <Metric label="Clients" value={response.job.detected_clients_count} />
            <Metric label="Biens" value={response.job.detected_properties_count} />
            <Metric label="Lots" value={response.job.detected_lots_count} />
            <Metric label="Copros" value={response.job.detected_coproprietes_count} />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center pt-2 flex-wrap gap-2">
          {!isTerminal(status) ? (
            <Button variant="ghost" onClick={onCancel} disabled={cancelling}>
              {cancelling ? 'Annulation…' : 'Annuler l’import'}
            </Button>
          ) : (
            <span />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-0.5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">{label}</p>
      <p className="font-serif italic text-2xl text-ink">{value}</p>
    </div>
  )
}
