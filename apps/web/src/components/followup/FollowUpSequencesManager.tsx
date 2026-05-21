'use client'

/**
 * KOVAS — <FollowUpSequencesManager>
 *
 * Page complète /app/relances : pilotage des séquences de relance automatiques.
 *
 * 5 tabs (1 par scénario) :
 *   - Devis en attente
 *   - Factures impayées
 *   - Post-DPE F/G
 *   - Prescripteurs silencieux
 *   - Avis clients
 *
 * Pour chaque tab :
 *   - Liste séquences actives
 *   - Étape en cours + prochaine action prévue
 *   - Actions : pause / resume / cancel
 *   - Lien cliquable vers la cible (devis / facture / mission / contact)
 *
 * Authority : CLAUDE.md §3 + §16 IA support.
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { ExternalLink, Inbox, Loader2, Pause, Play, X } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

export type FollowUpKind =
  | 'pending_quote'
  | 'unpaid_invoice'
  | 'post_dpe_fg'
  | 'silent_prescriber'
  | 'client_review'

export type FollowUpStatus = 'active' | 'paused' | 'completed' | 'cancelled'

export type FollowUpTargetEntityType = 'quote' | 'auto_quote' | 'invoice' | 'mission' | 'contact'

export interface FollowUpSequence {
  id: string
  kind: FollowUpKind
  status: FollowUpStatus
  targetName: string
  targetEmail: string | null
  /** Référence métier de la cible (DEV-2026-XXX, FAC-2026-XXX, DOS-XXXX) — null pour contacts. */
  targetReference: string | null
  /** Type d'entité cible (canonique migration). */
  targetEntityType: FollowUpTargetEntityType | null
  /** ID de l'entité cible pour deeplink. */
  targetEntityId: string | null
  currentStepLabel: string
  nextActionAt: string | null // ISO
  stepIndex: number
  totalSteps: number
  startedAt: string
  responseReceivedAt: string | null
}

const TABS: { key: FollowUpKind; label: string }[] = [
  { key: 'pending_quote', label: 'Devis en attente' },
  { key: 'unpaid_invoice', label: 'Factures impayées' },
  { key: 'post_dpe_fg', label: 'Post-DPE F/G' },
  { key: 'silent_prescriber', label: 'Prescripteurs silencieux' },
  { key: 'client_review', label: 'Avis clients' },
]

export interface FollowUpSequencesManagerProps {
  className?: string
  /** Optionnel : tab pré-sélectionné (ex. ?tab=devis). */
  defaultKind?: FollowUpKind
  /** Si true, masque les tabs internes (la page parent les pilote). */
  hideTabs?: boolean
  /** Si fourni, force le filtre — utilisé pour vue unifiée "toutes". */
  forceKind?: FollowUpKind | null
}

