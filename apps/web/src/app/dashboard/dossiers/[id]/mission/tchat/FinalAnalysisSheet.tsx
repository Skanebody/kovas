'use client'

/**
 * KOVAS — FinalAnalysisSheet : résultat de l'analyse finale (MISSION-H).
 *
 * Affiche le récap structuré renvoyé par /api/mission/[id]/finalize-analysis :
 *   - Synthèse globale (sobre, vouvoiement)
 *   - Récap pièce par pièce
 *   - Liste des champs manquants pour finaliser l'export Liciel (gaps),
 *     avec suggestion + bouton "Ajouter une note vocale" qui ferme le
 *     sheet et pré-remplit le composer du tchat.
 *   - CTA "Valider et exporter vers Liciel" (route export existante)
 *
 * Pattern V5 : sage + navy, cards flat, accent chartreuse parcimonieux.
 *
 * Authority : CLAUDE.md §3 + spec MISSION-H lot 2.
 */

import { BottomSheet, BottomSheetBody, BottomSheetTitle } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Mic } from 'lucide-react'

export interface FinalAnalysisGap {
  field: string
  label: string
  suggestion: string
  diagnostic?: string | null
}

export interface FinalAnalysisRoomSummary {
  room: string
  observations: string[]
}

export interface FinalAnalysisResult {
  summary: string
  rooms: FinalAnalysisRoomSummary[]
  gaps: FinalAnalysisGap[]
  capturesCount: number
}

interface FinalAnalysisSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null tant que l'analyse n'est pas revenue. */
  result: FinalAnalysisResult | null
  /** True pendant l'appel POST. */
  isLoading: boolean
  /** Message d'erreur si l'analyse a échoué. */
  error: string | null
  /** Callback "Ajouter une note vocale" → ferme sheet + amorce dictée avec contexte. */
  onAddVoiceNoteForGap: (gap: FinalAnalysisGap) => void
  /** Callback "Valider et exporter" → redirige vers la route export. */
  onExport: () => void
  /** Callback "Relancer" en cas d'erreur. */
  onRetry: () => void
}

export function FinalAnalysisSheet({
  open,
  onOpenChange,
  result,
  isLoading,
  error,
  onAddVoiceNoteForGap,
  onExport,
  onRetry,
}: FinalAnalysisSheetProps): React.ReactElement {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} maxHeight="92vh">
      <BottomSheetTitle>Analyse de ta session</BottomSheetTitle>

      <BottomSheetBody>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="size-6 animate-spin text-[#0F1419]/72" aria-hidden />
            <p className="text-[13px] text-[#0F1419]/82 text-center max-w-sm">
              L'assistant analyse vos captures…
              <br />
              <span className="text-[#0F1419]/72 text-[12px]">
                Synthèse pièce par pièce + détection des champs manquants pour Liciel.
              </span>
            </p>
          </div>
        ) : error ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-accent-red/30 bg-accent-red/5 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-accent-red" aria-hidden />
                <div className="text-[13px] text-[#0F1419]">
                  <p className="font-medium mb-1">Analyse impossible</p>
                  <p className="text-[#0F1419]/82">{error}</p>
                </div>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={onRetry} className="w-full">
              Réessayer
            </Button>
          </div>
        ) : result ? (
          <div className="space-y-6">
            {/* Synthèse globale */}
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#0F1419]/72 mb-2">
                Synthèse
              </h3>
              <p className="text-[14px] text-[#0F1419] leading-relaxed whitespace-pre-wrap">
                {result.summary || '—'}
              </p>
              <p className="mt-2 font-mono text-[11px] text-[#0F1419]/72">
                {result.capturesCount} capture{result.capturesCount > 1 ? 's' : ''} analysée
                {result.capturesCount > 1 ? 's' : ''}
              </p>
            </section>

            {/* Récap par pièce */}
            {result.rooms.length > 0 ? (
              <section>
                <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#0F1419]/72 mb-2">
                  Pièce par pièce
                </h3>
                <ul className="space-y-3">
                  {result.rooms.map((r) => (
                    <li
                      key={r.room}
                      className="rounded-lg border border-[#0F1419]/[0.08] bg-paper px-3 py-2.5"
                    >
                      <p className="text-[13px] font-semibold text-[#0F1419] mb-1">{r.room}</p>
                      <ul className="space-y-1">
                        {r.observations.map((obs, idx) => (
                          <li
                            key={`${r.room}-${idx}`}
                            className="text-[13px] text-[#0F1419]/82 leading-relaxed flex gap-1.5"
                          >
                            <span className="text-[#0F1419]/72 shrink-0">·</span>
                            <span>{obs}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Gaps */}
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#0F1419]/72 mb-2 flex items-center gap-2">
                À compléter pour finaliser
                {result.gaps.length > 0 ? (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center rounded-pill px-1.5 py-0.5',
                      'bg-accent-warm-soft text-accent-warm font-mono text-[10px]',
                    )}
                  >
                    {result.gaps.length}
                  </span>
                ) : null}
              </h3>

              {result.gaps.length === 0 ? (
                <div className="rounded-lg border border-accent-green/30 bg-accent-green/5 px-3 py-2.5 flex items-start gap-2">
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-accent-green" aria-hidden />
                  <p className="text-[13px] text-[#0F1419]">
                    Aucun champ manquant détecté. Ta session est prête pour l'export Liciel.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {result.gaps.map((gap) => (
                    <li
                      key={gap.field}
                      className="rounded-lg border border-[#0F1419]/[0.08] bg-paper px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#0F1419] leading-tight">
                            {gap.label}
                          </p>
                          {gap.diagnostic ? (
                            <p className="font-mono text-[10px] uppercase tracking-wide text-[#0F1419]/72 mt-0.5">
                              {gap.diagnostic} · {gap.field}
                            </p>
                          ) : (
                            <p className="font-mono text-[10px] text-[#0F1419]/72 mt-0.5">
                              {gap.field}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-[13px] text-[#0F1419]/82 leading-relaxed mb-2">
                        {gap.suggestion}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onAddVoiceNoteForGap(gap)}
                        className="text-[12px] h-8 gap-1.5"
                      >
                        <Mic className="size-3.5" aria-hidden />
                        Ajouter une note vocale
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </BottomSheetBody>

      {result && !isLoading && !error ? (
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-4 pt-4 pb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="sm:w-auto w-full"
          >
            Continuer la capture
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={onExport}
            className="sm:w-auto w-full gap-1.5"
          >
            Valider et exporter vers Liciel
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}
    </BottomSheet>
  )
}
