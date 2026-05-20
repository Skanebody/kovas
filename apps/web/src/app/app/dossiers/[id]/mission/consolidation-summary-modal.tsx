'use client'

/**
 * KOVAS — Modal récap consolidation (Capture-First V1.5 iteration 5).
 *
 * S'ouvre après un POST /api/missions/[id]/consolidate réussi. Affiche :
 * - 3 chiffres hero (champs consolidés / conflits / manques)
 * - synthèse Claude (2-3 phrases)
 * - liste des champs manquants avec suggestion d'action
 * - liste des conflits (aperçu — la résolution UI viendra iter 7)
 *
 * Iteration 5 : simple modal de lecture. Iteration 7 ajoutera des CTA inline
 * pour résoudre les conflits + cocher les manques.
 */

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ConflictReport, MissingField } from '@/lib/mission/consolidator'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, ListChecks, Sparkles } from 'lucide-react'

export interface ConsolidationSummaryModalProps {
  open: boolean
  onClose: () => void
  fieldsConsolidated: number
  conflicts: ConflictReport[]
  missingRequired: MissingField[]
  globalConfidence: number
  summary: string
  costUsd: number
  warnings?: string[]
}

export function ConsolidationSummaryModal({
  open,
  onClose,
  fieldsConsolidated,
  conflicts,
  missingRequired,
  globalConfidence,
  summary,
  costUsd,
  warnings,
}: ConsolidationSummaryModalProps) {
  const confidencePct = Math.round(globalConfidence * 100)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-3xl italic text-ink">
            Consolidation <span className="text-display-serif">terminée</span>
          </DialogTitle>
        </DialogHeader>

        {/* Synthèse Claude */}
        {summary ? <p className="text-sm text-ink-soft leading-relaxed">{summary}</p> : null}

        {/* Stats hero : 3 chiffres */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<Sparkles className="size-4" aria-hidden />}
            value={fieldsConsolidated}
            label={fieldsConsolidated > 1 ? 'champs consolidés' : 'champ consolidé'}
            tone="ok"
          />
          <StatCard
            icon={<AlertTriangle className="size-4" aria-hidden />}
            value={conflicts.length}
            label={conflicts.length > 1 ? 'conflits' : 'conflit'}
            tone={conflicts.length === 0 ? 'ok' : 'warn'}
          />
          <StatCard
            icon={<ListChecks className="size-4" aria-hidden />}
            value={missingRequired.length}
            label={missingRequired.length > 1 ? 'champs manquants' : 'champ manquant'}
            tone={missingRequired.length === 0 ? 'ok' : 'warn'}
          />
        </div>

        {/* Confidence + coût */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-rule bg-paper/40 px-3 py-2 text-xs text-ink-mute">
          <span>
            Confiance globale : <strong className="font-semibold text-ink">{confidencePct}%</strong>
          </span>
          <span>
            Coût IA : <strong className="font-mono text-ink">${costUsd.toFixed(4)}</strong>
          </span>
        </div>

        {/* Warnings */}
        {warnings && warnings.length > 0 ? (
          <div className="space-y-1 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-ink-soft">
            {warnings.map((w) => (
              <p key={w} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber" aria-hidden />
                <span>{w}</span>
              </p>
            ))}
          </div>
        ) : null}

        {/* Manques */}
        {missingRequired.length > 0 ? (
          <section className="space-y-2">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
              Champs obligatoires manquants ({missingRequired.length})
            </h3>
            <ul className="space-y-2">
              {missingRequired.slice(0, 8).map((m) => (
                <li
                  key={`${m.diagnostic}::${m.field_path}`}
                  className="rounded-lg border border-rule bg-paper/40 p-3 text-xs"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
                      {m.diagnostic}
                    </span>
                    <strong className="text-sm font-medium text-ink">{m.label}</strong>
                  </div>
                  {m.why_required ? <p className="mt-1 text-ink-mute">{m.why_required}</p> : null}
                  {m.suggestion ? (
                    <p className="mt-1 text-ink-soft">
                      <span className="font-medium">Suggestion :</span> {m.suggestion}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            {missingRequired.length > 8 ? (
              <p className="text-xs text-ink-mute">
                + {missingRequired.length - 8} autre{missingRequired.length - 8 > 1 ? 's' : ''}{' '}
                champ{missingRequired.length - 8 > 1 ? 's' : ''} non affiché
                {missingRequired.length - 8 > 1 ? 's' : ''}.
              </p>
            ) : null}
          </section>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-rule bg-paper/40 px-3 py-2 text-xs text-ink-soft">
            <CheckCircle2 className="size-4 text-chartreuse-deep" aria-hidden />
            <span>Tous les champs obligatoires sont couverts.</span>
          </div>
        )}

        {/* Conflits — aperçu */}
        {conflicts.length > 0 ? (
          <section className="space-y-2">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
              Conflits détectés ({conflicts.length})
            </h3>
            <ul className="space-y-2">
              {conflicts.slice(0, 5).map((c) => (
                <li
                  key={`${c.diagnostic}::${c.field_path}`}
                  className="rounded-lg border border-amber/30 bg-amber/5 p-3 text-xs"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
                      {c.diagnostic}
                    </span>
                    <strong className="text-sm font-medium text-ink">{c.field_path}</strong>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-ink-soft">
                    {c.candidates.slice(0, 3).map((cand, i) => (
                      <li key={`${i}-${cand.source_type}`} className="flex gap-2">
                        <span className="font-mono text-ink-mute">{cand.source_type}</span>
                        <span className="font-medium text-ink">{stringifyValue(cand.value)}</span>
                        <span className="text-ink-mute">
                          ({Math.round(cand.confidence * 100)}%)
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-ink-mute italic">
              La résolution interactive des conflits arrivera en itération 7.
            </p>
          </section>
        ) : null}

        <div className="flex justify-end pt-2">
          <Button type="button" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Sub-components
// ============================================

interface StatCardProps {
  icon: React.ReactNode
  value: number
  label: string
  tone: 'ok' | 'warn'
}

function StatCard({ icon, value, label, tone }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3 text-center',
        tone === 'ok' ? 'border-rule bg-paper/60' : 'border-amber/30 bg-amber/10',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center gap-1',
          tone === 'ok' ? 'text-ink-mute' : 'text-amber',
        )}
      >
        {icon}
      </div>
      <div className="font-serif text-3xl italic leading-none text-ink mt-1">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.06em] text-ink-mute">{label}</div>
    </div>
  )
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '∅'
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'oui' : 'non'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
