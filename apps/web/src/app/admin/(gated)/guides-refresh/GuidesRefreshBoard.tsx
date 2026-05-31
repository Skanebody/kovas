'use client'

/**
 * Composant client de la queue de validation Guides Refresh (Lot B65).
 *
 * Master-detail :
 *  - Sidebar gauche : liste drafts en draft_ready + KPI + déclencheur manuel
 *  - Colonne droite : diff side-by-side version actuelle vs draft IA
 *    + sources + chiffres extraits + actions Approuver/Rejeter/Régénérer
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, XCircle, Zap } from 'lucide-react'
import { useState, useTransition } from 'react'
import { approveDraft, regenerateDraft, rejectDraft, triggerManualRefresh } from './actions'
import type { CurrentVersion, RefreshDraft, RefreshStats } from './page'

type GuideSlug =
  | 'dpe'
  | 'amiante'
  | 'plomb'
  | 'gaz'
  | 'electricite'
  | 'termites'
  | 'carrez'
  | 'erp'
  | 'audit-energetique'

const GUIDE_LABELS: Readonly<Record<GuideSlug, string>> = {
  dpe: 'DPE',
  amiante: 'Amiante',
  plomb: 'Plomb (CREP)',
  gaz: 'Gaz',
  electricite: 'Électricité',
  termites: 'Termites',
  carrez: 'Carrez',
  erp: 'ERP',
  'audit-energetique': 'Audit énergétique',
}

interface GuidesRefreshBoardProps {
  readonly drafts: ReadonlyArray<RefreshDraft>
  readonly currentVersions: Readonly<Record<GuideSlug, CurrentVersion | null>>
  readonly stats: RefreshStats
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function GuidesRefreshBoard({ drafts, currentVersions, stats }: GuidesRefreshBoardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(drafts[0]?.id ?? null)
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState<{ action: string; id: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<string>('')
  const [manualSlug, setManualSlug] = useState<GuideSlug>('dpe')

  const selected = drafts.find((d) => d.id === selectedId) ?? null
  const currentVersion = selected ? currentVersions[selected.guideSlug] : null

  async function handleApprove(id: string) {
    setBusy({ action: 'approve', id })
    setErrorMsg(null)
    const result = await approveDraft(id)
    setBusy(null)
    if (!result.ok) {
      setErrorMsg(result.error ?? 'Approbation échouée')
      return
    }
    startTransition(() => {
      window.location.reload()
    })
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) {
      setErrorMsg('Raison de rejet requise')
      return
    }
    setBusy({ action: 'reject', id })
    setErrorMsg(null)
    const result = await rejectDraft(id, rejectReason.trim())
    setBusy(null)
    if (!result.ok) {
      setErrorMsg(result.error ?? 'Rejet échoué')
      return
    }
    setRejectReason('')
    startTransition(() => {
      window.location.reload()
    })
  }

  async function handleRegenerate(id: string) {
    setBusy({ action: 'regen', id })
    setErrorMsg(null)
    const result = await regenerateDraft(id)
    setBusy(null)
    if (!result.ok) {
      setErrorMsg(result.error ?? 'Régénération échouée')
      return
    }
    startTransition(() => {
      window.location.reload()
    })
  }

  async function handleManualTrigger() {
    setBusy({ action: 'manual', id: manualSlug })
    setErrorMsg(null)
    const result = await triggerManualRefresh(manualSlug)
    setBusy(null)
    if (!result.ok) {
      setErrorMsg(result.error ?? 'Déclenchement échoué')
      return
    }
    startTransition(() => {
      window.location.reload()
    })
  }

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Guides — Refresh queue</h1>
        <p className="text-sm text-muted-foreground">
          Validation des drafts d'auto-update produits par le pipeline IA
          <code className="mx-1 px-1 py-0.5 bg-muted rounded text-xs">refresh-guides-content</code>
          (cron lundi 04h UTC, 3 guides / semaine).
        </p>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Drafts en attente</p>
          <p className="text-2xl font-bold mt-1">{stats.drafts_ready}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Approuvés (30j)</p>
          <p className="text-2xl font-bold mt-1">{stats.approved_30d}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Échecs (30j)</p>
          <p className="text-2xl font-bold mt-1">{stats.failed_30d}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Coût IA (30j)</p>
          <p className="text-2xl font-bold mt-1">{formatEur(stats.total_cost_30d_eur)}</p>
        </Card>
      </div>

      {/* Manual trigger */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium">Déclencher manuellement :</span>
          <select
            value={manualSlug}
            onChange={(e) => setManualSlug(e.target.value as GuideSlug)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {(Object.keys(GUIDE_LABELS) as GuideSlug[]).map((slug) => (
              <option key={slug} value={slug}>
                {GUIDE_LABELS[slug]} (/guide/{slug})
              </option>
            ))}
          </select>
          <Button size="sm" onClick={handleManualTrigger} disabled={busy?.action === 'manual'}>
            {busy?.action === 'manual' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Lancement…
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Lancer un refresh
              </>
            )}
          </Button>
          <span className="text-xs text-muted-foreground">
            (~30-60s de traitement, ~0,015 € coût IA estimé)
          </span>
        </div>
      </Card>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {errorMsg}
        </div>
      )}

      {drafts.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">
            Aucun draft en attente de validation. Le prochain cron tournera lundi à 04h UTC.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          {/* Sidebar drafts */}
          <aside className="space-y-2">
            <h2 className="text-sm font-semibold mb-2 uppercase tracking-wide text-muted-foreground">
              Drafts en attente ({drafts.length})
            </h2>
            {drafts.map((d) => (
              <button
                type="button"
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`w-full text-left p-3 rounded-md border transition ${
                  selectedId === d.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-xs">
                    {GUIDE_LABELS[d.guideSlug]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatEur(d.aiCostEur)}</span>
                </div>
                <p className="text-sm font-medium line-clamp-2">
                  {d.draftTitle ?? `Draft ${d.guideSlug}`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {d.draftWordCount.toLocaleString('fr-FR')} mots · {d.sourcesFetched.length}{' '}
                  sources
                </p>
                <p className="text-xs text-muted-foreground">{formatDate(d.processedAt)}</p>
              </button>
            ))}
          </aside>

          {/* Detail */}
          {selected && (
            <section className="space-y-4 min-w-0">
              <Card className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold break-words">{selected.draftTitle}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      <code className="px-1 py-0.5 bg-muted rounded text-xs">
                        /guide/{selected.guideSlug}
                      </code>{' '}
                      · {selected.draftWordCount.toLocaleString('fr-FR')} mots ·{' '}
                      {selected.sourcesFetched.length} sources officielles ·{' '}
                      {selected.keyFigures.length} chiffres extraits
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground space-y-0.5">
                    <p>Coût IA : {formatEur(selected.aiCostEur)}</p>
                    <p>
                      Tokens : {selected.aiInputTokens.toLocaleString('fr-FR')} in /{' '}
                      {selected.aiOutputTokens.toLocaleString('fr-FR')} out
                    </p>
                    {selected.aiCacheReadTokens > 0 && (
                      <p className="text-green-600">
                        Cache hit : {selected.aiCacheReadTokens.toLocaleString('fr-FR')} tokens
                      </p>
                    )}
                  </div>
                </div>

                {/* Meta SEO preview */}
                <div className="mb-4 p-3 rounded-md bg-muted/30 text-sm">
                  <p className="font-medium text-blue-700">{selected.draftMetaTitle}</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    kovas.fr/guide/{selected.guideSlug}
                  </p>
                  <p className="text-muted-foreground mt-1">{selected.draftMetaDescription}</p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    onClick={() => handleApprove(selected.id)}
                    disabled={busy?.id === selected.id}
                    size="sm"
                  >
                    {busy?.action === 'approve' && busy?.id === selected.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Approuver & publier
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRegenerate(selected.id)}
                    disabled={busy?.id === selected.id}
                    size="sm"
                  >
                    {busy?.action === 'regen' && busy?.id === selected.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Re-générer
                  </Button>
                  <div className="flex flex-1 sm:flex-none items-center gap-2 w-full sm:w-auto sm:ml-auto">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Raison de rejet…"
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm w-full sm:w-64 min-w-0"
                    />
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(selected.id)}
                      disabled={busy?.id === selected.id || !rejectReason.trim()}
                      size="sm"
                    >
                      {busy?.action === 'reject' && busy?.id === selected.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      Rejeter
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Sources */}
              {selected.sourcesFetched.length > 0 && (
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground">
                    Sources officielles fetchées ({selected.sourcesFetched.length})
                  </h3>
                  <ul className="space-y-2 text-sm">
                    {selected.sourcesFetched.map((s, i) => (
                      <li key={`${s.url}-${i}`} className="flex items-start gap-2">
                        <Badge variant="outline" className="text-xs shrink-0">
                          {s.organization}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:underline inline-flex items-center gap-1"
                          >
                            {s.title}
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                          {s.excerpt && (
                            <p className="text-xs text-muted-foreground mt-0.5">{s.excerpt}</p>
                          )}
                          {s.published_at && (
                            <p className="text-xs text-muted-foreground">
                              Publié le {s.published_at}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Key figures */}
              {selected.keyFigures.length > 0 && (
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground">
                    Chiffres clés extraits ({selected.keyFigures.length})
                  </h3>
                  <ul className="space-y-2 text-sm">
                    {selected.keyFigures.map((f, i) => (
                      <li key={`${f.figure}-${i}`} className="border-l-2 border-primary pl-3">
                        <p className="font-medium">{f.figure}</p>
                        <p className="text-xs text-muted-foreground">{f.context}</p>
                        <a
                          href={f.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          {f.source_org}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Diff side-by-side : version actuelle vs draft */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground">
                    Version actuelle{' '}
                    {currentVersion ? `(v${currentVersion.versionNumber})` : '(aucune)'}
                  </h3>
                  {currentVersion ? (
                    <>
                      <p className="text-xs text-muted-foreground mb-3">
                        Publié le {formatDate(currentVersion.publishedAt)} ·{' '}
                        {currentVersion.wordCount.toLocaleString('fr-FR')} mots
                      </p>
                      <pre className="text-xs whitespace-pre-wrap max-h-96 overflow-auto p-3 bg-muted/30 rounded">
                        {currentVersion.contentMd.slice(0, 4000)}
                        {currentVersion.contentMd.length > 4000 && '\n…[tronqué]'}
                      </pre>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucune version DB pour ce guide. Le frontend `/guide/{selected.guideSlug}` lit
                      actuellement le registry hardcodé (`apps/web/src/lib/guides/`).
                    </p>
                  )}
                </Card>
                <Card className="p-6 border-primary">
                  <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-primary">
                    Draft IA proposé
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Produit le {formatDate(selected.processedAt)} ·{' '}
                    {selected.draftWordCount.toLocaleString('fr-FR')} mots
                  </p>
                  <pre className="text-xs whitespace-pre-wrap max-h-96 overflow-auto p-3 bg-muted/30 rounded">
                    {(selected.draftContentMd ?? '').slice(0, 4000)}
                    {(selected.draftContentMd ?? '').length > 4000 && '\n…[tronqué]'}
                  </pre>
                </Card>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
