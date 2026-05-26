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
  /**
   * Coût en USD côté serveur. Plus exposé dans l'UX client (cf. audit P2-18).
   * Conservé en prop pour compat callers / future page admin obs.
   */
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
  costUsd: _costUsd,
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
          <DialogTitle className="font-serif text-3xl italic text-[#0F1419]">
            Consolidation <span className="text-display-serif">terminée</span>
          </DialogTitle>
        </DialogHeader>

        {/* Synthèse Claude */}
        {summary ? <p className="text-sm text-[#0F1419]/82 leading-relaxed">{summary}</p> : null}

        {/* Stats hero : 3 chiffres */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
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

        {/* Confidence — coût IA retiré de l'UX client (cf. audit P2-18 mode mission).
            Exposer un coût en $ à un diagnostiqueur FR est confus et n'apporte
            rien fonctionnellement — c'est une métrique admin / observabilité. */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[#0F1419]/[0.08] bg-paper px-3 py-2 text-xs text-[#0F1419]/72">
          <span>
            Confiance globale :{' '}
            <strong className="font-semibold text-[#0F1419]">{confidencePct}%</strong>
          </span>
        </div>

        {/* Warnings */}
        {warnings && warnings.length > 0 ? (
          <div className="space-y-1 rounded-lg border border-chartreuse/30 bg-chartreuse/10 px-3 py-2 text-xs text-[#0F1419]/82">
            {warnings.map((w) => (
              <p key={w} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-3 shrink-0 text-[#95B11A]" aria-hidden />
                <span>{w}</span>
              </p>
            ))}
          </div>
        ) : null}

        {/* Manques */}
        {missingRequired.length > 0 ? (
          <section className="space-y-2">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#0F1419]/72">
              Champs obligatoires manquants ({missingRequired.length})
            </h3>
            <ul className="space-y-2">
              {missingRequired.slice(0, 8).map((m) => (
                <li
                  key={`${m.diagnostic}::${m.field_path}`}
                  className="rounded-lg border border-[#0F1419]/[0.08] bg-paper p-3 text-xs"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#0F1419]/72">
                      {m.diagnostic}
                    </span>
                    <strong className="text-sm font-medium text-[#0F1419]">{m.label}</strong>
                  </div>
                  {m.why_required ? (
                    <p className="mt-1 text-[#0F1419]/72">{m.why_required}</p>
                  ) : null}
                  {m.suggestion ? (
                    <p className="mt-1 text-[#0F1419]/82">
                      <span className="font-medium">Suggestion :</span> {m.suggestion}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            {missingRequired.length > 8 ? (
              <p className="text-xs text-[#0F1419]/72">
                + {missingRequired.length - 8} autre{missingRequired.length - 8 > 1 ? 's' : ''}{' '}
                champ{missingRequired.length - 8 > 1 ? 's' : ''} non affiché
                {missingRequired.length - 8 > 1 ? 's' : ''}.
              </p>
            ) : null}
          </section>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-[#0F1419]/[0.08] bg-paper px-3 py-2 text-xs text-[#0F1419]/82">
            <CheckCircle2 className="size-4 text-chartreuse-deep" aria-hidden />
            <span>Tous les champs obligatoires sont couverts.</span>
          </div>
        )}

        {/* Conflits — aperçu */}
        {conflicts.length > 0 ? (
          <section className="space-y-2">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#0F1419]/72">
              Conflits détectés ({conflicts.length})
            </h3>
            <ul className="space-y-2">
              {conflicts.slice(0, 5).map((c) => (
                <li
                  key={`${c.diagnostic}::${c.field_path}`}
                  className="rounded-lg border border-chartreuse/30 bg-chartreuse/5 p-3 text-xs"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#0F1419]/72">
                      {c.diagnostic}
                    </span>
                    <strong className="text-sm font-medium text-[#0F1419]">{c.field_path}</strong>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-[#0F1419]/82">
                    {c.candidates.slice(0, 3).map((cand, i) => (
                      <li key={`${i}-${cand.source_type}`} className="flex gap-2">
                        <span className="font-mono text-[#0F1419]/72">{cand.source_type}</span>
                        <span className="font-medium text-[#0F1419]">
                          {stringifyValue(cand.value)}
                        </span>
                        <span className="text-[#0F1419]/72">
                          ({Math.round(cand.confidence * 100)}%)
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-[#0F1419]/72 italic">
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
        tone === 'ok'
          ? 'border-[#0F1419]/[0.08] bg-paper'
          : 'border-chartreuse/30 bg-chartreuse/10',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center gap-1',
          tone === 'ok' ? 'text-[#0F1419]/72' : 'text-[#95B11A]',
        )}
      >
        {icon}
      </div>
      <div className="font-serif text-3xl italic leading-none text-[#0F1419] mt-1">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/72">{label}</div>
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
