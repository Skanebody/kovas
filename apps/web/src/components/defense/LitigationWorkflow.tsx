'use client'

/**
 * KOVAS — <LitigationWorkflow>
 *
 * Module Défense — pilotage d'un éventuel litige client sur une mission.
 *
 * Si aucun litige n'existe : bouton "Ouvrir un litige" + modal création.
 * Si litige actif : timeline 5 étapes + réponse IA suggérée + jurisprudences +
 * courrier avocat + boutons "Marquer résolu" / "Escalader".
 *
 * Authority : CLAUDE.md §15 RC Pro + §13 défense Liciel.
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  AlertOctagon,
  CheckCircle2,
  Download,
  FileText,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
} from 'lucide-react'
import { useEffect, useState } from 'react'

export type LitigationStatus = 'opened' | 'in_progress' | 'resolved' | 'closed' | 'court'

const STEPS: { key: LitigationStatus; label: string }[] = [
  { key: 'opened', label: 'Ouvert' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'resolved', label: 'Résolu' },
  { key: 'closed', label: 'Clos' },
  { key: 'court', label: 'Judiciaire' },
]

export interface Jurisprudence {
  id: string
  title: string
  date: string
  court: string
  url: string
  excerpt: string
}

export interface LitigationData {
  id: string
  status: LitigationStatus
  openedAt: string
  reason: string
  aiSuggestedResponse: string
  jurisprudences: Jurisprudence[]
  lawyerLetterUrl: string | null
}

export interface LitigationWorkflowProps {
  missionId: string
  initialData?: LitigationData | null
  className?: string
}

type ViewState =
  | { status: 'loading' }
  | { status: 'absent' }
  | { status: 'present'; data: LitigationData }
  | { status: 'error'; message: string }

export function LitigationWorkflow({
  missionId,
  initialData,
  className,
}: LitigationWorkflowProps) {
  const [view, setView] = useState<ViewState>(
    initialData === null
      ? { status: 'absent' }
      : initialData
        ? { status: 'present', data: initialData }
        : { status: 'loading' },
  )
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createReason, setCreateReason] = useState('')
  const [pending, setPending] = useState<'create' | 'resolve' | 'escalate' | 'regenerate' | null>(
    null,
  )
  const [editedResponse, setEditedResponse] = useState('')
  const [escalateReason, setEscalateReason] = useState('')
  const [showEscalateModal, setShowEscalateModal] = useState(false)

  useEffect(() => {
    if (initialData !== undefined) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/litigation/by-mission/${missionId}`)
        if (res.status === 404) {
          if (!cancelled) setView({ status: 'absent' })
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as LitigationData
        if (!cancelled) {
          setView({ status: 'present', data })
          setEditedResponse(data.aiSuggestedResponse)
        }
      } catch (err) {
        if (!cancelled)
          setView({
            status: 'error',
            message: err instanceof Error ? err.message : 'erreur inconnue',
          })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [missionId, initialData])

  const handleCreate = async () => {
    if (createReason.trim().length < 10) return
    setPending('create')
    try {
      const res = await fetch('/api/litigation/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ missionId, reason: createReason.trim() }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as LitigationData
      setView({ status: 'present', data })
      setEditedResponse(data.aiSuggestedResponse)
      setShowCreateModal(false)
      setCreateReason('')
    } catch (err) {
      setView({
        status: 'error',
        message: err instanceof Error ? err.message : 'erreur',
      })
    } finally {
      setPending(null)
    }
  }

  const patch = async (
    id: string,
    payload: Record<string, unknown>,
    op: 'resolve' | 'escalate' | 'regenerate',
  ): Promise<LitigationData | null> => {
    setPending(op)
    try {
      const res = await fetch(`/api/litigation/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as LitigationData
      setView({ status: 'present', data })
      return data
    } catch (err) {
      setView({
        status: 'error',
        message: err instanceof Error ? err.message : 'erreur',
      })
      return null
    } finally {
      setPending(null)
    }
  }

  if (view.status === 'loading') {
    return (
      <Card variant="opaque" padding="default" className={className}>
        <Skeleton className="h-5 w-1/3 mb-4" />
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-2/3" />
      </Card>
    )
  }

  if (view.status === 'error') {
    return (
      <Card variant="opaque" padding="sm" className={className}>
        <p className="text-[13px] text-accent-red">Litige : {view.message}</p>
      </Card>
    )
  }

  if (view.status === 'absent') {
    return (
      <Card variant="opaque" padding="default" className={className}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-serif italic text-[18px] text-ink">Aucun litige en cours</p>
            <p className="text-[12px] text-ink-mute">
              Ouvrez un dossier si un client conteste le rapport.
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowCreateModal(true)}>
            <Scale className="size-4" />
            Ouvrir un litige
          </Button>
        </div>

        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ouvrir un litige</DialogTitle>
              <DialogDescription>
                Décrivez précisément le motif. KOVAS générera ensuite une réponse IA suggérée et
                listera les jurisprudences pertinentes.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={createReason}
              onChange={(e) => setCreateReason(e.target.value)}
              placeholder="Motif détaillé (ex: client conteste l'étiquette F, demande contre-expertise)"
              rows={5}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                Annuler
              </Button>
              <Button
                variant="accent"
                disabled={createReason.trim().length < 10 || pending === 'create'}
                onClick={handleCreate}
              >
                {pending === 'create' ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Ouvrir le litige
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    )
  }

  const { data } = view
  const stepIndex = STEPS.findIndex((s) => s.key === data.status)

  return (
    <Card variant="opaque" padding="default" className={className}>
      <CardHeader className="p-0 pb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2 font-serif italic font-normal text-[20px]">
            <Scale className="size-4 text-ink-mute" />
            Litige #{data.id.slice(0, 8)}
          </CardTitle>
          <Badge
            variant={
              data.status === 'resolved' || data.status === 'closed'
                ? 'green'
                : data.status === 'court'
                  ? 'red'
                  : 'amber'
            }
          >
            {STEPS.find((s) => s.key === data.status)?.label ?? data.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-5">
        {/* Timeline */}
        <ol className="flex items-center justify-between gap-2">
          {STEPS.map((step, i) => {
            const reached = i <= stepIndex
            return (
              <li key={step.key} className="flex-1 flex flex-col items-center">
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full text-[11px] font-semibold',
                    reached ? 'bg-chartreuse text-ink' : 'bg-cream-deep text-ink-mute',
                  )}
                >
                  {i + 1}
                </span>
                <span
                  className={cn(
                    'mt-1.5 text-[10px] uppercase tracking-wider font-mono',
                    reached ? 'text-ink' : 'text-ink-mute',
                  )}
                >
                  {step.label}
                </span>
              </li>
            )
          })}
        </ol>

        <div>
          <p className="text-[11px] uppercase tracking-wider font-mono text-ink-mute mb-1.5">
            Motif
          </p>
          <p className="text-[13px] text-ink-soft leading-relaxed">{data.reason}</p>
        </div>

        {/* Réponse IA */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] uppercase tracking-wider font-mono text-ink-mute">
              Réponse IA suggérée
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void patch(data.id, { regenerate: true }, 'regenerate')}
              disabled={pending !== null}
            >
              {pending === 'regenerate' ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              Régénérer
            </Button>
          </div>
          <Textarea
            value={editedResponse}
            onChange={(e) => setEditedResponse(e.target.value)}
            rows={8}
            className="font-mono text-[12px]"
          />
        </div>

        {/* Jurisprudences */}
        <div>
          <p className="text-[11px] uppercase tracking-wider font-mono text-ink-mute mb-1.5">
            Jurisprudences pertinentes
          </p>
          {data.jurisprudences.length === 0 ? (
            <p className="text-[12px] text-ink-mute">Aucune jurisprudence indexée pour ce cas.</p>
          ) : (
            <ul className="space-y-2">
              {data.jurisprudences.map((j) => (
                <li
                  key={j.id}
                  className="rounded-md border border-rule/60 bg-paper px-3 py-2 text-[12px]"
                >
                  <a
                    href={j.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-ink hover:underline"
                  >
                    {j.title}
                  </a>
                  <p className="text-ink-mute">
                    {j.court} — {j.date}
                  </p>
                  <p className="mt-1 text-ink-soft">{j.excerpt}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Courrier avocat */}
        <div className="flex items-center justify-between rounded-md border border-rule/60 bg-paper px-3 py-2">
          <div className="flex items-center gap-2 text-[12px] text-ink-soft">
            <FileText className="size-4 text-ink-mute" />
            Courrier d&apos;avocat (PDF)
          </div>
          {data.lawyerLetterUrl ? (
            <a
              href={data.lawyerLetterUrl}
              download
              className="inline-flex items-center gap-1.5 text-[12px] text-ink hover:underline"
            >
              <Download className="size-3.5" />
              Télécharger
            </a>
          ) : (
            <span className="text-[11px] text-ink-mute">non généré</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button
            variant="accent"
            size="sm"
            onClick={() => void patch(data.id, { status: 'resolved' }, 'resolve')}
            disabled={pending !== null || data.status === 'resolved' || data.status === 'closed'}
          >
            <CheckCircle2 className="size-3.5" />
            Marquer résolu
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowEscalateModal(true)}
            disabled={pending !== null || data.status === 'court'}
          >
            <AlertOctagon className="size-3.5" />
            Escalader
          </Button>
        </div>
      </CardContent>

      <Dialog open={showEscalateModal} onOpenChange={setShowEscalateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalader le litige</DialogTitle>
            <DialogDescription>
              Passe le litige en mode "judiciaire". Cette action notifie l&apos;assurance RC pro
              (Hiscox) et déclenche la procédure d&apos;envoi du dossier complet à
              l&apos;avocat.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={escalateReason}
            onChange={(e) => setEscalateReason(e.target.value)}
            placeholder="Raison de l'escalade (obligatoire, ≥ 20 caractères)"
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEscalateModal(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={escalateReason.trim().length < 20 || pending === 'escalate'}
              onClick={async () => {
                const ok = await patch(
                  data.id,
                  { status: 'court', escalateReason: escalateReason.trim() },
                  'escalate',
                )
                if (ok) {
                  setShowEscalateModal(false)
                  setEscalateReason('')
                }
              }}
            >
              <Gavel className="size-3.5" />
              Confirmer l&apos;escalade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
