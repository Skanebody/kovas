'use client'

/**
 * Composant client de la queue de validation Veille SEO.
 *
 * Master-detail :
 *  - Colonne gauche : liste articles pending triés par eeat_score DESC
 *  - Colonne droite : preview Markdown + 4 sliders E-E-A-T + actions
 *    (Approuver / Rejeter / Régénérer)
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArticleMarkdown } from '@/components/veille/ArticleMarkdown'
import { CATEGORY_LABELS } from '@/lib/veille/types'
import { CheckCircle2, Loader2, RefreshCw, Sparkles, XCircle } from 'lucide-react'
import { useState, useTransition } from 'react'
import { approveArticle, regenerateArticle, rejectArticle, triggerBatchGeneration } from './actions'
import type { VeilleQueueArticle } from './page'

interface VeilleQueueBoardProps {
  readonly articles: ReadonlyArray<VeilleQueueArticle>
  readonly stats: {
    readonly pending: number
    readonly published30d: number
    readonly rejected30d: number
    readonly totalCost30dEur: number
  }
}

interface EeatScores {
  experience: number
  expertise: number
  authoritativeness: number
  trustworthiness: number
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function VeilleQueueBoard({ articles, stats }: VeilleQueueBoardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(articles[0]?.id ?? null)
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState<{ action: string; id: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, EeatScores>>(() => {
    const map: Record<string, EeatScores> = {}
    for (const a of articles) {
      map[a.id] = {
        experience: a.eeatExperience,
        expertise: a.eeatExpertise,
        authoritativeness: a.eeatAuthoritativeness,
        trustworthiness: a.eeatTrustworthiness,
      }
    }
    return map
  })

  const selected = articles.find((a) => a.id === selectedId) ?? null

  function updateScore(id: string, axis: keyof EeatScores, value: number) {
    setScores((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? {
          experience: 0,
          expertise: 0,
          authoritativeness: 0,
          trustworthiness: 0,
        }),
        [axis]: value,
      },
    }))
  }

  async function handleApprove(id: string) {
    setBusy({ action: 'approve', id })
    setErrorMsg(null)
    const s = scores[id]
    const result = await approveArticle(id, {
      eeatExperience: s?.experience,
      eeatExpertise: s?.expertise,
      eeatAuthoritativeness: s?.authoritativeness,
      eeatTrustworthiness: s?.trustworthiness,
    })
    setBusy(null)
    if (!result.ok) {
      setErrorMsg(result.error ?? 'Échec inconnu')
      return
    }
    startTransition(() => {
      // Le revalidatePath déclenche le re-render serveur
      window.location.reload()
    })
  }

  async function handleReject(id: string) {
    const reason = window.prompt('Motif du rejet (sera enregistré pour amélioration du prompt) :')
    if (!reason || !reason.trim()) return
    setBusy({ action: 'reject', id })
    setErrorMsg(null)
    const result = await rejectArticle(id, reason)
    setBusy(null)
    if (!result.ok) {
      setErrorMsg(result.error ?? 'Échec inconnu')
      return
    }
    startTransition(() => window.location.reload())
  }

  async function handleRegenerate(id: string) {
    if (
      !window.confirm(
        'Marquer cet article comme rejeté et lancer une nouvelle génération sur le même mot-clé ?',
      )
    )
      return
    setBusy({ action: 'regenerate', id })
    setErrorMsg(null)
    const result = await regenerateArticle(id)
    setBusy(null)
    if (!result.ok) {
      setErrorMsg(result.error ?? 'Échec inconnu')
      return
    }
    startTransition(() => window.location.reload())
  }

  async function handleBatchGenerate() {
    setBusy({ action: 'batch', id: 'global' })
    setErrorMsg(null)
    const result = await triggerBatchGeneration(2)
    setBusy(null)
    if (!result.ok) {
      setErrorMsg(result.error ?? 'Échec inconnu')
      return
    }
    startTransition(() => window.location.reload())
  }

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Veille SEO · File de validation
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Articles à publier.
        </h1>
        <p className="text-sm text-ink-mute max-w-2xl">
          Pipeline Claude Haiku méthode Amandine Bart. Cron hebdomadaire (mardis 6 h CET) — 2
          articles par semaine, validation manuelle requise avant mise en ligne sur
          /dashboard/veille/articles.
        </p>
      </div>

      {/* Stats */}
      <section aria-label="Indicateurs queue" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            En attente
          </p>
          <p className="font-serif italic text-3xl text-ink mt-1">{stats.pending}</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Publiés 30 j
          </p>
          <p className="font-serif italic text-3xl text-ink mt-1">{stats.published30d}</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Rejetés 30 j
          </p>
          <p className="font-serif italic text-3xl text-ink mt-1">{stats.rejected30d}</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Coût IA 30 j
          </p>
          <p className="font-serif italic text-3xl text-ink mt-1">
            {formatEur(stats.totalCost30dEur)}
          </p>
        </Card>
      </section>

      {/* Action batch */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-ink-mute">
          {articles.length} article{articles.length > 1 ? 's' : ''} à valider
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleBatchGenerate}
          disabled={busy?.action === 'batch'}
        >
          {busy?.action === 'batch' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          Générer 2 articles maintenant
        </Button>
      </div>

      {errorMsg ? (
        <Card className="p-4 border-red-300 bg-red-50/60">
          <p className="text-sm text-red-700">{errorMsg}</p>
        </Card>
      ) : null}

      {articles.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-ink-mute mb-2">La file est vide — aucun article en attente.</p>
          <p className="text-xs text-ink-faint">
            Le cron hebdomadaire ajoutera 2 nouveaux drafts mardi prochain.
          </p>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-6">
          {/* Liste articles */}
          <aside className="space-y-2 max-h-[80vh] overflow-y-auto pr-2">
            {articles.map((a) => {
              const isSelected = a.id === selectedId
              const liveScores = scores[a.id]
              const liveAvg = liveScores
                ? Math.round(
                    (liveScores.experience +
                      liveScores.expertise +
                      liveScores.authoritativeness +
                      liveScores.trustworthiness) /
                      4,
                  )
                : a.eeatScore
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedId(a.id)}
                  className={
                    isSelected
                      ? 'w-full text-left rounded-lg border-2 border-ink bg-paper p-3 transition-colors'
                      : 'w-full text-left rounded-lg border border-rule bg-paper p-3 hover:border-ink transition-colors'
                  }
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <Badge variant="muted" className="text-[10px]">
                      {CATEGORY_LABELS[a.category]}
                    </Badge>
                    <span
                      className={
                        liveAvg >= 70
                          ? 'font-mono text-xs px-2 py-0.5 rounded-pill bg-green-100 text-green-800'
                          : liveAvg >= 50
                            ? 'font-mono text-xs px-2 py-0.5 rounded-pill bg-amber-100 text-amber-800'
                            : 'font-mono text-xs px-2 py-0.5 rounded-pill bg-red-100 text-red-800'
                      }
                    >
                      {liveAvg}/100
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-ink leading-snug mb-1 line-clamp-2">
                    {a.title}
                  </p>
                  <p className="text-[11px] text-ink-faint font-mono">
                    {a.wordCount.toLocaleString('fr-FR')} mots · {a.sourceCitationsCount} sources ·{' '}
                    {a.internalLinksCount} liens int
                  </p>
                </button>
              )
            })}
          </aside>

          {/* Detail */}
          {selected ? (
            <section aria-label="Détail article" className="space-y-6 min-w-0">
              {/* Métriques structurelles */}
              <Card className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <p className="font-mono uppercase text-[10px] text-ink-faint">Mot-clé cible</p>
                    <p className="text-sm text-ink mt-1">{selected.targetKeyword}</p>
                  </div>
                  <div>
                    <p className="font-mono uppercase text-[10px] text-ink-faint">Mots / H2 / H3</p>
                    <p className="text-sm text-ink mt-1 font-mono">
                      {selected.wordCount.toLocaleString('fr-FR')} / {selected.h2Count} /{' '}
                      {selected.h3Count}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono uppercase text-[10px] text-ink-faint">
                      Liens (int / ext)
                    </p>
                    <p className="text-sm text-ink mt-1 font-mono">
                      {selected.internalLinksCount} / {selected.sourceCitationsCount}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono uppercase text-[10px] text-ink-faint">Coût IA</p>
                    <p className="text-sm text-ink mt-1 font-mono">
                      {formatEur(selected.aiCostEur)}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Sliders E-E-A-T */}
              <Card className="p-5">
                <h3 className="font-semibold text-sm text-ink mb-4">
                  Scoring E-E-A-T méthode Amandine Bart
                </h3>
                <div className="space-y-3">
                  {(
                    [
                      ['experience', 'Experience (exemples, terrain)'],
                      ['expertise', 'Expertise (vocabulaire technique)'],
                      ['authoritativeness', 'Authoritativeness (sources officielles)'],
                      ['trustworthiness', 'Trustworthiness (dates, disclaimers)'],
                    ] as ReadonlyArray<[keyof EeatScores, string]>
                  ).map(([axis, label]) => {
                    const value = scores[selected.id]?.[axis] ?? 0
                    return (
                      <div key={axis}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-ink-mute">{label}</span>
                          <span className="text-xs font-mono text-ink">{value}/100</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={value}
                          onChange={(e) => updateScore(selected.id, axis, Number(e.target.value))}
                          className="w-full accent-ink"
                        />
                      </div>
                    )
                  })}
                </div>
              </Card>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => handleApprove(selected.id)}
                  disabled={busy?.id === selected.id}
                >
                  {busy?.action === 'approve' && busy?.id === selected.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Approuver et publier
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleRegenerate(selected.id)}
                  disabled={busy?.id === selected.id}
                >
                  {busy?.action === 'regenerate' && busy?.id === selected.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Rejeter et régénérer
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleReject(selected.id)}
                  disabled={busy?.id === selected.id}
                >
                  {busy?.action === 'reject' && busy?.id === selected.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <XCircle className="size-4" />
                  )}
                  Rejeter définitivement
                </Button>
              </div>

              {/* Preview Markdown */}
              <Card className="p-6 max-h-[60vh] overflow-y-auto">
                <ArticleMarkdown markdown={selected.contentMarkdown} />
              </Card>
            </section>
          ) : (
            <Card className="p-12 text-center text-ink-mute">
              Sélectionnez un article à gauche pour afficher la preview.
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