export function FollowUpSequencesManager({
  className,
  defaultKind = 'pending_quote',
  hideTabs = false,
  forceKind,
}: FollowUpSequencesManagerProps) {
  const [activeTab, setActiveTab] = useState<FollowUpKind>(defaultKind)
  const [sequences, setSequences] = useState<FollowUpSequence[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null) // id en cours d'action
  const [cancelTarget, setCancelTarget] = useState<FollowUpSequence | null>(null)

  // Si forceKind défini (null = toutes), il prime sur activeTab pour la requête API.
  const queryKind = forceKind === undefined ? activeTab : forceKind

  const reload = useCallback(async () => {
    setSequences(null)
    setError(null)
    try {
      const url = queryKind ? `/api/followup-sequences?kind=${queryKind}` : `/api/followup-sequences`
      const seqRes = await fetch(url)
      if (!seqRes.ok) throw new Error(`HTTP ${seqRes.status}`)
      const seqData = (await seqRes.json()) as { sequences: FollowUpSequence[] }
      setSequences(seqData.sequences)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erreur inconnue')
    }
  }, [queryKind])

  useEffect(() => {
    void reload()
  }, [reload])

  const handleAction = async (id: string, op: 'pause' | 'resume' | 'cancel') => {
    if (pending) return
    setPending(id)

    // Optimistic update
    setSequences((prev) =>
      prev
        ? prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status:
                    op === 'pause' ? 'paused' : op === 'resume' ? 'active' : 'cancelled',
                }
              : s,
          )
        : prev,
    )

    try {
      const res = await fetch(`/api/followup-sequences/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: op }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erreur inconnue')
      await reload()
    } finally {
      setPending(null)
      if (op === 'cancel') setCancelTarget(null)
    }
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Tabs internes — masqués si la page parent en gère */}
      {!hideTabs ? (
        <nav
          role="tablist"
          aria-label="Types de relances"
          className="flex flex-wrap gap-1.5 border-b border-rule/60 pb-2"
        >
          {TABS.map((tab) => {
            const active = tab.key === activeTab
            return (
              <button
                key={tab.key}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-3.5 py-1.5 rounded-pill text-[12px] font-medium transition-colors',
                  active
                    ? 'bg-navy text-paper'
                    : 'text-ink-mute hover:bg-ink/5 hover:text-ink',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      ) : null}

      {/* Liste */}
      {error ? (
        <Card variant="opaque" padding="sm">
          <p className="text-[13px] text-accent-red">Chargement impossible — {error}</p>
        </Card>
      ) : sequences === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : sequences.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Aucune séquence en cours"
          description="Les nouvelles séquences seront déclenchées automatiquement par les workers ou créées manuellement depuis un devis/facture."
        />
      ) : (
        <ul className="space-y-2">
          {sequences.map((seq) => (
            <SequenceRow
              key={seq.id}
              seq={seq}
              pending={pending === seq.id}
              onAction={(op) => {
                if (op === 'cancel') {
                  setCancelTarget(seq)
                  return
                }
                void handleAction(seq.id, op)
              }}
            />
          ))}
        </ul>
      )}

      {/* Dialog confirmation annulation séquence */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler cette séquence&nbsp;?</DialogTitle>
            <DialogDescription>
              {cancelTarget?.targetReference ? (
                <>
                  La séquence ciblant{' '}
                  <span className="font-mono">{cancelTarget.targetReference}</span> sera
                  définitivement arrêtée. Les étapes restantes ne seront pas envoyées.
                </>
              ) : (
                <>La séquence sera définitivement arrêtée. Cette action est irréversible.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelTarget(null)}>
              Conserver active
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelTarget && void handleAction(cancelTarget.id, 'cancel')}
              disabled={!!pending}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Annuler la séquence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Construit le href deeplink vers l'entité cible.
 * Renvoie null si non-deeplinkable (ex. contact sans page détail).
 */
function buildTargetHref(seq: FollowUpSequence): string | null {
  if (!seq.targetEntityId) return null
  switch (seq.targetEntityType) {
    case 'quote':
    case 'auto_quote':
      return `/dashboard/devis/${seq.targetEntityId}`
    case 'invoice':
      return `/dashboard/factures/${seq.targetEntityId}`
    case 'mission':
      return `/dashboard/dossiers/${seq.targetEntityId}`
    default:
      return null
  }
}

function statusBadgeVariant(
  status: FollowUpStatus,
): 'green' | 'amber' | 'muted' | 'red' | 'blue' {
  switch (status) {
    case 'active':
      return 'green'
    case 'paused':
      return 'amber'
    case 'completed':
      return 'muted'
    case 'cancelled':
      return 'red'
  }
}

function statusLabel(status: FollowUpStatus): string {
  switch (status) {
    case 'active':
      return 'En cours'
    case 'paused':
      return 'En pause'
    case 'completed':
      return 'Terminée'
    case 'cancelled':
      return 'Annulée'
  }
}

function SequenceRow({
  seq,
  pending,
  onAction,
}: {
  seq: FollowUpSequence
  pending: boolean
  onAction: (op: 'pause' | 'resume' | 'cancel') => void
}) {
  const href = buildTargetHref(seq)
  const nextLabel = seq.nextActionAt
    ? new Date(seq.nextActionAt).toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  // Timeline visuelle compacte : [J+7 ✓] [J+14 ✓] [J+21 ⏳]
  const steps = Array.from({ length: seq.totalSteps }, (_, i) => {
    if (i < seq.stepIndex) return 'done' as const
    if (i === seq.stepIndex) return 'current' as const
    return 'pending' as const
  })

  return (
    <Card variant="opaque" padding="sm">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-start gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            {href ? (
              <Link
                href={href}
                className="font-semibold text-ink hover:text-navy hover:underline truncate inline-flex items-center gap-1.5"
              >
                {seq.targetName}
                <ExternalLink className="size-3 text-ink-mute" aria-hidden />
              </Link>
            ) : (
              <p className="font-semibold text-ink truncate">{seq.targetName}</p>
            )}
            {seq.targetReference ? (
              <span className="font-mono text-[11px] uppercase tracking-wide text-ink-mute">
                {seq.targetReference}
              </span>
            ) : null}
            <Badge variant={statusBadgeVariant(seq.status)}>{statusLabel(seq.status)}</Badge>
          </div>

          {seq.targetEmail ? (
            <p className="text-[11px] font-mono text-ink-mute truncate">{seq.targetEmail}</p>
          ) : null}

          {/* Timeline visuelle */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide">
            {steps.map((state, i) => (
              <span
                key={i}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-pill border',
                  state === 'done' &&
                    'border-transparent bg-lime-mist text-[#2D4015]',
                  state === 'current' &&
                    'border-transparent bg-blue-mist text-[#1E3A8A] animate-pulse-soft',
                  state === 'pending' && 'border-rule/60 text-ink-mute',
                )}
              >
                E{i + 1}
                {state === 'done' ? ' ✓' : state === 'current' ? ' →' : ''}
              </span>
            ))}
          </div>

          <p className="text-[11px] text-ink-mute">
            {seq.status === 'active' ? 'Prochaine action : ' : 'Statut : '}
            <span className="font-mono">{nextLabel}</span>
            {seq.currentStepLabel ? (
              <>
                {' · '}
                {seq.currentStepLabel}
              </>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-1.5 justify-end shrink-0">
          {seq.status === 'active' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAction('pause')}
              disabled={pending}
              aria-label="Mettre en pause"
              title="Mettre en pause"
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Pause className="size-3.5" />}
            </Button>
          ) : seq.status === 'paused' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAction('resume')}
              disabled={pending}
              aria-label="Reprendre"
              title="Reprendre"
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            </Button>
          ) : null}
          {(seq.status === 'active' || seq.status === 'paused') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAction('cancel')}
              disabled={pending}
              aria-label="Annuler la séquence"
              title="Annuler"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
