'use client'

/**
 * OKRsList — liste les OKRs (par défaut trimestre courant + draft suivant).
 *
 * V1 : lecture + accès vers OKREditor (création / édition).
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { OkrRow } from '@/lib/admin/milestones-types'
import { computeOkrProgress, krProgress } from '@/lib/admin/milestones-types'
import { useState } from 'react'
import { OKREditor } from './OKREditor'

export interface OKRsListProps {
  okrs: OkrRow[]
  /** Trimestre courant pour le titre / fallback création. */
  currentQuarter: string
  nextQuarter: string
}

const STATUS_LABEL: Record<OkrRow['status'], string> = {
  active: 'Actif',
  draft: 'Brouillon',
  completed: 'Terminé',
  cancelled: 'Annulé',
}

const STATUS_BG: Record<OkrRow['status'], string> = {
  active: 'bg-lime-mist text-[#2D4015]',
  draft: 'bg-cream-deep text-ink-mute',
  completed: 'bg-blue-mist text-[#1E3A8A]',
  cancelled: 'bg-coral-mist text-[#8B1414]',
}

export function OKRsList({ okrs, currentQuarter, nextQuarter }: OKRsListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const editingOkr = okrs.find((o) => o.id === editingId) ?? null

  return (
    <Card variant="opaque" padding="default">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            🎯 OKRs · {currentQuarter}
          </p>
          <h2 className="font-serif italic text-3xl text-ink mt-1">Objectifs trimestriels.</h2>
        </div>
        <Button
          type="button"
          variant="accent"
          size="sm"
          onClick={() => {
            setCreating(true)
            setEditingId(null)
          }}
        >
          + Nouvel OKR
        </Button>
      </header>

      {okrs.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">
          Aucun OKR pour le moment. Crée le premier objectif pour {currentQuarter}.
        </p>
      ) : (
        <ul className="space-y-4" aria-label="OKRs">
          {okrs.map((okr) => {
            const progress = okr.progress ?? computeOkrProgress(okr.key_results)
            return (
              <li key={okr.id} className="rounded-lg border border-rule/60 bg-paper/60 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                        {okr.quarter}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-medium ${STATUS_BG[okr.status]}`}
                      >
                        {STATUS_LABEL[okr.status]}
                      </span>
                    </div>
                    <h3 className="font-serif italic text-2xl text-ink leading-tight">
                      {okr.objective}
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingId(okr.id)
                      setCreating(false)
                    }}
                  >
                    Modifier
                  </Button>
                </div>

                {/* Progress + KRs */}
                <div className="mt-3">
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <span className="text-[12px] text-ink-mute font-mono">Progression globale</span>
                    <span className="font-serif italic text-xl text-ink leading-none">
                      {Math.round(progress * 100)}%
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-pill bg-cream-deep/60 overflow-hidden"
                    role="progressbar"
                    tabIndex={0}
                    aria-valuenow={Math.round(progress * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full bg-chartreuse transition-all duration-base"
                      style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
                    />
                  </div>

                  {okr.key_results.length > 0 ? (
                    <ul className="mt-4 space-y-2" aria-label="Key results">
                      {okr.key_results.map((kr, idx) => {
                        const krp = krProgress(kr)
                        return (
                          <li
                            key={`${okr.id}-kr-${idx}`}
                            className="flex items-center gap-3 text-[13px]"
                          >
                            <span className="text-ink flex-1 truncate">{kr.name}</span>
                            <span className="font-mono text-[11px] text-ink-mute whitespace-nowrap">
                              {kr.current} / {kr.target}
                              {kr.unit ? ` ${kr.unit}` : ''}
                            </span>
                            <span className="font-mono text-[11px] text-ink-faint min-w-[40px] text-right">
                              {Math.round(krp * 100)}%
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Editor inline (V1.5 → modale) */}
      {creating ? (
        <div className="mt-6">
          <OKREditor
            mode="create"
            initialQuarter={nextQuarter}
            onClose={() => setCreating(false)}
          />
        </div>
      ) : null}
      {editingOkr ? (
        <div className="mt-6">
          <OKREditor mode="edit" okr={editingOkr} onClose={() => setEditingId(null)} />
        </div>
      ) : null}
    </Card>
  )
}
